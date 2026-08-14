import type { ClipDeduplication, ClipRange } from './clip';
import { isVerdictSelection, type VerdictSelection } from './verdict';

export const historyLimit = 1000;

export interface ClipHistoryEntry extends VerdictSelection {
  identityVersion: 1 | 2;
  taskId: string;
  sourceWebmUrl: string;
  videoId: string;
  clipCount: string | null;
  app: string;
  range: ClipRange;
  eventTime: number;
  clipKey: string;
  deduplication: ClipDeduplication;
  timestamp: number;
  badClip: boolean;
}

export interface HistoryLookup {
  status: ClipDeduplication;
  entry: ClipHistoryEntry | null;
}

export interface HistoryStats {
  repeats: number;
}

export interface HistoryState {
  version: 4;
  entries: Record<string, ClipHistoryEntry>;
  stats: HistoryStats;
}

export const emptyHistory = (): HistoryState => ({
  version: 4,
  entries: {},
  stats: { repeats: 0 },
});

export const historyKey = (entry: ClipHistoryEntry): string => `${entry.clipKey}|task:${entry.taskId}|at:${entry.timestamp}`;

export const isClipHistoryEntry = (value: unknown): value is ClipHistoryEntry => {
  if (!isVerdictSelection(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (candidate.identityVersion === 1 || candidate.identityVersion === 2)
    && typeof candidate.taskId === 'string'
    && typeof candidate.sourceWebmUrl === 'string'
    && typeof candidate.videoId === 'string'
    && (candidate.clipCount === null || typeof candidate.clipCount === 'string')
    && typeof candidate.app === 'string'
    && isClipRange(candidate.range)
    && isFiniteNumber(candidate.eventTime)
    && candidate.eventTime >= 0
    && typeof candidate.clipKey === 'string'
    && typeof candidate.timestamp === 'number'
    && Number.isFinite(candidate.timestamp)
    && typeof candidate.badClip === 'boolean'
    && isClipDeduplication(candidate.deduplication);
};

export const isHistoryLookup = (value: unknown): value is HistoryLookup => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isClipDeduplication(candidate.status) && (candidate.entry === null || isClipHistoryEntry(candidate.entry));
};

export const isHistoryState = (value: unknown): value is HistoryState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const stats = candidate.stats;
  const entries = candidate.entries;
  return candidate.version === 4
    && typeof stats === 'object'
    && stats !== null
    && !Array.isArray(stats)
    && typeof (stats as Record<string, unknown>).repeats === 'number'
    && typeof entries === 'object'
    && entries !== null
    && !Array.isArray(entries)
    && Object.values(entries).every(isClipHistoryEntry);
};

const isClipRange = (value: unknown): value is ClipRange => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isFiniteNumber(candidate.start) && candidate.start >= 0 && isFiniteNumber(candidate.end) && candidate.end >= 0;
};

const isClipDeduplication = (value: unknown): value is ClipDeduplication =>
  value === 'new-match' || value === 'same-match-different-clip' || value === 'exact-duplicate';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
