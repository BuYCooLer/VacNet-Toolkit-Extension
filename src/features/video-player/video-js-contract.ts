export interface VideoJsPlayer {
  id(): string;
  el(): HTMLElement;
  currentTime(): number;
  currentTime(value: number): void;
  duration(): number;
  pause(): void;
  play(): Promise<void> | void;
  paused(): boolean;
  preload(value: string): void;
  src(source: { src: string; type: string }): void;
  volume(): number;
  volume(value: number): void;
  muted(): boolean;
  muted(value: boolean): void;
  language(): string;
  language(value: string): void;
  on(type: string, listener: () => void): void;
  off(type: string, listener: () => void): void;
}

export interface VideoJsApi {
  VERSION?: string;
  addLanguage?(locale: string, messages: Record<string, string>): void;
  getPlayer?(id: string): VideoJsPlayer | undefined;
  getPlayers?(): Record<string, VideoJsPlayer>;
}
