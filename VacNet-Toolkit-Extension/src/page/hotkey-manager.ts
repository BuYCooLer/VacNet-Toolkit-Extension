import type { VideoJsAdapter } from './player-adapter';
import type { ModalController } from './modal-controller';

export class HotkeyManager {
  constructor(
    private readonly player: VideoJsAdapter,
    private readonly modal: ModalController,
    private readonly submit: () => void,
    private readonly isSubmitting: () => boolean,
  ) {}

  install(): void {
    document.addEventListener('keydown', this.onKeyDown);
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || this.isTyping(event.target)) return;
    if (this.modal.isOpen() || this.isSubmitting()) return;
    if (event.code === 'Space') {
      event.preventDefault();
      this.player.togglePlayback();
    } else if (event.code === 'Enter') {
      event.preventDefault();
      this.submit();
    } else if (event.code === 'KeyR') {
      event.preventDefault();
      this.player.restart();
    } else if (event.code === 'KeyZ') {
      event.preventDefault();
      this.player.toggleZoom();
    } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      this.player.step(event.code === 'ArrowLeft' ? -1 : 1);
    }
  };

  private isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
      && Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable='true']"));
  }
}
