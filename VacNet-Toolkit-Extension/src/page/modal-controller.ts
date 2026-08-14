export class ModalController {
  private overlay: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private header: HTMLElement | null = null;
  private closeButton: HTMLElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private activePointer: number | null = null;
  private offset = { x: 0, y: 0 };
  private windowBound = false;

  install(closeLabel: string): boolean {
    const overlay = document.getElementById('detailsModalOverlay');
    const content = document.getElementById('detailsModalContent');
    const header = document.getElementById('detailsModalHeader');
    const closeButton = document.getElementById('closeDetailsButton');
    if (!overlay || !content || !header || !closeButton) return false;
    if (this.overlay === overlay && this.content === content && this.header === header && this.closeButton === closeButton) return true;
    this.unbindElements();
    this.overlay = overlay;
    this.content = content;
    this.header = header;
    this.closeButton = closeButton;
    this.content.setAttribute('role', 'dialog');
    this.content.setAttribute('aria-modal', 'true');
    this.content.setAttribute('aria-labelledby', 'detailsModalHeader');
    this.closeButton.setAttribute('role', 'button');
    this.closeButton.setAttribute('tabindex', '0');
    this.closeButton.setAttribute('aria-label', closeLabel);
    this.closeButton.addEventListener('click', this.close);
    this.closeButton.addEventListener('keydown', this.onCloseKey);
    this.overlay.addEventListener('click', this.onOverlayClick);
    this.header.addEventListener('pointerdown', this.onPointerDown);
    if (!this.windowBound) {
      this.windowBound = true;
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerEnd);
      window.addEventListener('pointercancel', this.onPointerEnd);
    }
    this.overlay.setAttribute('aria-hidden', 'true');
    return true;
  }

  open = (): void => {
    if (!this.overlay || !this.content || !this.closeButton) return;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.overlay.classList.add('vacnet-extension-modal-open');
    this.overlay.setAttribute('aria-hidden', 'false');
    this.content.style.removeProperty('left');
    this.content.style.removeProperty('top');
    this.content.style.removeProperty('transform');
    this.closeButton.focus();
  };

  close = (): void => {
    if (!this.overlay) return;
    this.releasePointer();
    this.overlay.classList.remove('vacnet-extension-modal-open');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.previousFocus?.focus();
  };

  isOpen(): boolean {
    return this.overlay?.classList.contains('vacnet-extension-modal-open') ?? false;
  }

  dispose(): void {
    this.releasePointer();
    this.unbindElements();
    if (this.windowBound) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerEnd);
      window.removeEventListener('pointercancel', this.onPointerEnd);
      this.windowBound = false;
    }
  }

  private readonly onCloseKey = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.close();
    }
  };

  private readonly onOverlayClick = (event: MouseEvent): void => {
    if (event.target === this.overlay) this.close();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.content || !this.header || this.activePointer !== null) return;
    event.preventDefault();
    this.activePointer = event.pointerId;
    const bounds = this.content.getBoundingClientRect();
    this.offset = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    this.header.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointer || !this.content) return;
    const maxLeft = Math.max(0, window.innerWidth - this.content.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - this.content.offsetHeight);
    this.content.style.transform = 'none';
    this.content.style.left = `${Math.min(maxLeft, Math.max(0, event.clientX - this.offset.x))}px`;
    this.content.style.top = `${Math.min(maxTop, Math.max(0, event.clientY - this.offset.y))}px`;
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointer) this.releasePointer();
  };

  private releasePointer(): void {
    if (this.activePointer !== null && this.header?.hasPointerCapture(this.activePointer)) {
      this.header.releasePointerCapture(this.activePointer);
    }
    this.activePointer = null;
  }

  private unbindElements(): void {
    this.closeButton?.removeEventListener('click', this.close);
    this.closeButton?.removeEventListener('keydown', this.onCloseKey);
    this.overlay?.removeEventListener('click', this.onOverlayClick);
    this.header?.removeEventListener('pointerdown', this.onPointerDown);
  }
}
