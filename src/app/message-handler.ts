import type { MessageCatalog } from '../shared/i18n';
import type { IsolatedMessageBus } from '../shared/message-bus';
import type { MainEvent } from '../shared/protocol';
import { preferencesSignal, updatePreferences } from '../features/preferences/preferences-store';
import { snapshotSignal } from '../features/video-player/player-store';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled main-world event: ${String(value)}`);
};

export interface MessageHandler {
  handle: (event: MainEvent) => Promise<void>;
  markHydrated: () => void;
  sendInitialization: () => void;
}

export const createMessageHandler = (
  catalog: MessageCatalog,
  bus: IsolatedMessageBus,
): MessageHandler => {
  let isHydrated = false;
  let isMainReady = false;
  let isInitializationSent = false;
  let isInitializationConfirmed = false;

  const sendInitialization = (): void => {
    if (!isHydrated || !isMainReady || isInitializationSent || isInitializationConfirmed) return;
    isInitializationSent = true;
    bus.emit({ type: 'initialize', catalog, preferences: preferencesSignal.value });
  };

  const handle = async (event: MainEvent): Promise<void> => {
    switch (event.type) {
      case 'ready':
        isMainReady = true;
        isInitializationSent = false;
        isInitializationConfirmed = false;
        sendInitialization();
        return;
      case 'initialized':
        isInitializationConfirmed = true;
        return;
      case 'snapshot':
        snapshotSignal.value = event.snapshot;
        return;
      case 'preferences':
        await updatePreferences(event.preferences);
        return;
    }
    assertNever(event);
  };

  return {
    handle,
    markHydrated: () => {
      isHydrated = true;
      sendInitialization();
    },
    sendInitialization,
  };
};
