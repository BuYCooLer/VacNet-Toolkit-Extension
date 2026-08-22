import type { ClipData } from '../../entities/clip';
import { HISTORY_LIMIT, historyKey, type ClipHistoryEntry, type HistoryLookup, type HistoryState } from '../../entities/history';

export const findHistoryEntry = (history: HistoryState, clip: ClipData): HistoryLookup => {
  if (clip.matchTimestamp === null) return { status: 'new-clip', entry: null };

  const sameMatch = Object.values(history.entries).filter((entry) =>
    entry.matchTimestamp !== null && entry.matchTimestamp === clip.matchTimestamp);
  if (sameMatch.length === 0) return { status: 'new-match', entry: null };

  const exact = sameMatch.find((entry) =>
    entry.videoId === clip.videoId && Math.abs(entry.eventTime - clip.eventTime) < 1);
  if (exact) return { status: 'exact-duplicate', entry: exact };

  return { status: 'new-clip', entry: null };
};

export const addHistoryEntry = (history: HistoryState, entry: ClipHistoryEntry): HistoryState => {
  const entries = { ...history.entries, [historyKey(entry)]: entry };
  return { ...history, entries: trimHistoryEntries(entries) };
};

const trimHistoryEntries = (entries: Record<string, ClipHistoryEntry>): Record<string, ClipHistoryEntry> => {
  const entriesByAge = Object.entries(entries)
    .sort(([, first], [, second]) => first.timestamp - second.timestamp)
    .slice(-HISTORY_LIMIT);
  return Object.fromEntries(entriesByAge);
};

export const limitHistory = (history: HistoryState): HistoryState => {
  return {
    ...history,
    entries: trimHistoryEntries(history.entries),
  };
};

export const recordHistoryRepeat = (history: HistoryState): HistoryState => ({
  ...history,
  stats: { repeats: history.stats.repeats + 1 },
});

export interface MatchHistory {
  matchTimestamp: number | null;
  fallbackVideoId: string | null;
  entries: ClipHistoryEntry[];
}

export const matchHistoryKey = (match: Pick<MatchHistory, 'matchTimestamp' | 'fallbackVideoId'>): string =>
  match.matchTimestamp !== null ? `match:${match.matchTimestamp}` : `video:${match.fallbackVideoId ?? ''}`;

export const groupHistoryByMatch = (entries: readonly ClipHistoryEntry[]): MatchHistory[] => {
  const matches = new Map<string, MatchHistory>();

  for (const entry of entries) {
    const key = entry.matchTimestamp !== null ? `match:${entry.matchTimestamp}` : `video:${entry.videoId}`;
    const match = matches.get(key);
    if (match) {
      match.entries.push(entry);
      continue;
    }
    matches.set(key, {
      matchTimestamp: entry.matchTimestamp ?? null,
      fallbackVideoId: entry.matchTimestamp === null ? entry.videoId : null,
      entries: [entry],
    });
  }

  return Array.from(matches.values()).sort((first, second) => {
    const firstTimestamp = first.entries.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0);
    const secondTimestamp = second.entries.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0);
    return secondTimestamp - firstTimestamp;
  });
};
