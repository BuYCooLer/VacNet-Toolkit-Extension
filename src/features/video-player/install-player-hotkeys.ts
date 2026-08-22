import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PageSnapshot } from '../../entities/clip';
import type { PlayerCommand, ReviewCommand } from '../../shared/protocol';
export const PLAYER_HOTKEYS = {
  submit: 'Enter',
  togglePlayback: 'Space',
  restart: 'KeyR',
  toggleZoom: 'KeyZ',
  stepBackward: 'ArrowLeft',
  stepForward: 'ArrowRight',
  closeDashboard: 'Escape',
} as const;

interface HotkeyDependencies {
  context: ContentScriptContext;
  isDashboardOpen: () => boolean;
  closeDashboard: () => void;
  getSnapshot: () => PageSnapshot;
  emitReviewCommand: (command: ReviewCommand) => void;
  emitPlayerCommand: (command: PlayerCommand) => void;
}

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  const element = target.closest<HTMLElement>('*');
  if (!element) return false;
  if (element.isContentEditable || element.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  return element.closest('input, textarea, select, button, a[href], summary, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="slider"]') !== null;
};

export const installPlayerHotkeys = ({ context, isDashboardOpen, closeDashboard, getSnapshot, emitReviewCommand, emitPlayerCommand }: HotkeyDependencies): void => {
  context.addEventListener(document, 'keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || event.repeat) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    if (event.code === PLAYER_HOTKEYS.closeDashboard && isDashboardOpen()) {
      event.preventDefault();
      closeDashboard();
      return;
    }
    const snapshot = getSnapshot();
    if (isInteractiveTarget(event.target) || snapshot.submitting) return;

    if (event.code === PLAYER_HOTKEYS.submit) {
      if (!snapshot.clip || !snapshot.hasVideo) return;
      event.preventDefault();
      emitReviewCommand({ type: 'submit', verdicts: snapshot.verdicts, badClip: false });
      return;
    }
    if (event.code === PLAYER_HOTKEYS.togglePlayback) {
      event.preventDefault();
      emitPlayerCommand({ type: 'toggle-playback' });
      return;
    }
    if (event.code === PLAYER_HOTKEYS.restart) {
      event.preventDefault();
      emitPlayerCommand({ type: 'restart' });
      return;
    }
    if (event.code === PLAYER_HOTKEYS.toggleZoom) {
      event.preventDefault();
      emitPlayerCommand({ type: 'toggle-zoom' });
      return;
    }
    if (event.code !== PLAYER_HOTKEYS.stepBackward && event.code !== PLAYER_HOTKEYS.stepForward) return;
    event.preventDefault();
    emitPlayerCommand({ type: 'step', direction: event.code === PLAYER_HOTKEYS.stepBackward ? -1 : 1 });
  });
};
