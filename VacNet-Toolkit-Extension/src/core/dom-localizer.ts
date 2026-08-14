import type { MessageCatalog, MessageKey } from '../shared/i18n';

const translatedKeys: readonly MessageKey[] = [
  'cs2VideoReview', 'inviteReviewers', 'noInvites', 'clipsLabeled', 'logout', 'watchClipInstructions', 'xrayActive',
  'verdictTrainingNotice', 'uncertainNotice', 'clipSelectionNotice', 'questionAimAssist', 'questionWallHack',
  'questionAutoBhop', 'questionBot', 'labelAimAssist', 'labelWallHack', 'labelAutoBhop', 'labelBot', 'btnUncertain',
  'btnProceed', 'btnBack', 'btnConfirm', 'statusSubmitting', 'statusPleaseWait', 'btnSendFeedback', 'btnReportBadClip',
  'clipDetails', 'taskId', 'app', 'none', 'devMetricsTitle',
];

export class DomLocalizer {
  private readonly translations = new Map<string, string>();
  private observer: MutationObserver | null = null;
  private queued = false;

  constructor(private readonly catalog: MessageCatalog) {
    translatedKeys.forEach((key) => {
      const sourceKey = `source${key[0]?.toUpperCase() ?? ''}${key.slice(1)}` as MessageKey;
      const source = catalog[sourceKey];
      if (source) this.translations.set(source, catalog[key]);
    });
  }

  start(): void {
    this.translate(document.documentElement);
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document, { childList: true, subtree: true, characterData: true });
  }

  translate(container: Node): void {
    if (container === document.documentElement && this.translations.has(document.title)) document.title = this.translations.get(document.title) ?? document.title;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && !parent.closest('script, style, textarea, input, vacnet-extension-ui')) this.translateText(node);
      node = walker.nextNode();
    }
    if (container instanceof Element) {
      container.querySelectorAll<HTMLElement>('[title], [aria-label]').forEach((element) => {
        ['title', 'aria-label'].forEach((attribute) => {
          const source = element.getAttribute(attribute);
          const translated = source ? this.translations.get(source) : null;
          if (translated) element.setAttribute(attribute, translated);
        });
      });
    }
  }

  stop(): void {
    this.observer?.disconnect();
  }

  private schedule(): void {
    if (this.queued) return;
    this.queued = true;
    window.requestAnimationFrame(() => {
      this.queued = false;
      this.translate(document.body);
    });
  }

  private translateText(node: Node): void {
    const value = node.nodeValue ?? '';
    const source = value.trim();
    const translated = this.translations.get(source);
    if (!translated) return;
    node.nodeValue = `${value.match(/^\s*/u)?.[0] ?? ''}${translated}${value.match(/\s*$/u)?.[0] ?? ''}`;
  }
}
