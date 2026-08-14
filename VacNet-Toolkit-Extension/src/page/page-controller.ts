import { createClipIdentity, type ClipData, type ClipDeduplication, type PageSnapshot } from '../domain/clip';
import { defaultPreferences, type Preferences } from '../domain/preferences';
import type { MessageCatalog } from '../shared/i18n';
import { dispatchFromPage, type FromPageMessage, type ToPageMessage } from '../shared/protocol';
import { emptyVerdicts, type VerdictSelection } from '../domain/verdict';
import { isVerdictSelection } from '../domain/verdict';
import { ClipParser } from './clip-parser';
import { HotkeyManager } from './hotkey-manager';
import { ModalController } from './modal-controller';
import { VideoJsAdapter } from './player-adapter';
import { VerdictController } from './verdict-controller';

export class PageController {
  private catalog: MessageCatalog | null = null;
  private preferences: Preferences = defaultPreferences;
  private readonly parser = new ClipParser(() => this.catalog);
  private readonly modal = new ModalController();
  private readonly player = new VideoJsAdapter(() => this.catalog, (value) => dispatchFromPage({ type: 'preferences', preferences: value }));
  private readonly verdicts = new VerdictController(() => this.catalog, (badClip) => void this.submit(badClip));
  private readonly hotkeys = new HotkeyManager(this.player, this.modal, () => this.verdicts.primaryAction(), () => this.submitting || this.transitioning);
  private observer: MutationObserver | null = null;
  private submitting = false;
  private currentClip: ClipData | null = null;
  private requestNumber = 0;
  private activeLoad: AbortController | null = null;
  private reportLink: HTMLAnchorElement | null = null;
  private feedbackLink: HTMLAnchorElement | null = null;
  private currentDeduplication: ClipDeduplication | null = null;
  private previousVerdicts: VerdictSelection | null = null;
  private restoredClipIdentity: string | null = null;
  private transitioning = false;

  start(): void {
    document.addEventListener('submit', this.onFormSubmit, true);
    document.addEventListener('click', this.onPageClick, true);
    this.hotkeys.install();
    this.observer = new MutationObserver(() => this.reconcile());
    this.observer.observe(document, { childList: true, subtree: true });
    this.currentClip = this.parser.current();
    if (this.currentClip) this.parser.storeCanonicalTiming(this.currentClip);
    window.addEventListener('pagehide', this.onPageHide);
    dispatchFromPage({ type: 'ready' });
  }

  receive(message: ToPageMessage): void {
    if (message.type === 'initialize') {
      this.catalog = message.catalog;
      this.preferences = message.preferences;
      document.documentElement.lang = message.catalog.videoJsLocale;
      this.reconcile();
      void this.identifyCurrentClip();
      this.emitSnapshot();
    } else if (message.type === 'preferences') {
      this.preferences = message.preferences;
      this.player.applyPreferences(message.preferences);
    } else if (message.type === 'history-result') {
      document.dispatchEvent(new CustomEvent(`vacnet:v2:history:${message.requestId}`, { detail: message.lookup }));
    } else if (message.command === 'toggle-stretch') {
      dispatchFromPage({ type: 'preferences', preferences: { stretchVideo: !this.preferences.stretchVideo } });
    } else {
      this.emitSnapshot();
    }
  }

  private reconcile(): void {
    if (!this.catalog || this.transitioning) return;
    this.verdicts.render();
    this.modal.install(this.catalog.closeClipDetails);
    const previous = this.currentClip;
    const clip = previous ?? this.parser.current();
    this.currentClip = clip;
    if (clip && previous === null) this.parser.storeCanonicalTiming(clip);
    if (clip && previous === null) void this.identifyCurrentClip();
    if (clip) this.player.configure(this.preferences, clip.range);
    this.bindReportLink();
    this.bindFeedbackLink();
    this.installPageGlobals();
    this.showSystemNodes();
    this.moveClipCount();
    this.verdicts.renderClipSummary(clip, this.currentDeduplication, this.previousVerdicts);
  }

  private readonly stop = (): void => {
    this.activeLoad?.abort();
    this.observer?.disconnect();
    document.removeEventListener('submit', this.onFormSubmit, true);
    document.removeEventListener('click', this.onPageClick, true);
    this.hotkeys.dispose();
    this.modal.dispose();
    this.player.dispose();
    window.removeEventListener('pagehide', this.onPageHide);
  };

  private readonly onPageHide = (event: PageTransitionEvent): void => {
    if (!event.persisted) this.stop();
  };

