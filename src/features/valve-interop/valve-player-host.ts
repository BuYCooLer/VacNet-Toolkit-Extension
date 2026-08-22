export interface LegacyValvePlayer {
  id: () => string;
  el: () => HTMLElement;
  duration: () => number;
  paused: () => boolean;
  preload: (value: string) => void;
  src: (source: { src: string; type: string }) => void;
  language: {
    (): string;
    (value: string): void;
  };
  pause: () => void;
  dispose?: () => void;
  currentTime: {
    (): number;
    (value: number): void;
  };
  volume: {
    (): number;
    (value: number): void;
  };
  muted: {
    (): boolean;
    (value: boolean): void;
  };
  play: () => Promise<void> | void;
  on: (type: string, listener: () => void) => void;
  off: (type: string, listener: () => void) => void;
}

export interface ValveVideoJsApi {
  (target: string | Element): LegacyValvePlayer;
  VERSION?: string;
  getPlayer?: (id: string) => LegacyValvePlayer | undefined;
  getPlayers?: () => Record<string, LegacyValvePlayer>;
  addLanguage?: (locale: string, messages: Record<string, string>) => void;
}

import type { ReviewVideoHost } from '../../shared/review-video-host';

export type { ReviewVideoHost } from '../../shared/review-video-host';

const PLAYER_VIDEO_SELECTOR = 'video[data-vacnet-review-video]';
const LEGACY_PLAYER_SELECTOR = '.video-js, #video_html5_api, video#video, video.vjs-tech';
const SUPPORTED_VALVE_DISPOSE_VERSION = '8.23.3';

const createNoopValvePlayer = (): LegacyValvePlayer => {
  let currentTime = 0;
  let volume = 0;
  let muted = false;

  return {
    id: () => 'video',
    el: () => document.createElement('div'),
    duration: () => 0,
    paused: () => true,
    preload: () => undefined,
    src: () => undefined,
    language: Object.assign(
      () => '',
      (): void => undefined,
    ),
    pause: () => undefined,
    currentTime: Object.assign(
      () => currentTime,
      (value: number): void => {
      currentTime = value;
      },
    ),
    volume: Object.assign(
      () => volume,
      (value: number): void => {
      volume = value;
      },
    ),
    muted: Object.assign(
      () => muted,
      (value: boolean): void => {
      muted = value;
      },
    ),
    play: () => Promise.resolve(),
    on: () => undefined,
    off: () => undefined,
  };
};

const installValveShim = (): void => {
  const player = createNoopValvePlayer();
  const shim = (() => player) as ValveVideoJsApi;
  shim.getPlayer = () => player;
  shim.getPlayers = () => ({ video: player });
  shim.addLanguage = () => undefined;
  window.videojs = shim;
};

const removeLegacyDom = (container: HTMLElement): void => {
  for (const element of Array.from(container.querySelectorAll<HTMLElement>(LEGACY_PLAYER_SELECTOR))) {
    element.remove();
  }
};

const disposeValvePlayer = (player: LegacyValvePlayer | undefined): void => {
  if (!player || window.videojs?.VERSION !== SUPPORTED_VALVE_DISPOSE_VERSION) return;
  try {
    player.dispose?.();
  } catch (error) {
    console.warn('[VACNET] Valve Video.js dispose failed; removing the legacy DOM directly.', error);
  }
};

export const findReviewVideo = (root: ParentNode = document): HTMLVideoElement | null =>
  root.querySelector<HTMLVideoElement>(PLAYER_VIDEO_SELECTOR);

export const hasReviewVideo = (): boolean => findReviewVideo() !== null;

export class ValvePlayerHost {
  private host: ReviewVideoHost | null = null;
  private originalVideoJs: ValveVideoJsApi | undefined;
  private installedShim: ValveVideoJsApi | null = null;

  constructor(private readonly prepareValveTeardown: () => void) {}

  mount(): ReviewVideoHost {
    if (this.host?.element.isConnected) return this.host;

    const container = document.querySelector<HTMLElement>('.videocontainer');
    if (!container) throw new Error('Valve page does not contain a video container.');

    this.prepareValveTeardown();
    const legacyPlayer = window.videojs?.getPlayer?.('video');
    const legacyVideo = container.querySelector<HTMLVideoElement>('#video_html5_api, video#video, video.vjs-tech');
    legacyVideo?.pause();
    legacyPlayer?.pause();
    disposeValvePlayer(legacyPlayer);
    removeLegacyDom(container);
    this.originalVideoJs = window.videojs;
    installValveShim();
    this.installedShim = window.videojs ?? null;

    const element = document.createElement('div');
    element.dataset.vacnetPlayerHost = 'true';
    element.className = 'vacnet-review-player-host';
    const video = document.createElement('video');
    video.dataset.vacnetReviewVideo = 'true';
    video.id = 'vacnet-review-video';
    video.controls = true;
    video.autoplay = false;
    video.playsInline = true;
    video.preload = 'metadata';
    element.append(video);
    container.replaceChildren(element);
    this.host = { element, video };
    return this.host;
  }

  dispose(): void {
    this.host?.element.remove();
    this.host = null;
    if (this.installedShim && window.videojs === this.installedShim) {
      if (this.originalVideoJs) window.videojs = this.originalVideoJs;
      else delete window.videojs;
    }
    this.originalVideoJs = undefined;
    this.installedShim = null;
  }
}

declare global {
  interface Window {
    videojs?: ValveVideoJsApi;
    __vacnetMainWorldRuntime?: { dispose: () => void };
    SetModeLabeling?: () => void;
    SetModeConfirmLabels?: () => void;
    ShowLabelingButtons?: () => void;
    SubmitLabels?: () => void;
    ReportBadClip?: () => void;
  }
}
