import type { VideoJsPlayer } from './video-js-contract';

const LOAD_TIMEOUT_MS = 30_000;

export class PlayerLifecycle {
  private generation = 0;
  private readonly disposeController = new AbortController();

  get signal(): AbortSignal { return this.disposeController.signal; }
  nextGeneration(): number { return ++this.generation; }
  isCurrent(generation: number): boolean { return generation === this.generation && !this.signal.aborted; }

  dispose(): void {
    this.generation += 1;
    this.disposeController.abort();
  }
}

export const combineAbortSignals = (signals: AbortSignal[]): AbortSignal => {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
};

const waitForVideoData = (video: HTMLVideoElement, target: number, signal: AbortSignal, message: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup = (): void => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('seeked', complete);
      video.removeEventListener('canplay', complete);
      video.removeEventListener('loadeddata', complete);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const complete = (): void => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || Math.abs(video.currentTime - target) > 0.5) return;
      cleanup();
      resolve();
    };
    const fail = (): void => { cleanup(); reject(new Error(message)); };
    const abort = (): void => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error(`${message} timed out.`)); }, LOAD_TIMEOUT_MS);
    video.addEventListener('seeked', complete);
    video.addEventListener('canplay', complete);
    video.addEventListener('loadeddata', complete);
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    complete();
  });

export const waitForPlyrMetadata = (video: HTMLVideoElement, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup = (): void => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', complete);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const complete = (): void => { cleanup(); resolve(); };
    const fail = (): void => { cleanup(); reject(new Error('VACNET review video failed to load metadata.')); };
    const abort = (): void => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error('VACNET review video metadata loading timed out.')); }, LOAD_TIMEOUT_MS);
    video.addEventListener('loadedmetadata', complete, { once: true });
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', abort, { once: true });
  });

export const waitForPlyrTargetData = (video: HTMLVideoElement, target: number, signal: AbortSignal): Promise<void> =>
  waitForVideoData(video, target, signal, 'VACNET review video failed while seeking.');

export const waitForVideoJsMetadata = (
  player: VideoJsPlayer,
  target: number,
  source: string,
  signal: AbortSignal,
): Promise<void> => new Promise((resolve, reject) => {
  const cleanup = (): void => {
    window.clearTimeout(timeoutId);
    player.off('loadedmetadata', complete);
    player.off('error', fail);
    signal.removeEventListener('abort', abort);
  };
  const complete = (): void => { cleanup(); player.currentTime(target); resolve(); };
  const fail = (): void => { cleanup(); reject(new Error('Valve Video.js failed to load the next source.')); };
  const abort = (): void => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
  const timeoutId = window.setTimeout(() => { cleanup(); reject(new Error('Valve Video.js metadata loading timed out.')); }, LOAD_TIMEOUT_MS);
  player.on('loadedmetadata', complete);
  player.on('error', fail);
  signal.addEventListener('abort', abort, { once: true });
  player.preload('metadata');
  player.src({ src: source, type: source.toLowerCase().includes('.webm') ? 'video/webm' : 'video/mp4' });
});

export const waitForVideoJsTargetData = (video: HTMLVideoElement, target: number, signal: AbortSignal): Promise<void> =>
  waitForVideoData(video, target, signal, 'Valve video element failed while seeking the next clip.');
