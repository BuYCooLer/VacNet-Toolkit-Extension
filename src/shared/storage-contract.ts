/**
 * The storage mutation contract: version marker and message payload shapes.
 *
 * Separate from ./storage-protocol.ts, which layers the runtime schemas on
 * top. Anything that only needs to *send* a mutation — the popup — imports
 * from here, so asking for the version constant does not drag the validation
 * library into a bundle that never parses anything.
 */
import type { ClipHistoryEntry, HistoryState } from '../entities/history';
import type { PreferencesPatch } from '../entities/preferences';

export const STORAGE_COORDINATION_VERSION = 1 as const;

export type HistoryMutation =
  | { type: 'save-entry'; entry: ClipHistoryEntry }
  | { type: 'record-repeat' }
  | { type: 'clear' }
  | { type: 'replace'; state: HistoryState };

export type VersionedHistoryMutation = {
  version: typeof STORAGE_COORDINATION_VERSION;
  mutation: HistoryMutation;
};

export type VersionedPreferencesMutation = {
  version: typeof STORAGE_COORDINATION_VERSION;
  patch: PreferencesPatch;
};