  private installPageGlobals(): void {
    window.ShowLabelingButtons = () => { this.verdicts.render(); };
    window.SetModeLabeling = () => { this.verdicts.render(); };
    window.SetModeConfirmLabels = () => { this.verdicts.render(); };
    window.SubmitLabels = () => { void this.submit(false); };
    window.ReportBadClip = () => { void this.submit(true); };
  }

  private bindReportLink(): void {
    const link = document.querySelector<HTMLAnchorElement>(".footer-buttons a[onclick*='ReportBadClip'], .footer-buttons a[data-action='report-bad-clip']");
    if (!link || link === this.reportLink) return;
    this.reportLink = link;
    link.removeAttribute('onclick');
    link.dataset.action = 'report-bad-clip';
  }

  private bindFeedbackLink(): void {
    const link = document.querySelector<HTMLAnchorElement>('.footer-buttons a.mail-to, .footer-buttons a[href^="mailto:cs2team@valvesoftware.com"]');
    if (!link || link === this.feedbackLink) return;
    this.feedbackLink = link;
    link.href = 'mailto:cs2team@valvesoftware.com?subject=Video%20Labeling%20Feedback';
    link.dataset.action = 'send-feedback';
  }

  private showSystemNodes(): void {
    document.querySelectorAll<HTMLElement>('.perf_timing_area, .modalgraph, .evidencelog, .accountdata, .datasourcetable').forEach((element) => {
      element.classList.add('vacnet-extension-visible');
      if (!element.textContent.trim() && !element.querySelector('.vacnet-extension-empty-state')) {
        const empty = document.createElement('span');
        empty.className = 'vacnet-extension-empty-state';
        empty.textContent = this.catalog?.emptyClientSnapshot ?? '';
        element.append(empty);
      }
    });
  }

  private moveClipCount(): void {
    const count = document.querySelector<HTMLElement>('.ClipCount');
    const status = document.getElementById('statustext');
    if (!count || !status || count.classList.contains('vacnet-extension-clip-count')) return;
    count.classList.add('vacnet-extension-clip-count');
    status.after(count);
  }

