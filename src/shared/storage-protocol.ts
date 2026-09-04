import { z } from 'zod';
import { ClipHistoryEntrySchema, HistoryStateSchema } from '../entities/history';
import { STORAGE_COORDINATION_VERSION } from './storage-contract';

export type { HistoryState } from '../entities/history';
export {
  STORAGE_COORDINATION_VERSION,
  type HistoryMutation,
  type VersionedHistoryMutation,
  type VersionedPreferencesMutation,
} from './storage-contract';

export const HistoryMutationSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('save-entry'), entry: ClipHistoryEntrySchema }),
  z.strictObject({ type: z.literal('record-repeat') }),
  z.strictObject({ type: z.literal('clear') }),
  z.strictObject({ type: z.literal('replace'), state: HistoryStateSchema }),
]);

export const VersionedHistoryMutationSchema = z.strictObject({
  version: z.literal(STORAGE_COORDINATION_VERSION),
  mutation: HistoryMutationSchema,
});

export const StorageMutationEnvelopeSchema = z.strictObject({
  version: z.literal(STORAGE_COORDINATION_VERSION),
});

export const VersionedPreferencesMutationSchema = z.strictObject({
  version: z.literal(STORAGE_COORDINATION_VERSION),
  patch: z.record(z.string(), z.unknown()),
});
