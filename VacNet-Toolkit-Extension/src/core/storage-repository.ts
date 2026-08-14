import { browser } from 'wxt/browser';
import { createClipIdentity, extractVideoId, type ClipData, type ClipDeduplication, type ClipRange } from '../domain/clip';
import { emptyHistory, historyKey, historyLimit, isHistoryState, type ClipHistoryEntry, type HistoryLookup, type HistoryState } from '../domain/history';
import { defaultPreferences, isPreferences, type Preferences } from '../domain/preferences';
import { isVerdictSelection } from '../domain/verdict';

interface StorageState {
  preferences: Preferences;
  history: HistoryState;
}

export class StorageRepository {
  async load(): Promise<StorageState> {
    const stored = await browser.storage.local.get(['preferences', 'history', 'vacnetHistory', 'vacnetHistoryStats', 'dashboardOpen', 'stretchVideo']);
    const preferences = isPreferences(stored.preferences) ? stored.preferences : this.migratePreferences(stored.preferences, stored.dashboardOpen, stored.stretchVideo);
    const history = isHistoryState(stored.history) ? stored.history : this.migrateHistory(stored.history, stored.vacnetHistory, stored.vacnetHistoryStats);
    return { preferences, history };
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    await browser.storage.local.set({ preferences });
  }

  async saveHistory(history: HistoryState): Promise<void> {
    await browser.storage.local.set({ history });
  }

  find(history: HistoryState, clip: ClipData): HistoryLookup {
    const entries = Object.values(history.entries).sort((first, second) => second.timestamp - first.timestamp);
    const serverToleranceMs = 1000;
    const currentStartMs = Math.round(clip.range.start * 1_000);
    const currentEndMs = Math.round(clip.range.end * 1_000);
    const exact = entries.find((entry) => {
      if (entry.identityVersion !== 2 || entry.videoId !== clip.videoId) return false;
      const savedStartMs = Math.round(entry.range.start * 1_000);
      const savedEndMs = Math.round(entry.range.end * 1_000);
      return Math.abs(savedStartMs - currentStartMs) <= serverToleranceMs && Math.abs(savedEndMs - currentEndMs) <= serverToleranceMs;
    });
    if (exact) return { status: 'exact-duplicate', entry: exact };
    const sameVideo = entries.find((entry) => entry.videoId === clip.videoId && !(Math.abs(Math.round(entry.range.start * 1_000) - currentStartMs) <= serverToleranceMs && Math.abs(Math.round(entry.range.end * 1_000) - currentEndMs) <= serverToleranceMs));
    if (sameVideo) return { status: 'same-match-different-clip', entry: sameVideo };
    return { status: 'new-match', entry: null };
  }

  recordRepeat(history: HistoryState): HistoryState {
    return {
      ...history,
      stats: { repeats: history.stats.repeats + 1 },
    };
  }

  saveEntry(history: HistoryState, entry: ClipHistoryEntry): HistoryState {
    const entries = { ...history.entries, [historyKey(entry)]: entry };
    const sorted = Object.entries(entries).sort(([, first], [, second]) => first.timestamp - second.timestamp);
    sorted.slice(0, Math.max(0, sorted.length - historyLimit)).forEach(([key]) => delete entries[key]);
    return { ...history, entries };
  }

  private migratePreferences(value: unknown, dashboardOpen: unknown, stretchVideo: unknown): Preferences {
    const legacy = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return {
      dashboardOpen: typeof legacy.dashboardOpen === 'boolean' ? legacy.dashboardOpen : typeof dashboardOpen === 'boolean' ? dashboardOpen : false,
      stretchVideo: typeof legacy.stretchVideo === 'boolean' ? legacy.stretchVideo : typeof stretchVideo === 'boolean' ? stretchVideo : false,
      autoApplyRepeatVerdicts: typeof legacy.autoApplyRepeatVerdicts === 'boolean' ? legacy.autoApplyRepeatVerdicts : defaultPreferences.autoApplyRepeatVerdicts,
      volume: typeof legacy.volume === 'number' && legacy.volume >= 0 && legacy.volume <= 1 ? legacy.volume : defaultPreferences.volume,
      muted: typeof legacy.muted === 'boolean' ? legacy.muted : false,
    };
  }

  private migrateHistory(stateValue: unknown, entriesValue: unknown, statsValue: unknown): HistoryState {
    const history = emptyHistory();
    const state = this.record(stateValue);
    const sourceEntries = this.record(state?.entries) ?? this.record(entriesValue);
    if (sourceEntries) Object.values(sourceEntries).forEach((value) => {
      const migrated = this.migrateEntry(value);
      if (migrated) history.entries[historyKey(migrated)] = migrated;
    });
    const stats = this.record(state?.stats) ?? this.record(statsValue);
    if (stats) {
      const repeats = stats.repeats;
      if (typeof repeats === 'number' && Number.isFinite(repeats)) history.stats.repeats = repeats;
    }
    return history;
  }

  private migrateEntry(value: unknown): ClipHistoryEntry | null {
    const entry = this.record(value);
    if (!entry || typeof entry.taskId !== 'string' || typeof entry.sourceWebmUrl !== 'string' || typeof entry.timestamp !== 'number' || !isVerdictSelection(entry)) return null;
    const source = entry as Record<string, unknown>;
    const taskId = source.taskId;
    const sourceWebmUrl = source.sourceWebmUrl;
    const timestamp = source.timestamp;
    if (typeof taskId !== 'string' || typeof sourceWebmUrl !== 'string' || typeof timestamp !== 'number') return null;
    const range = this.range(source.range);
    const videoId = typeof source.videoId === 'string' && source.videoId.trim() ? source.videoId : extractVideoId(sourceWebmUrl);
    const identity = createClipIdentity({ videoId, range });
    return {
      aimassist: entry.aimassist,
      wallhack: entry.wallhack,
      autobhop: entry.autobhop,
      bot: entry.bot,
      // Time ranges from versions before canonical page state cannot be verified.
      identityVersion: 1,
      taskId,
      sourceWebmUrl,
      videoId,
      clipCount: typeof source.clipCount === 'string' ? source.clipCount : null,
      app: typeof source.app === 'string' && source.app.trim() ? source.app : '730',
      range,
      eventTime: typeof source.eventTime === 'number' && Number.isFinite(source.eventTime) && source.eventTime >= 0 ? source.eventTime : range.start,
      clipKey: identity.clipKey,
      deduplication: this.deduplication(source.deduplication),
      timestamp,
      badClip: typeof source.badClip === 'boolean' ? source.badClip : false,
    };
  }

  private record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

  private range(value: unknown): ClipRange {
    const range = this.record(value);
    const start = typeof range?.start === 'number' && Number.isFinite(range.start) && range.start >= 0 ? range.start : 0;
    const end = typeof range?.end === 'number' && Number.isFinite(range.end) && range.end > start ? range.end : start + 12;
    return { start, end };
  }

  private deduplication(value: unknown): ClipDeduplication {
    return value === 'exact-duplicate' || value === 'same-match-different-clip' ? value : 'new-match';
  }
}
