import Plyr from 'plyr';
import type { ClipData } from '../../entities/clip';
import plyrSprite from '../../../node_modules/plyr/dist/plyr.svg?raw';
import type { Preferences } from '../../entities/preferences';
import type { ReviewVideoHost, ReviewVideoHostPort } from '../../shared/review-video-host';

export type ReviewPlayerMode = 'plyr' | 'native-fallback';

export const getReviewPlayerMode = (): ReviewPlayerMode => {
  try { return sessionStorage.getItem('vacnet:player-mode') === 'native-fallback' ? 'native-fallback' : 'plyr'; }
  catch { return 'plyr'; }
};

export class PlyrInstanceController {
  private host: ReviewVideoHost | null = null;
  private plyr: Plyr | null = null;
  private spriteContainer: HTMLDivElement | null = null;
  private mode: ReviewPlayerMode = getReviewPlayerMode();

  constructor(private readonly playerHost: ReviewVideoHostPort) {}

  get video(): HTMLVideoElement | null { return this.host?.video ?? null; }
  get element(): HTMLDivElement | null { return this.host?.element ?? null; }
  get isPlyr(): boolean { return this.plyr !== null; }
  get playerMode(): ReviewPlayerMode { return this.mode; }

  ensureMounted(preferences: Preferences | null, clip: ClipData | null, markerLabel: string, addListeners: (video: HTMLVideoElement) => void): HTMLVideoElement {
    if (this.host?.video.isConnected) return this.host.video;
    this.host = this.playerHost.mount();
    addListeners(this.host.video);
    this.applyPreferences(preferences);
    if (this.mode === 'native-fallback') return this.host.video;
    this.ensureSprite();
    try {
      const plyrConfig: ConstructorParameters<typeof Plyr>[1] = {
        autoplay: false,
        clickToPlay: true,
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'fullscreen'],
        keyboard: { focused: false, global: false },
        invertTime: false,
        loadSprite: false,
        storage: { enabled: false },
      };
      if (clip?.eventTime != null) {
        plyrConfig.markers = {
          enabled: true,
          points: [{ time: clip.eventTime, label: markerLabel }],
        };
      }
      this.plyr = new Plyr(this.host.video, plyrConfig);
      this.host.video.controls = false;
      this.applyPreferences(preferences);
      this.updateVolumeTooltip();
    } catch (error) {
      try { this.plyr?.destroy(); } catch (error) { console.warn('[VACNET] Plyr disposal failed.', error); }
      this.plyr = null;
      this.mode = 'native-fallback';
      this.host.video.controls = true;
      console.warn('[VACNET] Plyr initialization failed; using native controls.', error);
    }
    return this.host.video;
  }

  updateMarker(clip: ClipData | null, markerLabel: string): void {
    if (!this.plyr || !this.host?.element) return;
    const progressContainer = this.host.element.querySelector('.plyr__progress');
    if (!progressContainer) return;

    progressContainer.querySelectorAll('.plyr__progress__marker').forEach(el => el.remove());

    if (clip?.eventTime != null && this.host.video.duration) {
      const left = (clip.eventTime / this.host.video.duration) * 100;
      const marker = document.createElement('span');
      marker.className = 'plyr__progress__marker';
      marker.title = markerLabel;
      marker.style.left = `${left}%`;
      progressContainer.appendChild(marker);
    }
  }

  applyPreferences(preferences: Preferences | null): void {
    if (!preferences || !this.host) return;
    this.host.element.classList.toggle('vacnet-keep-controls', preferences.keepControlsVisible);
    if (this.plyr) {
      if (Math.abs(this.plyr.volume - preferences.volume) > 0.001) this.plyr.volume = preferences.volume;
      if (this.plyr.muted !== preferences.muted) this.plyr.muted = preferences.muted;
    } else {
      if (Math.abs(this.host.video.volume - preferences.volume) > 0.001) this.host.video.volume = preferences.volume;
      if (this.host.video.muted !== preferences.muted) this.host.video.muted = preferences.muted;
    }
    const volumeInput = this.host.element.querySelector<HTMLInputElement>('input[data-plyr="volume"]');
    if (volumeInput) {
      volumeInput.step = '0.01';
      volumeInput.style.setProperty('--value', `${preferences.volume * 100}%`);
      volumeInput.value = preferences.volume.toString();
    }
  }

  updateVolumeTooltip(): void {
    const volumeContainer = this.host?.element.querySelector('.plyr__volume');
    const video = this.host?.video;
    if (!video || !volumeContainer) return;
    volumeContainer.setAttribute('data-volume', video.muted ? '0%' : `${Math.round(video.volume * 100)}%`);
  }

  dispose(removeListeners: (video: HTMLVideoElement) => void): void {
    const video = this.host?.video;
    if (video) { video.pause(); removeListeners(video); }
    try { this.plyr?.destroy(); } catch (error) { console.warn('[VACNET] Plyr disposal failed.', error); }
    this.plyr = null;
    this.host = null;
    this.spriteContainer?.remove();
    this.spriteContainer = null;
    this.playerHost.dispose();
  }

  private ensureSprite(): void {
    if (document.getElementById('vacnet-plyr-sprite')) return;
    const container = document.createElement('div');
    container.id = 'vacnet-plyr-sprite';
    container.style.display = 'none';
    container.innerHTML = plyrSprite;
    document.body.prepend(container);
    this.spriteContainer = container;
  }
}
