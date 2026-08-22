import type { ClipData, ClipRange, PlayerMetrics } from '../../entities/clip';
import type { Preferences } from '../../entities/preferences';
import type { MessageCatalog } from '../../shared/i18n';
import type { PlayerCommand } from '../../shared/protocol';
import type { ReviewVideoHostPort } from '../../shared/review-video-host';
import type { PreferencesChangeHandler, ReviewPlayerPort } from './review-player-port';
import { PlayerLifecycle, waitForPlyrMetadata, waitForPlyrTargetData } from './player-media';
import { PlyrInstanceController } from './plyr-instance-controller';
const FRAME_RATE_FALLBACK = 60;
const PLYR_VERSION = '3.8.4';
const assertNever = (value: never): never => {
  throw new Error(`Unhandled player command: ${String(value)}`);
};

export class PlyrAdapter implements ReviewPlayerPort {
  private range: ClipRange = { start: 0, end: 0 };
  private clip: ClipData | null = null;
  private overlayElement: HTMLDivElement | null = null;
  private preferences: Preferences | null = null;
  private isLoopTransitioning = false;
  private stepTargetTime: number | null = null;
  private stepTimeoutId: number | null = null;
  private readonly lifecycle = new PlayerLifecycle();
  private readonly instance: PlyrInstanceController;

  constructor(
    private readonly playerHost: ReviewVideoHostPort,
    private readonly catalog: () => MessageCatalog | null,
    private readonly onPreferences: PreferencesChangeHandler,
  ) { this.instance = new PlyrInstanceController(playerHost); }

  configure(preferences: Preferences, clip: ClipData): void {
    this.preferences = { ...preferences };
    this.clip = clip;
    this.requireVideo();
    this.range = {
      start: clip.range.start < 1 ? 0 : clip.range.start,
      end: (clip.range.end - clip.range.start) <= 60 ? 999999 : clip.range.end,
    };
    this.applyPreferences(preferences);
  }

  applyPreferences(preferences: Preferences): void {
    this.preferences = { ...preferences };
    this.instance.applyPreferences(this.preferences);
    this.instance.element?.classList.toggle('vacnet-video-stretched', preferences.stretchVideo);
    this.instance.updateVolumeTooltip();
  }

  handle(command: PlayerCommand): void {
    const video = this.requireVideo();

    switch (command.type) {
      case 'toggle-playback':
        if (video.paused) void this.play(video);
        else video.pause();
        return;
      case 'restart':
        void this.restartRange(video);
        return;
      case 'toggle-zoom':
        this.instance.element?.classList.toggle('vacnet-zoom-active');
        return;
      case 'step': {
        video.pause();
        const clamped = this.calculateStepTime(video, command.direction);
        this.stepTargetTime = clamped;
        video.currentTime = clamped;
        this.resetStepTimeout();
        return;
      }
    }
    assertNever(command);
  }

  async load(source: string, clip: ClipData, signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const generation = this.lifecycle.nextGeneration();
    const operationSignal = AbortSignal.any([signal, this.lifecycle.signal]);
    this.clip = clip;
    const video = this.requireVideo();
    this.range = {
      start: clip.range.start < 1 ? 0 : clip.range.start,
      end: (clip.range.end - clip.range.start) <= 60 ? 999999 : clip.range.end,
    };
    video.pause();
    this.instance.element?.classList.add('vacnet-video-loading');

    try {
       const metadata = waitForPlyrMetadata(video, operationSignal);
      video.src = source;
       video.load();
       await metadata;
        if (!this.lifecycle.isCurrent(generation)) throw new DOMException('Aborted', 'AbortError');
       video.currentTime = this.range.start;
       const t = this.catalog();
       this.instance.updateMarker(clip, t?.triggerMarkerLabel ?? '');
       await waitForPlyrTargetData(video, this.range.start, operationSignal);
        if (!this.lifecycle.isCurrent(generation)) throw new DOMException('Aborted', 'AbortError');
       await this.play(video);
    } finally {
      if (this.lifecycle.isCurrent(generation)) this.instance.element?.classList.remove('vacnet-video-loading');
    }
  }

  metrics(): PlayerMetrics | null {
    const video = this.instance.video;
    if (!video) return null;
    return {
      id: video.id,
      version: this.instance.isPlyr ? PLYR_VERSION : null,
      language: document.documentElement.lang || null,
      debugEnabled: true,
      players: 1,
      frameDuration: this.frameDuration(video),
    };
  }

  hasVideo(): boolean {
    return this.instance.video?.isConnected ?? false;
  }

