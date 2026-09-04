import { signal } from '@preact/signals';
import {
  createDefaultPreferences,
  type Preferences,
  type PreferencesPatch,
} from '../../entities/preferences';
import { PreferencesSchema } from '../../entities/preferences.schema';
import { preferencesStorage } from './storage';
import { sendMessage } from '../../shared/extension-messaging';
import { STORAGE_COORDINATION_VERSION } from '../../shared/storage-protocol';

export const preferencesSignal = signal<Preferences>(createDefaultPreferences());

let updateQueue: Promise<unknown> = Promise.resolve();

export const initializePreferencesStore = async (
  onError: (error: unknown) => void,
): Promise<() => void> => {
  await preferencesStorage.cleanupLegacy();
  return preferencesStorage.hydrateAndWatch((preferences) => {
    preferencesSignal.value = preferences;
  }, (error) => onError(error));
};

export const updatePreferences = (patch: PreferencesPatch): Promise<Preferences> => {
  const operation = updateQueue.then(() => sendMessage('mutatePreferences', { version: STORAGE_COORDINATION_VERSION, patch }))
    .then((value) => PreferencesSchema.parse(value))
    .then((preferences) => {
      preferencesSignal.value = preferences;
      return preferences;
    });
  updateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
};
