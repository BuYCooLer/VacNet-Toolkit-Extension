import type { ClipData } from '../entities/clip';
import type { Preferences } from '../entities/preferences';
import type { PlayerCommand } from '../shared/protocol';
import type { ReviewPlayerPort } from '../features/video-player/review-player-port';

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

interface PlayerCoordinatorOptions {
  player: ReviewPlayerPort;
  onError: (error: unknown) => void;
}

export class PlayerCoordinator {
  private loadController: AbortController | null = null;
  private isDisposed = false;

  constructor(private readonly options: PlayerCoordinatorOptions) {}

  configure(preferences: Preferences, clip: ClipData): void {
    if (this.isDisposed) return;
    this.options.player.configure(preferences, clip);
    void this.load(clip).catch((error: unknown) => {
      if (isAbortError(error)) return;
      this.options.onError(error);
    });
  }

  applyPreferences(preferences: Preferences): void { this.options.player.applyPreferences(preferences); }

  handle(command: PlayerCommand): void {
    try { this.options.player.handle(command); }
    catch (error) { this.options.onError(error); }
  }

  async transition(preferences: Preferences, clip: ClipData): Promise<void> {
    if (this.isDisposed) return;
    this.options.player.configure(preferences, clip);
    await this.load(clip);
  }

  private async load(clip: ClipData): Promise<void> {
    this.loadController?.abort();
    const controller = new AbortController();
    this.loadController = controller;
    try {
      await this.options.player.load(clip.sourceWebmUrl, clip, controller.signal);
    } finally {
      if (this.loadController === controller) this.loadController = null;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.loadController?.abort();
    this.loadController = null;
    this.options.player.dispose();
  }

  metrics() { return this.options.player.metrics(); }
  hasVideo(): boolean { return this.options.player.hasVideo(); }
}
