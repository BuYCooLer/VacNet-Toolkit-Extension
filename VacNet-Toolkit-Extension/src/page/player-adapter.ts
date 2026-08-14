import type { ClipRange, PlayerMetrics } from '../domain/clip';
import type { Preferences } from '../domain/preferences';
import type { MessageCatalog } from '../shared/i18n';
import type { VideoJsPlayer } from './page-types';

export class VideoJsAdapter {
  private player: VideoJsPlayer | null = null;
  private range: ClipRange = { start: 0, end: 0 };
  private preferences: Preferences | null = null;
  private volumeBound = false;
  private volumePlayer: VideoJsPlayer | null = null;

  constructor(
    private readonly catalog: () => MessageCatalog | null,
    private readonly onPreferences: (preferences: Partial<Preferences>) => void,
  ) {}

  find(): VideoJsPlayer | null {
    const video = document.getElementById('video') as (HTMLVideoElement & { player?: VideoJsPlayer }) | null;
    const direct = video?.player;
    const identified = window.videojs?.getPlayer?.('video');
    const players = window.videojs?.getPlayers?.() ?? {};
    this.player = direct ?? identified ?? Object.values(players)[0] ?? null;
    return this.player;
  }

  configure(preferences: Preferences, range: ClipRange): boolean {
    const player = this.find();
    const catalog = this.catalog();
    if (!player || !catalog) return false;
    this.preferences = preferences;
    this.setRange(range);
    window.videojs?.addLanguage?.(catalog.videoJsLocale, {
      Play: catalog.videoJsPlay,
      Pause: catalog.videoJsPause,
      Mute: catalog.videoJsMute,
      Unmute: catalog.videoJsUnmute,
      Fullscreen: catalog.videoJsFullscreen,
      'Exit Fullscreen': catalog.videoJsExitFullscreen,
      Close: catalog.videoJsClose,
      'Video Player': catalog.videoJsVideoPlayer,
      'Progress Bar': catalog.videoJsProgressBar,
      'Volume Level': catalog.videoJsVolumeLevel,
      'Playback Rate': catalog.videoJsPlaybackRate,
      Captions: catalog.videoJsCaptions,
      Subtitles: catalog.videoJsSubtitles,
      Reset: catalog.videoJsReset,
      Done: catalog.videoJsDone,
    });
    player.language(catalog.videoJsLocale);
    window.videojs?.log?.level('debug');
    const video = this.videoElement();
    video?.removeAttribute('width');
    video?.removeAttribute('height');
    this.applyPreferences(preferences);
    this.bindVolume();
    return true;
  }

  applyPreferences(preferences: Preferences): void {
    this.preferences = preferences;
    const player = this.player ?? this.find();
    if (player) {
      if (Math.abs(player.volume() - preferences.volume) > 0.001) player.volume(preferences.volume);
      if (player.muted() !== preferences.muted) player.muted(preferences.muted);
    }
    this.videoElement()?.classList.toggle('vacnet-video-stretched', preferences.stretchVideo);
  }

  setRange(range: ClipRange): void {
    this.range = { start: range.start, end: range.end };
  }

  metrics(): PlayerMetrics | null {
    const player = this.player ?? this.find();
    if (!player) return null;
    return {
      id: player.id(),
      version: window.videojs?.VERSION ?? null,
      language: player.language() || null,
      debugEnabled: true,
      players: Object.keys(window.videojs?.getPlayers?.() ?? {}).length,
      frameDuration: this.frameDuration(),
    };
  }

