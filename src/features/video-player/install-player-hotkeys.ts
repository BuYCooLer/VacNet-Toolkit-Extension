import type { ContentScriptContext } from 'wxt/client';
import type { PageSnapshot } from '../../entities/clip';
import type { Preferences } from '../../entities/preferences';
import { emptyVerdicts } from '../../entities/verdict';
import type { PlayerCommand, ReviewCommand } from '../../shared/protocol';

export const PLAYER_HOTKEYS = {
  submit: 'Enter',
  togglePlayback: 'Space',
  restart: 'KeyR',
  toggleZoom: 'KeyZ',
  stepBackward: 'ArrowLeft',
  stepForward: 'ArrowRight',
  closeDashboard: 'Escape',
  jumpToEvent: 'KeyE',
  skipClip: 'Backspace',
  speedDown: 'BracketLeft',
  speedUp: 'BracketRight',
} as const;

interface HotkeyDependencies {
  context: ContentScriptContext;
  isDashboardOpen: () => boolean;
  closeDashboard: () => void;
  getSnapshot: () => PageSnapshot;
  getPreferences?: () => Preferences;
  emitReviewCommand: (command: ReviewCommand) => void;
  emitPlayerCommand: (command: PlayerCommand) => void;
}

const isTextInputTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  const input = target.closest<HTMLElement>('input, textarea, select, [role="textbox"]');
  if (!input) return false;
  if (input instanceof HTMLInputElement) {
    const nonTextTypes = ['button', 'checkbox', 'radio', 'range', 'reset', 'submit', 'image', 'color'];
    if (nonTextTypes.includes(input.type.toLowerCase())) return false;
  }
  return true;
};

const DIGIT_KEY = /^(?:Digit|Numpad)([1-9])$/;

/** Zero-based preset index for a 1..9 digit key, or null for any other key. */
const digitKeyIndex = (code: string): number | null => {
  const match = DIGIT_KEY.exec(code);
  return match?.[1] ? Number(match[1]) - 1 : null;
};

export const installPlayerHotkeys = ({
  context,
  isDashboardOpen,
  closeDashboard,
  getSnapshot,
  getPreferences,
  emitReviewCommand,
  emitPlayerCommand,
}: HotkeyDependencies): void => {
  context.addEventListener(document, 'keydown', (rawEvent) => {
    const event = rawEvent as KeyboardEvent;
    if (event.defaultPrevented || event.isComposing || event.repeat) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    if (event.code === PLAYER_HOTKEYS.closeDashboard && isDashboardOpen()) {
      event.preventDefault();
      closeDashboard();
      return;
    }
    const snapshot = getSnapshot();
    if (isTextInputTarget(event.target) || snapshot.submitting) return;

    // Presets: digits 1..9 on the number row and the numpad, matched to the
    // preset at that position. Derived from the key rather than a fixed table
    // so a user with more or fewer than four presets still gets every binding
    // the panel advertises.
    const presetIndex = digitKeyIndex(event.code);
    if (presetIndex !== null) {
      const prefs = getPreferences?.();
      const presets = prefs?.customPresets ?? [];
      const targetPreset = presets[presetIndex];
      if (targetPreset) {
        event.preventDefault();
        (event.target as HTMLElement)?.blur?.();
        emitReviewCommand({ type: 'set-verdicts', verdicts: targetPreset.verdicts });
        if (prefs?.autoSubmitPreset && snapshot.clip) {
          emitReviewCommand({ type: 'submit', verdicts: targetPreset.verdicts, badClip: false });
        }
        return;
      }
    }

    if (event.code === 'Digit0' || event.code === 'Numpad0') {
      event.preventDefault();
      (event.target as HTMLElement)?.blur?.();
      emitReviewCommand({ type: 'set-verdicts', verdicts: emptyVerdicts() });
      return;
    }

    if (event.code === PLAYER_HOTKEYS.skipClip || event.code === 'Delete') {
      if (!snapshot.clip) return;
      event.preventDefault();
      (event.target as HTMLElement)?.blur?.();
      emitReviewCommand({ type: 'submit', verdicts: emptyVerdicts(), badClip: false });
      return;
    }

    if (event.code === PLAYER_HOTKEYS.submit || event.code === 'NumpadEnter') {
      if (!snapshot.clip) return;
      event.preventDefault();
      (event.target as HTMLElement)?.blur?.();
      emitReviewCommand({ type: 'submit', verdicts: snapshot.verdicts, badClip: false });
      return;
    }
    if (event.code === PLAYER_HOTKEYS.togglePlayback) {
      event.preventDefault();
      (event.target as HTMLElement)?.blur?.();
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
    if (event.code === PLAYER_HOTKEYS.jumpToEvent) {
      event.preventDefault();
      emitPlayerCommand({ type: 'jump-to-event' });
      return;
    }
    if (event.code === PLAYER_HOTKEYS.speedDown) {
      event.preventDefault();
      emitPlayerCommand({ type: 'change-speed', delta: -1 });
      return;
    }
    if (event.code === PLAYER_HOTKEYS.speedUp) {
      event.preventDefault();
      emitPlayerCommand({ type: 'change-speed', delta: 1 });
      return;
    }

    if (event.code !== PLAYER_HOTKEYS.stepBackward && event.code !== PLAYER_HOTKEYS.stepForward) return;
    event.preventDefault();
    emitPlayerCommand({ type: 'step', direction: event.code === PLAYER_HOTKEYS.stepBackward ? -1 : 1 });
  });
};

