import type { MessageCatalog } from '../shared/i18n';
import type { ClipData, ClipDeduplication } from '../domain/clip';
import { emptyVerdicts, isVerdictValue, verdictNames, type VerdictName, type VerdictSelection, type VerdictValue } from '../domain/verdict';

export class VerdictController {
  private selection: VerdictSelection = emptyVerdicts();

  constructor(
    private readonly catalog: () => MessageCatalog | null,
    private readonly onSubmit: (badClip: boolean) => void,
  ) {}

  render(force = false): boolean {
    const catalog = this.catalog();
    if (!catalog) return false;
    this.decoratePanel(catalog);
    verdictNames.forEach((name) => {
      const container = document.getElementById(`verdictbuttons_${name}`);
      if (!container) return;
      const pageValue = window.buttonStates?.[name];
      if (isVerdictValue(pageValue)) this.selection[name] = pageValue;
      const renderKey = `${name}:${this.selection[name]}`;
      if (!force && container.dataset.vacnetRender === renderKey && container.querySelectorAll('input[type="radio"]').length === 3) return;
      const fragment = document.createDocumentFragment();
      const choices: ReadonlyArray<readonly [VerdictValue, string]> = [
        ['positive', catalog.btnYes],
        ['skip', catalog.btnUncertain],
        ['negative', catalog.btnNo],
      ];
      choices.forEach(([value, text]) => {
        const wrapper = document.createElement('div');
        const input = document.createElement('input');
        const label = document.createElement('label');
        wrapper.className = `verdictbutton ${value}`;
        input.id = `${name}_${value}`;
        input.name = name;
        input.type = 'radio';
        input.value = value;
        input.checked = value === this.selection[name];
        input.addEventListener('change', () => this.set(name, value));
        label.htmlFor = input.id;
        label.textContent = text;
        wrapper.append(input, label);
        fragment.append(wrapper);
      });
      container.replaceChildren(fragment);
      container.dataset.vacnetRender = renderKey;
    });
    const submit = document.getElementById('submitbuttons');
    if (submit && (force || submit.dataset.vacnetRender !== 'ready' || !submit.querySelector('#submitVerdictButton'))) {
      submit.replaceChildren(
        this.button('submitVerdictButton', 'submitverdictbutton', catalog.btnSubmit, () => this.onSubmit(false)),
        this.button('skipClipButton', 'skipclipbutton', catalog.btnSkip, this.skip),
      );
      submit.dataset.vacnetRender = 'ready';
    }
    return true;
  }

  set(name: VerdictName, value: VerdictValue): void {
    this.selection[name] = value;
    if (window.buttonStates) window.buttonStates[name] = value;
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
    if (input && !input.checked) input.checked = true;
  }

  reset(selection: VerdictSelection = emptyVerdicts()): void {
    this.selection = { ...selection };
    if (window.buttonStates) Object.assign(window.buttonStates, selection);
    this.render(true);
  }

  selected(): VerdictSelection {
    return { ...this.selection };
  }

  primaryAction(): void {
    this.onSubmit(false);
  }

  prepareForm(badClip: boolean): HTMLFormElement | null {
    const form = document.querySelector<HTMLFormElement>('#submitverdictform');
    if (!form) return null;
    form.querySelectorAll("input[name='verdict_labels[]']").forEach((input) => input.remove());
    if (badClip) {
      form.append(this.hiddenInput('tag_badclip'));
      return form;
    }
    verdictNames.forEach((name) => {
      const value = this.selection[name];
      const prefix = value === 'positive' ? 'guilty' : value === 'negative' ? 'innocent' : 'skip';
      form.append(this.hiddenInput(`${prefix}_${name}`));
    });
    return form;
  }

  setSubmitting(active: boolean): void {
    document.querySelectorAll<HTMLButtonElement>('#submitbuttons button').forEach((button) => {
      button.disabled = active;
    });
    const status = document.getElementById('statustext');
    if (!status) return;
    if (active) {
      const text = document.createElement('p');
      text.textContent = this.catalog()?.statusLoadingNextClip ?? '';
      status.replaceChildren(text);
      status.classList.add('show');
    } else {
      status.classList.remove('show');
    }
  }

  showError(text: string): void {
    const status = document.getElementById('statustext');
    if (!status) return;
    const message = document.createElement('p');
    message.textContent = text;
    status.replaceChildren(message);
    status.classList.add('show');
  }

