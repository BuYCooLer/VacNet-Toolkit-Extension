import type { VerdictName, VerdictValue } from '../domain/verdict';

export interface VideoSource {
  src: string;
  type?: string;
}

export interface VideoJsPlayer {
  id(): string;
  el(): HTMLElement;
  currentSource(): VideoSource;
  currentTime(): number;
  currentTime(value: number): void;
  duration(): number;
  pause(): void;
  play(): Promise<void> | void;
  paused(): boolean;
  preload(value: string): void;
  src(source: VideoSource): void;
  volume(): number;
  volume(value: number): void;
  muted(): boolean;
  muted(value: boolean): void;
  language(): string;
  language(value: string): void;
  on(type: string, listener: () => void): void;
  off(type: string, listener: () => void): void;
  one(type: string, listener: () => void): void;
  readyState(): number;
}

export interface VideoJsApi {
  VERSION?: string;
  log?: { level(level: 'debug'): void };
  addLanguage?(locale: string, messages: Record<string, string>): void;
  getPlayer?(id: string): VideoJsPlayer | undefined;
  getPlayers?(): Record<string, VideoJsPlayer>;
}

export type ButtonStates = Record<VerdictName, VerdictValue>;

declare global {
  interface Window {
    __vacnetV2Controller?: boolean;
    buttonStates?: ButtonStates;
    SetModeLabeling?: () => void;
    SetModeConfirmLabels?: () => void;
    ShowLabelingButtons?: () => void;
    SubmitLabels?: () => void;
    ReportBadClip?: () => void;
    videojs?: VideoJsApi;
  }
}
