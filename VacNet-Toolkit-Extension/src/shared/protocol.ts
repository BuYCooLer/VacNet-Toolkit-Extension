import type { ClipData, PageSnapshot, PlayerMetrics } from '../domain/clip';
import { isHistoryLookup, type HistoryLookup } from '../domain/history';
import { isPreferences, type Preferences } from '../domain/preferences';
import { isVerdictSelection, type VerdictSelection } from '../domain/verdict';
import { messageKeys, type MessageCatalog } from './i18n';
import { isRecord, parseJson } from './json';

export const toPageEvent = 'vacnet:v2:to-page';
export const fromPageEvent = 'vacnet:v2:from-page';

export type DashboardMode = 'metrics' | 'history';

export type ToPageMessage =
  | { type: 'initialize'; catalog: MessageCatalog; preferences: Preferences }
  | { type: 'preferences'; preferences: Preferences }
  | { type: 'history-result'; requestId: string; lookup: HistoryLookup | null }
  | { type: 'command'; command: 'toggle-stretch' | 'request-state' };

export type FromPageMessage =
  | { type: 'ready' }
  | { type: 'snapshot'; snapshot: PageSnapshot }
  | { type: 'clip-updated'; clip: ClipData }
  | { type: 'player-metrics'; metrics: PlayerMetrics }
  | { type: 'preferences'; preferences: Partial<Preferences> }
  | { type: 'history-find'; requestId: string; clip: ClipData }
  | { type: 'history-save'; requestId: string; clip: ClipData; deduplication: HistoryLookup['status']; verdicts: VerdictSelection; badClip: boolean };

export const dispatchToPage = (message: ToPageMessage): void => dispatch(toPageEvent, message);

export const dispatchFromPage = (message: FromPageMessage): void => dispatch(fromPageEvent, message);

export const parseToPageMessage = (detail: unknown): ToPageMessage | null => {
  const value = parseWire(detail);
  if (!value || typeof value.type !== 'string') return null;
  if (value.type === 'initialize' && isMessageCatalog(value.catalog) && isPreferences(value.preferences)) {
    return { type: 'initialize', catalog: value.catalog, preferences: value.preferences };
  }
  if (value.type === 'preferences' && isPreferences(value.preferences)) return { type: 'preferences', preferences: value.preferences };
  if (value.type === 'history-result' && typeof value.requestId === 'string' && (value.lookup === null || isHistoryLookup(value.lookup))) {
    return { type: 'history-result', requestId: value.requestId, lookup: value.lookup };
  }
  if (value.type === 'command' && isCommand(value.command)) return { type: 'command', command: value.command };
  return null;
};

export const parseFromPageMessage = (detail: unknown): FromPageMessage | null => {
  const value = parseWire(detail);
  if (!value || typeof value.type !== 'string') return null;
  if (value.type === 'ready') return { type: 'ready' };
  if (value.type === 'snapshot' && isPageSnapshot(value.snapshot)) return { type: 'snapshot', snapshot: value.snapshot };
  if (value.type === 'clip-updated' && isClipData(value.clip)) return { type: 'clip-updated', clip: value.clip };
  if (value.type === 'player-metrics' && isPlayerMetrics(value.metrics)) return { type: 'player-metrics', metrics: value.metrics };
  if (value.type === 'preferences' && isPreferencesPatch(value.preferences)) return { type: 'preferences', preferences: value.preferences };
  if (value.type === 'history-find' && isHistoryRequest(value)) {
    return {
      type: 'history-find',
      requestId: value.requestId,
      clip: value.clip,
    };
  }
  if (value.type === 'history-save' && isHistoryRequest(value) && isVerdictSelection(value.verdicts) && typeof value.badClip === 'boolean' && isDeduplication(value.deduplication)) {
    return {
      type: 'history-save',
      requestId: value.requestId,
      clip: value.clip,
      deduplication: value.deduplication,
      verdicts: value.verdicts,
      badClip: value.badClip,
    };
  }
  return null;
};

const dispatch = (name: string, message: ToPageMessage | FromPageMessage): void => {
  document.dispatchEvent(new CustomEvent<string>(name, { detail: JSON.stringify(message) }));
};

const parseWire = (detail: unknown): Record<string, unknown> | null => {
  if (typeof detail !== 'string' || detail.length > 100_000) return null;
  const parsed = parseJson(detail);
  return isRecord(parsed) ? parsed : null;
};

const isCommand = (value: unknown): value is Extract<ToPageMessage, { type: 'command' }>['command'] =>
  value === 'toggle-stretch' || value === 'request-state';

const isMessageCatalog = (value: unknown): value is MessageCatalog => {
  if (!isRecord(value) || (value.videoJsLocale !== 'ru' && value.videoJsLocale !== 'en')) return false;
  return messageKeys.every((key) => typeof value[key] === 'string');
};

const isClipRange = (value: unknown): value is ClipData['range'] =>
  isRecord(value) && isFiniteNumber(value.start) && isFiniteNumber(value.end);

const isClipData = (value: unknown): value is ClipData =>
  isRecord(value)
  && typeof value.taskId === 'string'
  && typeof value.sourceWebmUrl === 'string'
  && typeof value.videoId === 'string'
  && isClipRange(value.range)
  && isFiniteNumber(value.eventTime)
  && (value.clipCount === null || typeof value.clipCount === 'string')
  && typeof value.app === 'string';

const isPlayerMetrics = (value: unknown): value is PlayerMetrics =>
  isRecord(value)
  && typeof value.id === 'string'
  && (value.version === null || typeof value.version === 'string')
  && (value.language === null || typeof value.language === 'string')
  && typeof value.debugEnabled === 'boolean'
  && isFiniteNumber(value.players)
  && isFiniteNumber(value.frameDuration);

const isPageSnapshot = (value: unknown): value is PageSnapshot =>
  isRecord(value)
  && (value.clip === null || isClipData(value.clip))
  && (value.deduplication === null || isDeduplication(value.deduplication))
  && (value.player === null || isPlayerMetrics(value.player))
  && typeof value.hasVideo === 'boolean'
  && typeof value.submitting === 'boolean'
  && (value.error === null || typeof value.error === 'string');

const isPreferencesPatch = (value: unknown): value is Partial<Preferences> => {
  if (!isRecord(value)) return false;
  const allowed = new Set(['dashboardOpen', 'stretchVideo', 'autoApplyRepeatVerdicts', 'volume', 'muted']);
  if (!Object.keys(value).every((key) => allowed.has(key))) return false;
  return (value.dashboardOpen === undefined || typeof value.dashboardOpen === 'boolean')
    && (value.stretchVideo === undefined || typeof value.stretchVideo === 'boolean')
    && (value.autoApplyRepeatVerdicts === undefined || typeof value.autoApplyRepeatVerdicts === 'boolean')
    && (value.volume === undefined || isFiniteNumber(value.volume) && value.volume >= 0 && value.volume <= 1)
    && (value.muted === undefined || typeof value.muted === 'boolean');
};

const isHistoryRequest = (value: Record<string, unknown>): value is Record<string, unknown> & {
  requestId: string;
  clip: ClipData;
} => typeof value.requestId === 'string'
&& value.requestId.length <= 128
  && isClipData(value.clip);

const isDeduplication = (value: unknown): value is HistoryLookup['status'] =>
  value === 'new-match' || value === 'same-match-different-clip' || value === 'exact-duplicate';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

declare global {
  interface DocumentEventMap {
    'vacnet:v2:to-page': CustomEvent<string>;
    'vacnet:v2:from-page': CustomEvent<string>;
  }
}
