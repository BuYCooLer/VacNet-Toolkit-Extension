import Plyr from 'plyr';
import type { ClipData } from '../../entities/clip';
import plyrSprite from '../../../node_modules/plyr/dist/plyr.svg?raw';
import type { Preferences } from '../../entities/preferences';
import type { ReviewVideoHost, ReviewVideoHostPort } from '../../shared/review-video-host';

export type ReviewPlayerMode = 'plyr' | 'native-fallback';

interface PlayerControlLabels {
  play: string;
  pause: string;
  restart: string;
  volume: string;
  settings: string;
  enterFullscreen: string;
  exitFullscreen: string;
  share: string;
  copied: string;
}

export const getReviewPlayerMode = (): ReviewPlayerMode => {
  try { return sessionStorage.getItem('vacnet:player-mode') === 'native-fallback' ? 'native-fallback' : 'plyr'; }
  catch { return 'plyr'; }
};

export class PlyrInstanceController {
  private host: ReviewVideoHost | null = null;
  private plyr: Plyr | null = null;
  private spriteContainer: HTMLDivElement | null = null;
  private volumeContainer: HTMLDivElement | null = null;
  private volumePopup: HTMLDivElement | null = null;
  private volumeSliderTrack: HTMLDivElement | null = null;
  private volumeSlider: HTMLInputElement | null = null;
  private volumePercentage: HTMLOutputElement | null = null;
  private muteButton: HTMLButtonElement | null = null;
  private settingsButton: HTMLButtonElement | null = null;
  private settingsPopup: HTMLDivElement | null = null;
  private shareButton: HTMLButtonElement | null = null;
  private shareTooltip: HTMLElement | null = null;
  private shareFeedbackTimeoutId: number | null = null;
  private shareLabel = '';
  private copiedLabel = '';
  private progressElement: HTMLElement | null = null;
  private seekInput: HTMLInputElement | null = null;
  private seekTooltip: HTMLElement | null = null;
  private progressFrameId: number | null = null;
  private mode: ReviewPlayerMode = getReviewPlayerMode();

  constructor(private readonly playerHost: ReviewVideoHostPort) {}

  get video(): HTMLVideoElement | null { return this.host?.video ?? null; }
  get element(): HTMLDivElement | null { return this.host?.element ?? null; }
  get isPlyr(): boolean { return this.plyr !== null; }
  get playerMode(): ReviewPlayerMode { return this.mode; }

