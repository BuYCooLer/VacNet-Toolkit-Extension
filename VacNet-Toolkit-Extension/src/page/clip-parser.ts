import { extractVideoId, type ClipData, type ClipRange } from '../domain/clip';
import type { MessageCatalog } from '../shared/i18n';

export interface ParsedPage {
  document: Document;
  clip: ClipData;
}

interface ClipTiming {
  range: ClipRange;
  eventTime: number;
}

interface CanonicalClipTiming extends ClipTiming {
  videoId: string;
}

export class ClipParser {
  constructor(private readonly catalog: () => MessageCatalog | null) {}

  parseHtml(html: string, baseUrl: string): ParsedPage {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const source = this.source(parsed);
    const taskId = this.taskId(parsed);
    if (!source || !taskId) throw new Error(this.catalog()?.errorNextClipMissing ?? 'Next clip is missing');
    const sourceWebmUrl = new URL(source, baseUrl).href;
    const timing = this.timing(parsed);
    if (!timing) throw new Error(this.catalog()?.errorNextClipMissing ?? 'Next clip timing is missing');
    return {
      document: parsed,
      clip: {
        taskId,
        sourceWebmUrl,
        videoId: extractVideoId(sourceWebmUrl),
        range: timing.range,
        eventTime: timing.eventTime,
        clipCount: parsed.querySelector('.ClipCount')?.textContent.match(/\d+/u)?.[0] ?? null,
        app: this.app(parsed),
      },
    };
  }

  current(): ClipData | null {
    const source = this.source(document);
    const taskId = this.taskId(document);
    if (!source || !taskId) return null;
    const sourceWebmUrl = new URL(source, location.href).href;
    const canonical = this.canonicalTiming(taskId);
    // Once an AJAX clip has been synchronized, stale Valve scripts are never a source of truth.
    const timing = canonical ?? (this.hasCanonicalTiming() ? null : this.timing(document));
    if (!timing) return null;
    return {
      taskId,
      sourceWebmUrl,
      videoId: canonical?.videoId ?? extractVideoId(sourceWebmUrl),
      range: timing.range,
      eventTime: timing.eventTime,
      clipCount: document.querySelector('.ClipCount')?.textContent.match(/\d+/u)?.[0] ?? null,
      app: this.app(document),
    };
  }