  renderClipSummary(clip: ClipData | null, deduplication: ClipDeduplication | null, previousVerdicts: VerdictSelection | null): void {
    const catalog = this.catalog();
    const count = document.querySelector<HTMLElement>('.vacnet-extension-clip-count');
    if (!catalog || !count) return;
    const state = deduplication ?? 'checking';
    const rangeValue = clip ? `${this.formatTime(clip.range.start)}–${this.formatTime(clip.range.end)}` : catalog.statusLoadingNextClip;
    const previousKey = previousVerdicts ? verdictNames.map((name) => previousVerdicts[name]).join('|') : '';
    const key = `${clip?.videoId ?? ''}|${rangeValue}|${state}|${previousKey}`;
    let panel = document.querySelector<HTMLElement>('.vacnet-extension-info-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'vacnet-extension-info-panel';
      count.after(panel);
    }
    let summary = document.querySelector<HTMLElement>('.vacnet-extension-clip-summary');
    if (!summary) {
      summary = document.createElement('section');
      summary.className = 'vacnet-extension-clip-summary';
      panel.append(summary);
    }
    let previous = document.querySelector<HTMLElement>('.vacnet-extension-previous-verdicts');
    if (!previous) {
      previous = document.createElement('section');
      previous.className = 'vacnet-extension-previous-verdicts';
      panel.append(previous);
    }
    if (previousVerdicts) {
      panel.classList.add('has-previous');
    } else {
      panel.classList.remove('has-previous');
    }
    if (summary.dataset.vacnetRender === key) return;
    summary.dataset.state = state;
    summary.dataset.vacnetRender = key;
    this.renderPreviousVerdicts(previous, previousVerdicts, catalog);
    const video = document.createElement('div');
    video.className = 'vacnet-extension-clip-summary-row';
    const videoLabel = document.createElement('span');
    videoLabel.textContent = catalog.clipSummaryVideo;
    const videoValue = document.createElement('strong');
    videoValue.textContent = state === 'new-match' ? catalog.clipSummaryNew : state === 'checking' ? catalog.clipSummaryChecking : catalog.clipSummaryRepeat;
    video.append(videoLabel, videoValue);
    const moment = document.createElement('div');
    moment.className = 'vacnet-extension-clip-summary-row';
    const momentLabel = document.createElement('span');
    momentLabel.textContent = catalog.clipSummaryMoment;
    const momentValue = document.createElement('strong');
    momentValue.textContent = state === 'exact-duplicate' ? catalog.clipSummaryRepeat : state === 'checking' ? catalog.clipSummaryChecking : catalog.clipSummaryNew;
    moment.append(momentLabel, momentValue);
    const rangeElement = document.createElement('p');
    rangeElement.className = 'vacnet-extension-clip-summary-range';
    rangeElement.textContent = clip ? `Время: ${this.formatTime(clip.range.start)}–${this.formatTime(clip.range.end)}` : catalog.statusLoadingNextClip;
    summary.replaceChildren(video, moment, rangeElement);
  }

  private renderPreviousVerdicts(container: HTMLElement, verdicts: VerdictSelection | null, catalog: MessageCatalog): void {
    container.hidden = verdicts === null;
    if (!verdicts) {
      container.replaceChildren();
      return;
    }
    const labels: Record<VerdictName, string> = {
      aimassist: catalog.labelAimAssist,
      wallhack: catalog.labelWallHack,
      autobhop: catalog.labelAutoBhop,
      bot: catalog.labelBot,
    };
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    for (let index = 0; index < verdictNames.length; index += 1) {
      const name = verdictNames[index];
      if (!name) continue;
      const row = document.createElement('tr');
      const label = document.createElement('th');
      const value = document.createElement('td');
      label.scope = 'row';
      label.textContent = labels[name];
      value.className = `vacnet-extension-previous-verdict-${verdicts[name]}`;
      value.textContent = this.verdictText(verdicts[name], catalog);
      row.append(label, value);
      body.append(row);
    }
    table.append(body);
    const heading = document.createElement('h3');
    heading.textContent = catalog.previousVerdicts;
    container.replaceChildren(heading, table);
  }

  private readonly skip = (): void => {
    verdictNames.forEach((name) => this.set(name, 'skip'));
    this.onSubmit(false);
  };

  private decoratePanel(catalog: MessageCatalog): void {
    const container = document.querySelector<HTMLElement>('.verdicts-container-inner');
    if (!container) return;
    let heading = container.querySelector<HTMLElement>('.vacnet-extension-verdict-heading');
    if (!heading) {
      heading = document.createElement('p');
      heading.className = 'vacnet-extension-verdict-heading';
      container.prepend(heading);
    }
    if (heading.textContent !== catalog.verdictTitle) heading.textContent = catalog.verdictTitle;
    const labels = [catalog.labelAimAssist, catalog.labelWallHack, catalog.labelAutoBhop, catalog.labelBot];
    container.querySelectorAll<HTMLElement>('.verdict-block').forEach((block, index) => {
      let category = block.querySelector<HTMLElement>('.vacnet-extension-verdict-category');
      if (!category) {
        category = document.createElement('h3');
        category.className = 'vacnet-extension-verdict-category';
        block.prepend(category);
      }
      const label = labels[index] ?? catalog.verdict;
      if (category.textContent !== label) category.textContent = label;
    });
  }

  private button(id: string, className: string, text: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', action);
    return button;
  }

  private hiddenInput(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'verdict_labels[]';
    input.value = value;
    return input;
  }

  private formatTime(value: number): string {
    const minutes = Math.floor(value / 60);
    const seconds = value - minutes * 60;
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }

  private verdictText(value: VerdictValue, catalog: MessageCatalog): string {
    return value === 'positive' ? catalog.btnYes : value === 'negative' ? catalog.btnNo : catalog.btnUncertain;
  }
}
