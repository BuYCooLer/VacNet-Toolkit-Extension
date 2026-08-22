import { defineExtensionMessaging } from '@webext-core/messaging';
import type { WebmMetadata } from './protocol';
import type { HistoryState, VersionedHistoryMutation, VersionedPreferencesMutation } from './storage-protocol';
import type { Preferences } from '../entities/preferences';

export interface ExtensionProtocolMap {
  readWebmMetadata: (url: string) => WebmMetadata | null;
  getHistory: () => HistoryState;
  mutateHistory: (mutation: VersionedHistoryMutation) => HistoryState;
  getPreferences: () => Preferences;
  mutatePreferences: (patch: VersionedPreferencesMutation) => Preferences;
}

export const { onMessage, sendMessage } = defineExtensionMessaging<ExtensionProtocolMap>();