  synchronize(parsed: Document): void {
    const currentForm = document.querySelector<HTMLFormElement>('#submitverdictform');
    const nextForm = parsed.querySelector<HTMLFormElement>('#submitverdictform');
    if (currentForm && nextForm) {
      currentForm.action = nextForm.action;
      currentForm.method = nextForm.method;
      const verdictNames = new Set(['aimassist', 'wallhack', 'autobhop', 'bot', 'verdict_labels[]']);
      currentForm.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        if (!verdictNames.has(input.name)) input.remove();
      });
      nextForm.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        if (!verdictNames.has(input.name)) currentForm.append(input.cloneNode(true));
      });
    }
    const selectors = ['#detailsModalContent', '.perf_timing_area', '.modalgraph', '.evidencelog', '.accountdata', '.datasourcetable'];
    selectors.forEach((selector) => {
      const current = document.querySelector(selector);
      const next = parsed.querySelector(selector);
      if (current && next) current.replaceChildren(...Array.from(next.childNodes).map((node) => node.cloneNode(true)));
    });
    const nextCount = parsed.querySelector('.ClipCount')?.textContent.match(/\d+/u)?.[0];
    const currentCount = document.querySelector<HTMLElement>('.ClipCount');
    if (nextCount && currentCount) this.updateClipCount(currentCount, nextCount);
  }

  storeCanonicalTiming(clip: ClipData): void {
    const state = document.documentElement.dataset;
    state.vacnetClipTaskId = clip.taskId;
    state.vacnetClipVideoId = clip.videoId;
    state.vacnetClipStartTime = String(clip.range.start);
    state.vacnetClipEndTime = String(clip.range.end);
    state.vacnetClipEventTime = String(clip.eventTime);
  }

  private timing(root: Document): ClipTiming | null {
    const element = root.querySelector<HTMLElement>('[data-start-time], [data-clip-start]');
    const startAttribute = element?.dataset.startTime ?? element?.dataset.clipStart;
    const endAttribute = element?.dataset.endTime ?? element?.dataset.clipEnd;
    if (startAttribute !== undefined || endAttribute !== undefined) {
      return this.createTiming(Number(startAttribute), Number(endAttribute), Number(element?.dataset.eventTime));
    }
    for (const script of Array.from(root.scripts)) {
      const timing = this.timingFromScript(script.textContent);
      if (timing) return timing;
    }
    return null;
  }

  private timingFromScript(source: string): ClipTiming | null {
    if (!/videojs\s*\(\s*['"]video['"]\s*\)/u.test(source)) return null;
    const declarations = new Map<string, string>();
    const declarationPattern = /(?:^|[;\n])\s*(?:const|let|var)\s+(startTime|endTime|eventTime)\s*=\s*([^;\n]+)/gu;
    for (const match of source.matchAll(declarationPattern)) {
      const name = match[1];
      const expression = match[2];
      if (name && expression) declarations.set(name, expression.trim());
    }
    const start = this.numericExpression(declarations.get('startTime'), 0);
    if (start === null) return null;
    const end = this.numericExpression(declarations.get('endTime'), start);
    const eventTime = this.numericExpression(declarations.get('eventTime'), start);
    if (end === null || eventTime === null) return null;
    return this.createTiming(start, end, eventTime);
  }

  private numericExpression(expression: string | undefined, start: number): number | null {
    if (!expression) return null;
    const numeric = Number(expression);
    if (Number.isFinite(numeric)) return numeric;
    const offset = expression.match(/^startTime\s*([+-])\s*(\d+(?:\.\d+)?)$/u);
    if (!offset) return null;
    const value = Number(offset[2]);
    return offset[1] === '-' ? start - value : start + value;
  }

  private createTiming(start: number, end: number, eventTime: number): ClipTiming | null {
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end <= start || !Number.isFinite(eventTime) || eventTime < 0) return null;
    return { range: { start, end }, eventTime };
  }

  private app(root: Document): string {
    let app = '';
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('#detailsModalContent .detailstable tr, .detailstable tr'));
    rows.forEach((row) => {
      const key = row.cells[0]?.textContent.trim().toLowerCase() ?? '';
      const value = row.cells[1]?.textContent.trim() ?? '';
      if (/^(?:app|application|приложение)$/iu.test(key)) app = value;
    });
    if (!app && rows[1]?.cells[1]?.textContent) app = rows[1].cells[1].textContent.trim();
    return app || '730';
  }

  private source(root: Document): string | null {
    const video = root.querySelector<HTMLVideoElement>('#video_html5_api, video#video, #video video');
    const sourceElement = root.querySelector<HTMLSourceElement>('#video source, video#video source, video source');
    const source = video?.currentSrc || video?.getAttribute('src') || sourceElement?.getAttribute('src') || video?.src || sourceElement?.src;
    return source?.trim() || null;
  }

  private taskId(root: Document): string | null {
    const formValue = root.querySelector<HTMLInputElement>("#submitverdictform input[name='verdict_task']")?.value.trim();
    if (formValue) return formValue;
    const detailValue = root.querySelector<HTMLAnchorElement>("#detailsModalContent .detailstable a[href*='/vacnet/view']")?.textContent.trim();
    return detailValue || null;
  }

  private canonicalTiming(taskId: string): CanonicalClipTiming | null {
    const state = document.documentElement.dataset;
    if (state.vacnetClipTaskId !== taskId) return null;
    const videoId = state.vacnetClipVideoId?.trim();
    if (!videoId) return null;
    const timing = this.createTiming(Number(state.vacnetClipStartTime), Number(state.vacnetClipEndTime), Number(state.vacnetClipEventTime));
    return timing ? { ...timing, videoId } : null;
  }

  private hasCanonicalTiming(): boolean {
    return document.documentElement.dataset.vacnetClipTaskId !== undefined;
  }

  private updateClipCount(element: HTMLElement, count: string): void {
    if (element.children.length > 0) {
      Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .forEach((node) => node.remove());
      element.append(` ${count}`);
      return;
    }
    const label = element.textContent.trim();
    element.textContent = /\d+/u.test(label) ? label.replace(/\d+/u, count) : `${label} ${count}`;
  }
}