  ensureMounted(preferences: Preferences | null, clip: ClipData | null, markerLabel: string, labels: PlayerControlLabels, addListeners: (video: HTMLVideoElement) => void): HTMLVideoElement {
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
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'settings', 'fullscreen'],
        i18n: {
          play: labels.play,
          pause: labels.pause,
          restart: labels.restart,
          volume: labels.volume,
          mute: labels.volume,
          unmute: labels.volume,
          settings: labels.settings,
          enterFullscreen: labels.enterFullscreen,
          exitFullscreen: labels.exitFullscreen,
        },
        keyboard: { focused: false, global: false },
        invertTime: false,
        loadSprite: false,
        storage: { enabled: false },
        tooltips: { controls: true, seek: true },
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
      this.setupPreciseProgress();
      this.setupVolumePopup();
      this.setupShareButton(labels.share, labels.copied);
      this.updateVolumePopup();
    } catch (error) {
      this.disposePreciseProgress();
      this.disposeVolumePopup();
      this.disposeShareButton();
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
    this.updateVolumePopup();
  }

  updateVolumePopup(): void {
    const video = this.host?.video;
    if (!video || !this.volumeSlider || !this.volumePercentage) return;
    const volume = video.muted ? 0 : video.volume;
    this.volumeSlider.value = volume.toString();
    this.volumeSliderTrack?.style.setProperty('--value-height', `${volume * 120}px`);
    this.volumePercentage.value = `${Math.round(volume * 100)}%`;
  }

  dispose(removeListeners: (video: HTMLVideoElement) => void): void {
    const video = this.host?.video;
    if (video) { video.pause(); removeListeners(video); }
    this.disposePreciseProgress();
    this.disposeVolumePopup();
    this.disposeShareButton();
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

  private setupShareButton(label: string, copiedLabel: string): void {
    const controls = this.host?.element.querySelector<HTMLElement>('.plyr__controls');
    const fullscreenButton = controls?.querySelector<HTMLButtonElement>('button[data-plyr="fullscreen"]');
    if (!controls || !fullscreenButton || controls.querySelector('.vacnet-share-clip')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plyr__controls__item plyr__control vacnet-share-clip';
    button.setAttribute('aria-label', label);

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21.7 10.3l-7-7A1 1 0 0013 4v3.1C6.6 7.6 2.7 11 1.1 17.6a1 1 0 001.7.9c2.8-3.1 5.8-4.6 10.2-4.8V17a1 1 0 001.7.7l7-7a1 1 0 000-1.4z');
    icon.append(path);

    const tooltip = document.createElement('span');
    tooltip.className = 'plyr__tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-live', 'polite');
    tooltip.textContent = label;
    button.append(icon, tooltip);
    button.addEventListener('click', this.onShareButtonClick);
    fullscreenButton.before(button);
    this.shareButton = button;
    this.shareTooltip = tooltip;
    this.shareLabel = label;
    this.copiedLabel = copiedLabel;
  }

  private disposeShareButton(): void {
    if (this.shareFeedbackTimeoutId !== null) window.clearTimeout(this.shareFeedbackTimeoutId);
    this.shareFeedbackTimeoutId = null;
    this.shareButton?.removeEventListener('click', this.onShareButtonClick);
    this.shareButton?.remove();
    this.shareButton = null;
    this.shareTooltip = null;
    this.shareLabel = '';
    this.copiedLabel = '';
  }

  private readonly onShareButtonClick = (): void => {
    const shareUrl = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/vacnet/view?"]'))
      .map((link) => new URL(link.href, document.baseURI))
      .find((url) => url.pathname === '/vacnet/view' && url.searchParams.has('s'));
    if (!shareUrl) {
      console.warn('[VACNET] Clip share link was not found.');
      return;
    }

    this.closeVolumePopup();
    this.closeSettingsPopup();
    void navigator.clipboard.writeText(shareUrl.href)
      .then(() => this.showShareCopiedFeedback())
      .catch((error: unknown) => {
        console.error('[VACNET] Could not copy the clip share link.', error);
      });
  };

  private showShareCopiedFeedback(): void {
    if (!this.shareButton || !this.shareTooltip) return;
    if (this.shareFeedbackTimeoutId !== null) window.clearTimeout(this.shareFeedbackTimeoutId);
    this.shareButton.setAttribute('aria-label', this.copiedLabel);
    this.shareTooltip.textContent = this.copiedLabel;
    this.shareTooltip.classList.add('plyr__tooltip--visible');
    this.shareFeedbackTimeoutId = window.setTimeout(() => {
      this.shareButton?.setAttribute('aria-label', this.shareLabel);
      if (this.shareTooltip) {
        this.shareTooltip.textContent = this.shareLabel;
        this.shareTooltip.classList.remove('plyr__tooltip--visible');
      }
      this.shareFeedbackTimeoutId = null;
    }, 1800);
  }

  private setupPreciseProgress(): void {
    const element = this.host?.element;
    const video = this.host?.video;
    if (!element || !video) return;

    this.progressElement = element.querySelector<HTMLElement>('.plyr__progress');
    this.seekInput = this.progressElement?.querySelector<HTMLInputElement>('input[data-plyr="seek"]') ?? null;
    this.seekTooltip = this.progressElement?.querySelector<HTMLElement>('.plyr__tooltip') ?? null;
    this.progressElement?.addEventListener('mouseenter', this.onSeekHover);
    this.progressElement?.addEventListener('mousemove', this.onSeekHover);
    video.addEventListener('play', this.startProgressAnimation);
    video.addEventListener('pause', this.stopProgressAnimation);
    video.addEventListener('ended', this.stopProgressAnimation);
    if (!video.paused) this.startProgressAnimation();
  }

  private disposePreciseProgress(): void {
    this.progressElement?.removeEventListener('mouseenter', this.onSeekHover);
    this.progressElement?.removeEventListener('mousemove', this.onSeekHover);
    const video = this.host?.video;
    video?.removeEventListener('play', this.startProgressAnimation);
    video?.removeEventListener('pause', this.stopProgressAnimation);
    video?.removeEventListener('ended', this.stopProgressAnimation);
    this.stopProgressAnimation();
    this.progressElement = null;
    this.seekInput = null;
    this.seekTooltip = null;
  }

  private readonly onSeekHover = (event: MouseEvent): void => {
    const video = this.host?.video;
    const progress = this.progressElement;
    const tooltip = this.seekTooltip;
    if (!video || !progress || !tooltip || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const bounds = progress.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const preciseTime = this.formatPreciseTime(video.duration * ratio);
    const lastNode = tooltip.lastChild;
    if (lastNode?.nodeType === Node.TEXT_NODE) lastNode.nodeValue = preciseTime;
    else tooltip.textContent = preciseTime;
  };

  private readonly startProgressAnimation = (): void => {
    if (this.progressFrameId !== null) return;
    const update = (): void => {
      this.progressFrameId = null;
      const video = this.host?.video;
      const seek = this.seekInput;
      if (!video || !seek || video.paused || video.ended) return;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const value = Math.min(100, Math.max(0, (video.currentTime / video.duration) * 100));
        seek.value = String(value);
        seek.style.setProperty('--value', `${value}%`);
      }
      this.progressFrameId = window.requestAnimationFrame(update);
    };
    this.progressFrameId = window.requestAnimationFrame(update);
  };

  private readonly stopProgressAnimation = (): void => {
    if (this.progressFrameId === null) return;
    window.cancelAnimationFrame(this.progressFrameId);
    this.progressFrameId = null;
  };

  private formatPreciseTime(time: number): string {
    const totalMilliseconds = Math.max(0, Math.min(time, Number.MAX_SAFE_INTEGER / 1000)) * 1000;
    const wholeMilliseconds = Math.round(totalMilliseconds);
    const milliseconds = wholeMilliseconds % 1000;
    const totalSeconds = Math.floor(wholeMilliseconds / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const clock = hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : totalMinutes > 0
        ? `${minutes}:${String(seconds).padStart(2, '0')}`
        : String(seconds);
    return `${clock}.${String(milliseconds).padStart(3, '0')}`;
  }

  private setupVolumePopup(): void {
    const volumeContainer = this.host?.element.querySelector<HTMLDivElement>('.plyr__volume');
    const muteButton = volumeContainer?.querySelector<HTMLButtonElement>('button[data-plyr="mute"]');
    const settingsButton = this.host?.element.querySelector<HTMLButtonElement>('button[data-plyr="settings"]');
    const settingsPopup = settingsButton?.parentElement?.querySelector<HTMLDivElement>('.plyr__menu__container');
    if (!volumeContainer || !muteButton) return;

    volumeContainer.classList.add('plyr__menu');

    const popup = document.createElement('div');
    popup.className = 'plyr__menu__container vacnet-volume-menu';
    popup.id = `vacnet-volume-${crypto.randomUUID()}`;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Volume');
    popup.hidden = true;

    const content = document.createElement('div');
    content.className = 'vacnet-volume-menu__content';
    const percentage = document.createElement('output');
    percentage.className = 'vacnet-volume-menu__percentage';
    percentage.setAttribute('aria-live', 'polite');
    const slider = document.createElement('input');
    slider.className = 'vacnet-volume-menu__slider';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.setAttribute('orient', 'vertical');
    slider.setAttribute('aria-label', 'Volume');
    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'vacnet-volume-menu__slider-track';
    const sliderThumb = document.createElement('span');
    sliderThumb.className = 'vacnet-volume-menu__slider-thumb';
    sliderTrack.append(slider, sliderThumb);

    content.append(percentage, sliderTrack);
    popup.append(content);
    volumeContainer.append(popup);

    this.volumeContainer = volumeContainer;
    this.volumePopup = popup;
    this.volumeSliderTrack = sliderTrack;
    this.volumeSlider = slider;
    this.volumePercentage = percentage;
    this.muteButton = muteButton;
    this.settingsButton = settingsButton ?? null;
    this.settingsPopup = settingsPopup ?? null;
    muteButton.setAttribute('aria-controls', popup.id);
    muteButton.setAttribute('aria-expanded', 'false');
    muteButton.setAttribute('aria-haspopup', 'dialog');
    muteButton.addEventListener('click', this.onMuteButtonClick, true);
    settingsButton?.addEventListener('click', this.onSettingsButtonClick, true);
    slider.addEventListener('input', this.onVolumeSliderInput);
    sliderTrack.addEventListener('pointerdown', this.onVolumeTrackPointerDown);
    sliderTrack.addEventListener('pointermove', this.onVolumeTrackPointerMove);
    sliderTrack.addEventListener('pointerup', this.onVolumeTrackPointerUp);
    sliderTrack.addEventListener('pointercancel', this.onVolumeTrackPointerUp);
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    document.addEventListener('keydown', this.onDocumentKeyDown, true);
  }

  private disposeVolumePopup(): void {
    this.muteButton?.removeEventListener('click', this.onMuteButtonClick, true);
    this.settingsButton?.removeEventListener('click', this.onSettingsButtonClick, true);
    this.volumeSlider?.removeEventListener('input', this.onVolumeSliderInput);
    this.volumeSliderTrack?.removeEventListener('pointerdown', this.onVolumeTrackPointerDown);
    this.volumeSliderTrack?.removeEventListener('pointermove', this.onVolumeTrackPointerMove);
    this.volumeSliderTrack?.removeEventListener('pointerup', this.onVolumeTrackPointerUp);
    this.volumeSliderTrack?.removeEventListener('pointercancel', this.onVolumeTrackPointerUp);
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    document.removeEventListener('keydown', this.onDocumentKeyDown, true);
    this.volumeContainer = null;
    this.volumePopup = null;
    this.volumeSliderTrack = null;
    this.volumeSlider = null;
    this.volumePercentage = null;
    this.muteButton = null;
    this.settingsButton = null;
    this.settingsPopup = null;
  }

  private readonly onMuteButtonClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.toggleVolumePopup();
  };

  private readonly onSettingsButtonClick = (): void => {
    this.closeVolumePopup();
  };

  private readonly onVolumeSliderInput = (): void => {
    const slider = this.volumeSlider;
    if (!slider || !this.plyr) return;
    const volume = Number(slider.value);
    if (!Number.isFinite(volume)) return;
    this.plyr.volume = volume;
    this.plyr.muted = volume === 0;
  };

  private readonly onVolumeTrackPointerDown = (event: PointerEvent): void => {
    const track = this.volumeSliderTrack;
    if (!track) return;
    event.preventDefault();
    track.setPointerCapture(event.pointerId);
    this.setVolumeFromPointer(event);
  };

  private readonly onVolumeTrackPointerMove = (event: PointerEvent): void => {
    const track = this.volumeSliderTrack;
    if (!track?.hasPointerCapture(event.pointerId)) return;
    this.setVolumeFromPointer(event);
  };

  private readonly onVolumeTrackPointerUp = (event: PointerEvent): void => {
    const track = this.volumeSliderTrack;
    if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };

  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && this.volumeContainer?.contains(event.target)) return;
    this.closeVolumePopup();
  };

  private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.closeVolumePopup();
  };

  private toggleVolumePopup(): void {
    if (this.volumePopup?.hidden) this.openVolumePopup();
    else this.closeVolumePopup();
  }

  private openVolumePopup(): void {
    if (!this.volumePopup || !this.muteButton) return;
    this.closeSettingsPopup();
    this.updateVolumePopup();
    this.volumePopup.hidden = false;
    this.muteButton.setAttribute('aria-expanded', 'true');
  }

  private closeVolumePopup(): void {
    if (!this.volumePopup || !this.muteButton) return;
    if (this.volumePopup.hidden) return;
    this.muteButton.setAttribute('aria-expanded', 'false');
    this.volumePopup.hidden = true;
  }

  private closeSettingsPopup(): void {
    if (!this.settingsButton || !this.settingsPopup || this.settingsPopup.hidden) return;
    this.settingsButton.click();
  }

  private setVolumeFromPointer(event: PointerEvent): void {
    const track = this.volumeSliderTrack;
    if (!track || !this.plyr) return;
    const bounds = track.getBoundingClientRect();
    if (bounds.height <= 0) return;
    const trackHeight = bounds.height - 8;
    if (trackHeight <= 0) return;
    const volume = Math.min(1, Math.max(0, (bounds.bottom - 8 - event.clientY) / trackHeight));
    this.plyr.volume = volume;
    this.plyr.muted = volume === 0;
  }
}