  dispose(): void {
    this.lifecycle.dispose();
    if (this.stepTimeoutId !== null) window.clearTimeout(this.stepTimeoutId);
    this.stepTimeoutId = null;
    this.stepTargetTime = null;
    this.instance.dispose((video) => this.removeVideoListeners(video));
  }

  private requireVideo(): HTMLVideoElement {
    const t = this.catalog();
    const markerLabel = t?.triggerMarkerLabel ?? '';
    const video = this.instance.ensureMounted(this.preferences, this.clip, markerLabel, (element) => this.addVideoListeners(element));
    if (!this.overlayElement && this.instance.element) {
      const overlay = document.createElement('div');
      overlay.className = 'vacnet-trigger-overlay';
      this.instance.element.appendChild(overlay);
      this.overlayElement = overlay;
    }
    return video;
  }

  private addVideoListeners(video: HTMLVideoElement): void {
    video.addEventListener('volumechange', this.onVolumeChange);
    video.addEventListener('timeupdate', this.onTimeUpdate);
    video.addEventListener('ended', this.onEnded);
  }

  private removeVideoListeners(video: HTMLVideoElement): void {
    video.removeEventListener('volumechange', this.onVolumeChange);
    video.removeEventListener('timeupdate', this.onTimeUpdate);
    video.removeEventListener('ended', this.onEnded);
  }

  private frameDuration(video: HTMLVideoElement): number {
    const framesPerSecond = Number(video.dataset.fps);
    return Number.isFinite(framesPerSecond) && framesPerSecond >= 20 && framesPerSecond <= 240
      ? 1 / framesPerSecond
      : 1 / FRAME_RATE_FALLBACK;
  }

  private async restartRange(video: HTMLVideoElement): Promise<void> {
    if (this.isLoopTransitioning) return;
    this.isLoopTransitioning = true;
    try {
      video.pause();
      video.currentTime = this.range.start;
      await this.play(video);
    } finally {
      this.isLoopTransitioning = false;
    }
  }

  private readonly onVolumeChange = (): void => {
    const video = this.instance.video;
    if (!video || !this.preferences) return;
    
    this.instance.updateVolumeTooltip();

    if (Math.abs(this.preferences.volume - video.volume) <= 0.001 && this.preferences.muted === video.muted) return;
    this.onPreferences({ volume: video.volume, muted: video.muted });
  };

  private readonly onTimeUpdate = (): void => {
    const video = this.instance.video;
    
    if (this.overlayElement && this.clip) {
      const timeToTrigger = this.clip.eventTime - (video?.currentTime ?? 0);
      const t = this.catalog();
      if (timeToTrigger > 1 && timeToTrigger <= 4) {
        const message = t ? t.triggerCountdown.replace('[time]', String(Math.ceil(timeToTrigger - 1))) : '';
        this.overlayElement.textContent = message;
        this.overlayElement.className = 'vacnet-trigger-overlay vacnet-trigger-countdown';
      } else if (timeToTrigger <= 1 && timeToTrigger >= -1) {
        this.overlayElement.textContent = t ? t.triggerFlash : '';
        this.overlayElement.className = 'vacnet-trigger-overlay vacnet-trigger-flash';
      } else {
        this.overlayElement.className = 'vacnet-trigger-overlay';
      }
    }

    if (!video || video.currentTime < this.range.end || video.paused) return;
    video.pause();
    video.currentTime = this.range.end;
  };

  private readonly onEnded = (): void => {
    const video = this.instance.video;
    if (!video || video.currentTime < this.range.end) return;
    video.currentTime = this.range.end;
  };

  private calculateStepTime(video: HTMLVideoElement, direction: number): number {
    const baseTime = this.stepTargetTime !== null ? this.stepTargetTime : video.currentTime;
    const upper = this.range.end > this.range.start
      ? this.range.end
      : Number.isFinite(video.duration) && video.duration >= this.range.start
        ? video.duration
        : baseTime + this.frameDuration(video);
    const target = baseTime + direction * this.frameDuration(video);
    const lower = this.range.end > this.range.start ? this.range.start : 0;
    return Math.min(upper, Math.max(lower, target));
  }

  private resetStepTimeout(): void {
    if (this.stepTimeoutId !== null) window.clearTimeout(this.stepTimeoutId);
    this.stepTimeoutId = window.setTimeout(() => {
      this.stepTargetTime = null;
      this.stepTimeoutId = null;
    }, 150);
  }

  private async play(video: HTMLVideoElement): Promise<void> {
    try {
      await video.play();
    } catch (error) {
      console.error('[VACNET] Review video playback failed.', error);
    }
  }
}
