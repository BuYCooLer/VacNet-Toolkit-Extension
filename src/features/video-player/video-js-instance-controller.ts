import type { ClipRange } from '../../entities/clip';
import type { Preferences } from '../../entities/preferences';
import type { MessageCatalog } from '../../shared/i18n';
import type { VideoJsPlayer } from './video-js-contract';

const FRAME_RATE_FALLBACK = 60;

const createVideoJsMessages = (catalog: MessageCatalog): Record<string, string> => ({
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

export class VideoJsInstanceController {
  private player: VideoJsPlayer | null = null;
  private volumePlayer: VideoJsPlayer | null = null;
  private rangePlayer: VideoJsPlayer | null = null;

  find(): VideoJsPlayer | null {
    const identified = window.videojs?.getPlayer?.('video');
    this.player = identified ?? null;
    return this.player;
  }

  configure(catalog: MessageCatalog, preferences: Preferences, onVolumeChange: () => void, onTimeUpdate: () => void): VideoJsPlayer {
    const player = this.find();
    if (!player) throw new Error('Valve Video.js player was not found.');
    window.videojs?.addLanguage?.(catalog.videoJsLocale, createVideoJsMessages(catalog));
    player.language(catalog.videoJsLocale);
    this.applyPreferences(preferences);
    this.bindVolume(player, onVolumeChange);
    this.bindRange(player, onTimeUpdate);
    return player;
  }

  applyPreferences(preferences: Preferences): void {
    const player = this.player ?? this.find();
    if (!player) return;
    if (Math.abs(player.volume() - preferences.volume) > 0.001) player.volume(preferences.volume);
    if (player.muted() !== preferences.muted) player.muted(preferences.muted);
    this.videoElement()?.classList.toggle('vacnet-video-stretched', preferences.stretchVideo);
  }

  getPlayer(): VideoJsPlayer | null { return this.player ?? this.find(); }

  videoElement(): HTMLVideoElement | null {
    const root = this.player?.el();
    return root?.querySelector<HTMLVideoElement>('video.vjs-tech, #video_html5_api') ?? null;
  }

  frameDuration(): number {
    const fps = Number(this.videoElement()?.dataset.fps);
    return Number.isFinite(fps) && fps >= 20 && fps <= 240 ? 1 / fps : 1 / FRAME_RATE_FALLBACK;
  }

  clampStep(player: VideoJsPlayer, range: ClipRange, direction: -1 | 1): void {
    const lower = range.start;
    const duration = player.duration();
    const fallbackUpper = player.currentTime() + this.frameDuration();
    const upper = range.end > lower
      ? range.end
      : Number.isFinite(duration) && duration >= lower ? duration : fallbackUpper;
    const target = player.currentTime() + direction * this.frameDuration();
    player.currentTime(Math.min(upper, Math.max(lower, target)));
  }

  dispose(onVolumeChange: () => void, onTimeUpdate: () => void): void {
    this.volumePlayer?.off('volumechange', onVolumeChange);
    this.rangePlayer?.off('timeupdate', onTimeUpdate);
    this.volumePlayer = null;
    this.rangePlayer = null;
    this.player = null;
  }

  private bindVolume(player: VideoJsPlayer, handler: () => void): void {
    if (this.volumePlayer === player) return;
    this.volumePlayer?.off('volumechange', handler);
    this.volumePlayer = player;
    player.on('volumechange', handler);
  }

  private bindRange(player: VideoJsPlayer, handler: () => void): void {
    if (this.rangePlayer === player) return;
    this.rangePlayer?.off('timeupdate', handler);
    this.rangePlayer = player;
    player.on('timeupdate', handler);
  }
}