  private async submit(badClip: boolean): Promise<void> {
    if (this.submitting) return;
    const form = this.verdicts.prepareForm(badClip);
    if (!form) {
      this.verdicts.showError(this.catalog?.errorPlayerOrFormUnavailable ?? 'Form unavailable');
      return;
    }
    this.submitting = true;
    this.verdicts.setSubmitting(true);
    this.emitSnapshot();
    const submittedClip = this.currentClip ?? this.parser.current();
    const submittedDeduplication = this.currentDeduplication ?? 'new-match';
    const submittedVerdicts = this.verdicts.selected();
    const controller = new AbortController();
    this.activeLoad?.abort();
    this.activeLoad = controller;
    try {
      const response = await fetch(form.action, {
        method: form.method || 'POST',
        body: new FormData(form),
        credentials: 'same-origin',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(this.format(this.catalog?.errorServerResponse ?? 'Server returned {status}', { status: String(response.status) }));
      if (submittedClip) await this.saveHistory(submittedClip, submittedDeduplication, submittedVerdicts, badClip);
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) throw new Error(this.catalog?.errorNextClipMissing ?? 'Invalid server response');
      const parsed = this.parser.parseHtml(await response.text(), response.url || location.href);
      this.activateNextClip(parsed);
      void this.identifyCurrentClip();
      try {
        await this.player.load(parsed.clip.sourceWebmUrl, parsed.clip.range, controller.signal);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) location.replace(response.url || location.href);
        throw error;
      }
      this.player.applyPreferences(this.preferences);
      dispatchFromPage({ type: 'clip-updated', clip: parsed.clip });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        const reason = error instanceof Error ? error.message : String(error);
        this.verdicts.showError(this.format(this.catalog?.errorNextClipLoad ?? 'Could not load next clip: {error}', { error: reason }));
      }
    } finally {
      if (this.activeLoad === controller) this.activeLoad = null;
      this.submitting = false;
      this.verdicts.setSubmitting(false);
      this.emitSnapshot();
    }
  }

  private requestHistory(message: Extract<FromPageMessage, { type: 'history-find' | 'history-save' }>): Promise<unknown> {
    return new Promise((resolve) => {
      const eventName = `vacnet:v2:history:${message.requestId}`;
      const timeout = window.setTimeout(() => {
        document.removeEventListener(eventName, listener);
        resolve(null);
      }, 2_000);
      const listener = (event: Event): void => {
        window.clearTimeout(timeout);
        document.removeEventListener(eventName, listener);
        resolve(event instanceof CustomEvent ? event.detail : null);
      };
      document.addEventListener(eventName, listener);
      dispatchFromPage(message);
    });
  }

  private async findHistory(clip: ClipData): Promise<{ restoredVerdicts: VerdictSelection | null; previousVerdicts: VerdictSelection | null; deduplication: ClipDeduplication }> {
    const requestId = this.nextRequestId();
    const lookup = await this.requestHistory({
      type: 'history-find',
      requestId,
      clip,
    });
    if (typeof lookup !== 'object' || lookup === null || Array.isArray(lookup)) return { restoredVerdicts: null, previousVerdicts: null, deduplication: 'new-match' };
    const value = lookup as { status?: unknown; entry?: unknown };
    const deduplication = value.status === 'exact-duplicate' || value.status === 'same-match-different-clip' ? value.status : 'new-match';
    return {
      restoredVerdicts: deduplication === 'exact-duplicate' && isVerdictSelection(value.entry) ? { ...value.entry } : null,
      previousVerdicts: deduplication !== 'new-match' && isVerdictSelection(value.entry) ? { ...value.entry } : null,
      deduplication,
    };
  }

  private async saveHistory(clip: ClipData, deduplication: ClipDeduplication, verdicts: VerdictSelection, badClip: boolean): Promise<void> {
    await this.requestHistory({
      type: 'history-save',
      requestId: this.nextRequestId(),
      clip,
      deduplication,
      verdicts,
      badClip,
    });
  }

  private async identifyCurrentClip(): Promise<void> {
    const clip = this.currentClip;
    if (!clip) return;
    const clipKey = createClipIdentity(clip).clipKey;
    const clipIdentity = this.historyIdentity(clip, clipKey);
    if (this.restoredClipIdentity === clipIdentity) return;
    this.restoredClipIdentity = clipIdentity;
    const history = await this.findHistory(clip);
    if (this.matchesCurrentClip(clip, clipKey)) {
      this.currentDeduplication = history.deduplication;
      this.previousVerdicts = history.previousVerdicts;
      if (this.preferences.autoApplyRepeatVerdicts && history.previousVerdicts) this.verdicts.reset(history.previousVerdicts);
      this.verdicts.renderClipSummary(clip, history.deduplication, history.previousVerdicts);
      this.emitSnapshot();
    }
  }

  private activateNextClip(parsed: ReturnType<ClipParser['parseHtml']>): void {
    this.transitioning = true;
    try {
      this.parser.synchronize(parsed.document);
      this.currentClip = parsed.clip;
      this.player.setRange(parsed.clip.range);
      this.parser.storeCanonicalTiming(parsed.clip);
      this.currentDeduplication = null;
      this.previousVerdicts = null;
      this.restoredClipIdentity = null;
      this.verdicts.reset(emptyVerdicts());
      this.verdicts.renderClipSummary(parsed.clip, null, null);
      // Tell the main-world timer guard that old Valve listeners can now fire for a replaced source.
      document.dispatchEvent(new Event('vacnet:v2:clip-transition'));
    } finally {
      this.transitioning = false;
    }
  }

  private matchesCurrentClip(clip: ClipData, clipKey: string): boolean {
    const current = this.currentClip;
    return current !== null
      && current.taskId === clip.taskId
      && current.videoId === clip.videoId
      && createClipIdentity(current).clipKey === clipKey;
  }

  private historyIdentity(clip: ClipData, clipKey: string): string {
    return `${clip.taskId}\u0000${clip.videoId}\u0000${clipKey}`;
  }

  private emitSnapshot(): void {
    const snapshot: PageSnapshot = {
      clip: this.currentClip ?? this.parser.current(),
      deduplication: this.currentDeduplication,
      player: this.player.metrics(),
      hasVideo: Boolean(document.querySelector('#video, #video_html5_api')),
      submitting: this.submitting,
      error: null,
    };
    dispatchFromPage({ type: 'snapshot', snapshot });
  }

  private nextRequestId(): string {
    this.requestNumber += 1;
    return `vacnet-${Date.now()}-${this.requestNumber}`;
  }

  private format(template: string, replacements: Record<string, string>): string {
    return Object.entries(replacements).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);
  }

  private readonly onFormSubmit = (event: SubmitEvent): void => {
    const form = event.target;
    if (form instanceof HTMLFormElement && form.id === 'submitverdictform') {
      event.preventDefault();
      event.stopImmediatePropagation();
      void this.submit(false);
    }
  };

  private readonly onPageClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action='report-bad-clip'], [onclick*='ReportBadClip']") : null;
    const feedback = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("[data-action='send-feedback']") : null;
    if (feedback) {
      event.preventDefault();
      window.location.href = feedback.href;
      return;
    }
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void this.submit(true);
  };

}
