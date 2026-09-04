import type { ClipData, ClipRange, PlayerMetrics } from '../../entities/clip';
import type { Preferences } from '../../entities/preferences';
import type { MessageCatalog } from '../../shared/i18n';
import type { PlayerCommand } from '../../shared/protocol';
import type { PreferencesChangeHandler, ReviewPlayerPort } from './review-player-port';
import { PlayerLifecycle, combineAbortSignals, waitForVideoJsMetadata, waitForVideoJsTargetData } from './player-media';
import { VideoJsInstanceController } from './video-js-instance-controller';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled player command: ${String(value)}`);
};

export class VideoJsAdapter implements ReviewPlayerPort {
  private clip: ClipData | null = null;
  private range: ClipRange = { start: 0, end: 0 };
  private preferences: Preferences | null = null;
  private readonly lifecycle = new PlayerLifecycle();
  private readonly instance = new VideoJsInstanceController();

  constructor(
    private readonly catalog: () => MessageCatalog | null,
    private readonly onPreferences: PreferencesChangeHandler,
  ) {}

  configure(preferences: Preferences, clip: ClipData): void {
    const catalog = this.catalog();
    if (!catalog) throw new Error('Video.js cannot be configured before VACNET initialization.');

    this.clip = clip;
    this.preferences = { ...preferences };
    this.range = { ...clip.range };
    this.instance.configure(catalog, preferences, this.onVolumeChange, this.onTimeUpdate);
  }

  applyPreferences(preferences: Preferences): void {
    this.preferences = { ...preferences };
    this.instance.applyPreferences(preferences);
  }

  handle(command: PlayerCommand): void {
    const player = this.instance.getPlayer();
    if (!player) throw new Error('Valve Video.js player is unavailable.');

    switch (command.type) {
      case 'toggle-playback':
        if (player.paused()) void Promise.resolve(player.play()).catch(this.reportPlaybackError);
        else player.pause();
        return;
      case 'restart':
        player.currentTime(this.range.start);
        void Promise.resolve(player.play()).catch(this.reportPlaybackError);
        return;
      case 'toggle-zoom':
        this.instance.videoElement()?.classList.toggle('vacnet-zoom-active');
        return;
      case 'step': {
        player.pause();
        this.instance.clampStep(player, this.range, command.direction);
        return;
      }
      case 'jump-to-event': {
        if (this.clip) {
          const target = Math.max(0, this.clip.eventTime - 1.5);
          player.currentTime(target);
          void Promise.resolve(player.play()).catch(this.reportPlaybackError);
        }
        return;
      }
      case 'change-speed': {
        const video = this.instance.videoElement();
        if (video) {
          const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
          const currentSpeed = video.playbackRate || 1;
          let idx = speeds.findIndex((s) => Math.abs(s - currentSpeed) < 0.05);
          if (idx === -1) idx = 3;
          const nextIdx = Math.max(0, Math.min(speeds.length - 1, idx + command.delta));
          video.playbackRate = speeds[nextIdx];
        }
        return;
      }
    }
    assertNever(command);
  }

  metrics(): PlayerMetrics | null {
    const player = this.instance.getPlayer();
    if (!player) return null;
    return {
      id: player.id(),
      version: window.videojs?.VERSION ?? null,
      language: player.language() || null,
      debugEnabled: false,
      players: Object.keys(window.videojs?.getPlayers?.() ?? {}).length,
      frameDuration: this.instance.frameDuration(),
    };
  }

  hasVideo(): boolean {
    return this.instance.videoElement() !== null;
  }

  async load(source: string, clip: ClipData, signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const generation = this.lifecycle.nextGeneration();
    const operationSignal = combineAbortSignals([signal, this.lifecycle.signal]);
    const player = this.instance.getPlayer();
    if (!player) throw new Error('Valve Video.js player is unavailable.');
    this.clip = clip;
    this.range = { ...clip.range };
    player.pause();

    const video = this.instance.videoElement();
    video?.classList.remove('vacnet-zoom-active');
    video?.classList.add('vacnet-video-loading');
    try {
      await waitForVideoJsMetadata(player, clip.range.start, source, operationSignal);
      if (!this.lifecycle.isCurrent(generation)) throw new DOMException('Aborted', 'AbortError');
      const targetVideo = this.instance.videoElement();
      if (targetVideo) await waitForVideoJsTargetData(targetVideo, clip.range.start, operationSignal);
      if (!this.lifecycle.isCurrent(generation)) throw new DOMException('Aborted', 'AbortError');
      await Promise.resolve(player.play());
    } finally {
      if (this.lifecycle.isCurrent(generation)) video?.classList.remove('vacnet-video-loading');
    }
  }

  dispose(): void {
    this.lifecycle.dispose();
    this.instance.dispose(this.onVolumeChange, this.onTimeUpdate);
  }

  private readonly onVolumeChange = (): void => {
    const player = this.instance.getPlayer();
    if (!player) return;
    const volume = player.volume();
    const muted = player.muted();
    if (this.preferences
      && Math.abs(this.preferences.volume - volume) <= 0.001
      && this.preferences.muted === muted) return;
    this.onPreferences({ volume, muted });
  };

  private readonly onTimeUpdate = (): void => {
    const player = this.instance.getPlayer();
    if (!player || this.range.end <= this.range.start) return;
    if (player.currentTime() < this.range.end) return;
    player.pause();
    player.currentTime(this.range.end);
  };

  private readonly reportPlaybackError = (error: unknown): void => {
    const errorName = (error as { name?: string })?.name;
    if (errorName === 'NotAllowedError' || errorName === 'AbortError') {
      return;
    }
    console.warn('[VACNET] Video.js playback failed.', error);
  };
}
