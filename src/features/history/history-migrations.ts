import { z } from 'zod';
import {
  ClipRangeSchema,
  createClipIdentity,
  extractVideoId,
} from '../../entities/clip';
import {
  ClipHistoryEntrySchema,
  emptyHistory,
  HISTORY_LIMIT,
  HistoryStateSchema,
  historyKey,
  type ClipHistoryEntry,
  type HistoryState,
} from '../../entities/history';
import { VerdictSelectionSchema } from '../../entities/verdict.schema';

const LegacyRangeSchema = z.object({
  start: z.number().finite().nonnegative().catch(0),
  end: z.number().finite().positive().catch(12),
}).catch({ start: 0, end: 12 }).transform(({ end, start }) => ({
  start,
  end: end > start ? end : start + 12,
}));

const LegacyEntrySchema = VerdictSelectionSchema.extend({
  identityVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  taskId: z.string().trim().min(1),
  sourceWebmUrl: z.string().trim().min(1),
  videoId: z.string().trim().optional(),
  clipCount: z.string().nullable().optional(),
  app: z.string().trim().optional(),
  range: LegacyRangeSchema,
  eventTime: z.number().finite().nonnegative().optional(),
  deduplication: z.enum(['new-match', 'new-clip', 'same-match-different-clip', 'exact-duplicate', 'shifted-duplicate']).optional(),
  timestamp: z.number().finite().nonnegative(),
  badClip: z.boolean().optional(),
  matchTimestamp: z.number().finite().nonnegative().optional().nullable(),
  webmDuration: z.number().finite().nonnegative().optional().nullable(),
});

const LegacyStateSchema = z.object({
  entries: z.record(z.string(), z.unknown()).optional(),
  stats: z.object({ repeats: z.number().finite().nonnegative().optional() }).optional(),
});

const LegacyStatsSchema = z.object({ repeats: z.number().finite().nonnegative().optional() });

export interface LegacyHistorySources {
  entries: { getValue: () => Promise<unknown> };
  stats: { getValue: () => Promise<unknown> };
}

const migrateEntry = (value: unknown): ClipHistoryEntry | null => {
  const current = ClipHistoryEntrySchema.safeParse(value);
  if (current.success) return current.data;
  const result = LegacyEntrySchema.safeParse(value);
  if (!result.success) return null;
  const source = result.data;
  const videoId = source.videoId || extractVideoId(source.sourceWebmUrl);
  const range = ClipRangeSchema.parse(source.range);
  return ClipHistoryEntrySchema.parse({
    ...source,
    identityVersion: source.identityVersion ?? 1,
    videoId,
    clipCount: source.clipCount ?? null,
    app: source.app || '730',
    range,
    eventTime: source.eventTime ?? range.start,
    ...createClipIdentity({ taskId: source.taskId, videoId, range }),
    deduplication: source.deduplication === 'same-match-different-clip' ? 'shifted-duplicate' : source.deduplication ?? 'new-match',
    badClip: source.badClip ?? false,
    matchTimestamp: source.matchTimestamp ?? null,
    webmDuration: source.webmDuration ?? null,
  });
};

export const migrateHistory = async (stateValue: unknown, sources: LegacyHistorySources): Promise<HistoryState> => {
  const current = HistoryStateSchema.safeParse(stateValue);
  if (current.success) return current.data;
  const [entriesValue, statsValue] = await Promise.all([sources.entries.getValue(), sources.stats.getValue()]);
  const state = LegacyStateSchema.safeParse(stateValue);
  const legacyState = state.success ? state.data : {};
  const storedEntries = z.record(z.string(), z.unknown()).safeParse(entriesValue);
  const entries = legacyState.entries ?? (storedEntries.success ? storedEntries.data : {});
  const history = emptyHistory();
  for (const value of Object.values(entries)) {
    const entry = migrateEntry(value);
    if (entry) history.entries[historyKey(entry)] = entry;
  }
  const storedStats = LegacyStatsSchema.safeParse(statsValue);
  history.stats.repeats = Math.floor(legacyState.stats?.repeats ?? (storedStats.success ? storedStats.data.repeats ?? 0 : 0));
  history.entries = Object.fromEntries(Object.entries(history.entries)
    .sort(([, first], [, second]) => first.timestamp - second.timestamp)
    .slice(-HISTORY_LIMIT));
  return history;
};
