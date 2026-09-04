import { defineBackground } from 'wxt/sandbox';
import { extractWebmMetadata } from '../src/features/video-player/webm-parser';
import { onMessage } from '../src/shared/extension-messaging';
import { historyStorage } from '../src/features/history/storage';
import { preferencesStorage } from '../src/features/preferences/storage';
import { HistoryStateSchema } from '../src/entities/history';
import { PreferencesSchema } from '../src/entities/preferences.schema';
import { WebmMetadataSchema } from '../src/shared/protocol';
import { VersionedHistoryMutationSchema, VersionedPreferencesMutationSchema } from '../src/shared/storage-protocol';
import { getAllowedWebmUrl } from '../src/shared/url-policy';
import { StorageMutationCoordinator } from '../src/shared/storage-mutation-coordinator';

const requireSchema = <T>(result: { success: boolean; data?: T; error?: unknown }, label: string): T => {
  if (result.success && result.data !== undefined) return result.data;
  throw new TypeError(`Invalid ${label}: ${JSON.stringify(result.error)}`, { cause: result.error });
};

export default defineBackground(() => {
  const storageMutations = new StorageMutationCoordinator();
  onMessage('readWebmMetadata', async (message) => {
    const url = getAllowedWebmUrl(message.data);
    if (!url) return null;
    return requireSchema(WebmMetadataSchema.nullable().safeParse(await extractWebmMetadata(url.href)), 'WebM metadata response');
  });
  onMessage('getHistory', async () => requireSchema(HistoryStateSchema.safeParse(await historyStorage.getValue()), 'history response'));
  onMessage('mutateHistory', (message) => storageMutations.enqueue(async () => {
    const request = requireSchema(VersionedHistoryMutationSchema.safeParse(message.data), 'versioned history mutation');
    return requireSchema(HistoryStateSchema.safeParse(await historyStorage.mutate(request.mutation)), 'history response');
  }));
  onMessage('getPreferences', async () => requireSchema(PreferencesSchema.safeParse(await preferencesStorage.getValue()), 'preferences response'));
  onMessage('mutatePreferences', (message) => storageMutations.enqueue(async () => {
    const request = requireSchema(VersionedPreferencesMutationSchema.safeParse(message.data), 'versioned preferences mutation');
    return requireSchema(PreferencesSchema.safeParse(await preferencesStorage.mutate(request.patch)), 'preferences response');
  }));
});
