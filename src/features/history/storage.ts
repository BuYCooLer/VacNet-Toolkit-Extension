import { storage } from 'wxt/storage';
import {
} from '../../entities/clip';
import {
  emptyHistory,
  HISTORY_STATE_VERSION,
  HistoryStateSchema,
  type HistoryState,
} from '../../entities/history';
import { addHistoryEntry, limitHistory, recordHistoryRepeat } from './utils';
import { migrateHistory } from './history-migrations';
import type { HistoryMutation } from '../../shared/storage-protocol';

const HISTORY_STORAGE_VERSION = HISTORY_STATE_VERSION;

const legacyEntries = storage.defineItem<unknown>('local:vacnetHistory', { fallback: null });
const legacyStats = storage.defineItem<unknown>('local:vacnetHistoryStats', { fallback: null });


const storedHistory = storage.defineItem<HistoryState>('local:history', {
  fallback: emptyHistory(),
  version: HISTORY_STORAGE_VERSION,
  migrations: {
    2: (value: unknown) => migrateHistory(value, { entries: legacyEntries, stats: legacyStats }),
    3: (value: unknown) => migrateHistory(value, { entries: legacyEntries, stats: legacyStats }),
    4: (value: unknown) => migrateHistory(value, { entries: legacyEntries, stats: legacyStats }),
  },
});

const getValue = async (): Promise<HistoryState> => {
  return HistoryStateSchema.parse(await storedHistory.getValue());
};

const cleanupLegacy = async (): Promise<void> => {
  await Promise.all([
    legacyEntries.removeValue(),
    legacyStats.removeValue(),
  ]);
};

const setValue = async (history: HistoryState): Promise<void> => {
  await storedHistory.setValue(HistoryStateSchema.parse(history));
};

const watch = (
  listener: (history: HistoryState) => void,
  onError: (error: unknown) => void,
): (() => void) =>
  storedHistory.watch((value) => {
    const result = HistoryStateSchema.safeParse(value);
    if (!result.success) {
      onError(new TypeError('VACNET history changed to an invalid value.', { cause: result.error }));
      return;
    }
    listener(result.data);
  });

const hydrateAndWatch = async (
  listener: (history: HistoryState) => void,
  onError: (error: unknown) => void,
): Promise<() => void> => {
  let revision = 0;
  const unwatch = watch((history) => {
    revision += 1;
    listener(history);
  }, onError);
  try {
    const history = await getValue();
    if (revision === 0) listener(history);
    return unwatch;
  } catch (error) {
    unwatch();
    throw error;
  }
};

const mutate = async (mutation: HistoryMutation): Promise<HistoryState> => {
  const current = await getValue();
  let next: HistoryState;
  switch (mutation.type) {
    case 'save-entry': next = addHistoryEntry(current, mutation.entry); break;
    case 'record-repeat': next = recordHistoryRepeat(current); break;
    case 'clear': next = { version: HISTORY_STATE_VERSION, entries: {}, stats: { repeats: 0 } }; break;
    case 'replace': next = limitHistory(HistoryStateSchema.parse(mutation.state)); break;
    default: throw new Error(`Unhandled history mutation: ${String(mutation)}`);
  }
  await setValue(next);
  return next;
};

export const historyStorage = { getValue, setValue, watch, hydrateAndWatch, mutate, cleanupLegacy };
