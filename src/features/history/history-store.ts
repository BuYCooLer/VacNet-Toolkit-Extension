import { signal } from '@preact/signals';
import type { ClipData } from '../../entities/clip';
import { emptyHistory, HistoryStateSchema, type ClipHistoryEntry, type HistoryLookup, type HistoryState } from '../../entities/history';
import { historyStorage } from './storage';
import { findHistoryEntry, limitHistory } from './utils';
import { sendMessage } from '../../shared/extension-messaging';
import { STORAGE_COORDINATION_VERSION, type HistoryMutation } from '../../shared/storage-protocol';

export const historySignal = signal<HistoryState>(emptyHistory());

let updateQueue: Promise<unknown> = Promise.resolve();

const updateHistoryAtomically = (mutation: HistoryMutation): Promise<HistoryState> => {
  const operation = updateQueue.then(() => sendMessage('mutateHistory', { version: STORAGE_COORDINATION_VERSION, mutation })).then((history) => {
    historySignal.value = history;
    return history;
  });
  updateQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

export const initializeHistoryStore = async (
  onError: (error: unknown) => void,
): Promise<() => void> => {
  await historyStorage.cleanupLegacy();
  return historyStorage.hydrateAndWatch((history) => {
    historySignal.value = history;
  }, (error) => onError(error));
};

export const findHistory = async (clip: ClipData): Promise<HistoryLookup> =>
  findHistoryEntry(await historyStorage.getValue(), clip);

export const recordRepeat = async (): Promise<void> => {
  await updateHistoryAtomically({ type: 'record-repeat' });
};

export const saveHistoryEntry = async (entry: ClipHistoryEntry): Promise<void> => {
  await updateHistoryAtomically({ type: 'save-entry', entry });
};

export const clearHistory = async (): Promise<void> => {
  await updateHistoryAtomically({ type: 'clear' });
};

export const importHistory = async (data: unknown): Promise<void> => {
  const parsed = limitHistory(HistoryStateSchema.parse(data));
  await updateHistoryAtomically({ type: 'replace', state: parsed });
};