  async load(source: string, range: ClipRange, signal: AbortSignal): Promise<void> {
    const player = this.player ?? this.find();
    if (!player) throw new Error(this.catalog()?.errorPlayerOrFormUnavailable ?? 'Player unavailable');
    this.setRange(range);
    player.pause();
    const video = this.videoElement();
    video?.classList.add('vacnet-video-loading');
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error(this.catalog()?.errorNextClipLoad ?? 'Video load timed out'));
        }, 30_000);
        const complete = (): void => {
          cleanup();
          player.currentTime(range.start);
          resolve();
        };
        const fail = (): void => {
          cleanup();
          reject(new Error(this.catalog()?.errorNextClipLoad ?? 'Video failed to load'));
        };
        const abort = (): void => {
          cleanup();
          reject(new DOMException('Aborted', 'AbortError'));
        };
        const cleanup = (): void => {
          window.clearTimeout(timeout);
          player.off('loadedmetadata', complete);
          player.off('error', fail);
          signal.removeEventListener('abort', abort);
        };
        player.on('loadedmetadata', complete);
        player.on('error', fail);
        signal.addEventListener('abort', abort, { once: true });
        player.preload('metadata');
        player.src({ src: source, type: source.toLowerCase().includes('.webm') ? 'video/webm' : 'video/mp4' });
      });
      player.currentTime(range.start);
      const targetVideo = this.videoElement();
      if (targetVideo) await this.waitForTargetData(targetVideo, range.start, signal);
      if (!signal.aborted) await Promise.resolve(player.play());
    } finally {
      video?.classList.remove('vacnet-video-loading');
    }
  }

  togglePlayback(): void {
    const player = this.player ?? this.find();
    if (!player) return;
    if (player.paused()) void Promise.resolve(player.play());
    else player.pause();
  }

  restart(): void {
    const player = this.player ?? this.find();
    if (!player) return;
    player.currentTime(this.range.start);
    void Promise.resolve(player.play());
  }

  toggleZoom(): void {
    this.videoElement()?.classList.toggle('vacnet-zoom-active');
  }

  step(direction: -1 | 1): void {
    const player = this.player ?? this.find();
    if (!player) return;
    player.pause();
    const lower = this.range.start;
    const duration = player.duration();
    const upper = this.range.end > lower ? this.range.end : Number.isFinite(duration) ? duration : player.currentTime() + this.frameDuration();
    player.currentTime(Math.min(upper, Math.max(lower, player.currentTime() + direction * this.frameDuration())));
  }

  dispose(): void {
    this.volumePlayer?.off('volumechange', this.onVolumeChange);
    this.volumePlayer = null;
    this.volumeBound = false;
  }

  private bindVolume(): void {
    const player = this.player;
    if (!player || this.volumeBound) return;
    this.volumeBound = true;
    this.volumePlayer = player;
    player.on('volumechange', this.onVolumeChange);
  }

  private videoElement(): HTMLVideoElement | null {
    const root = this.player?.el() ?? document;
    return root.querySelector('video.vjs-tech, #video_html5_api');
  }

  private frameDuration(): number {
    const video = this.videoElement();
    const fps = Number(video?.dataset.fps);
    return Number.isFinite(fps) && fps >= 20 && fps <= 240 ? 1 / fps : 1 / 60;
  }

  private waitForTargetData(video: HTMLVideoElement, target: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error(this.catalog()?.errorNextClipLoad ?? 'Video target load timed out'));
      }, 30_000);
      const complete = (): void => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || Math.abs(video.currentTime - target) > 0.5) return;
        cleanup();
        resolve();
      };
      const abort = (): void => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const fail = (): void => {
        cleanup();
        reject(new Error(this.catalog()?.errorNextClipLoad ?? 'Video failed to load'));
      };
      const cleanup = (): void => {
        window.clearTimeout(timeout);
        video.removeEventListener('seeked', complete);
        video.removeEventListener('canplay', complete);
        video.removeEventListener('loadeddata', complete);
        video.removeEventListener('error', fail);
        signal.removeEventListener('abort', abort);
      };
      video.addEventListener('seeked', complete);
      video.addEventListener('canplay', complete);
      video.addEventListener('loadeddata', complete);
      video.addEventListener('error', fail);
      signal.addEventListener('abort', abort, { once: true });
      complete();
    });
  }

  private readonly onVolumeChange = (): void => {
    const player = this.volumePlayer;
    if (!player) return;
    const volume = player.volume();
    const muted = player.muted();
    if (!this.preferences || Math.abs(this.preferences.volume - volume) > 0.001 || this.preferences.muted !== muted) {
      this.onPreferences({ volume, muted });
    }
  };
}
