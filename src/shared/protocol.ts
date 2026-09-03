import { z } from 'zod';
import type { ClipData, PageSnapshot } from '../entities/clip';
import type { Preferences } from '../entities/preferences';
import type { VerdictSelection } from '../entities/verdict';
import type { MessageCatalog } from './i18n';

export const toMainEvent = 'vacnet:v3:to-main';
export const fromMainEvent = 'vacnet:v3:from-main';

export const WebmMetadataSchema = z.strictObject({
  matchTimestamp: z.number().finite().nonnegative(),
  duration: z.number().finite().nonnegative(),
});

export type ReviewCommand =
  | { type: 'set-verdict'; name: 'aimassist' | 'wallhack' | 'autobhop' | 'bot'; value: 'positive' | 'negative' | 'skip' }
  | { type: 'set-verdicts'; verdicts: VerdictSelection }
  | { type: 'submit'; verdicts: VerdictSelection; badClip: boolean };

export type PlayerCommand =
  | { type: 'toggle-playback' }
  | { type: 'restart' }
  | { type: 'toggle-zoom' }
  | { type: 'step'; direction: -1 | 1 };

export type IsolatedEvent =
  | { type: 'initialize'; catalog: MessageCatalog; preferences: Preferences }
  | { type: 'preferences'; preferences: Partial<Preferences> }
  | { type: 'review-command'; command: ReviewCommand }
  | { type: 'player-command'; command: PlayerCommand };

export type MainEvent =
  | { type: 'ready' }
  | { type: 'initialized' }
  | { type: 'snapshot'; snapshot: PageSnapshot }
  | { type: 'preferences'; preferences: Partial<Preferences> };

export type HistoryFindParams = { clip: ClipData };
export type HistorySaveParams = { clip: ClipData; verdicts: VerdictSelection; badClip: boolean };
export type WebmMetadata = z.infer<typeof WebmMetadataSchema>;
export type WebmMetadataReadParams = { url: string };

export type RemoteFailure = { code: 'handler-unavailable' | 'handler-failed'; message: string };

type WireResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RemoteFailure };

export type ToMainWireMessage =
  | { kind: 'event'; event: IsolatedEvent }
  | { kind: 'response'; id: string; method: 'history.find' | 'history.save' | 'webm-metadata.read'; result: WireResult<unknown> };

export type FromMainWireMessage =
  | { kind: 'event'; event: MainEvent }
  | { kind: 'request'; id: string; method: 'history.find' | 'history.save' | 'webm-metadata.read'; params: Record<string, unknown> };

const isValidId = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= 128;
const isValidMethod = (value: unknown): value is 'history.find' | 'history.save' | 'webm-metadata.read' =>
  value === 'history.find' || value === 'history.save' || value === 'webm-metadata.read';

const validateRemoteFailure = (value: unknown): value is { code: string; message: string } => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.code === 'string' && typeof obj.message === 'string';
};

const validateResult = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.ok === true) return true;
  if (obj.ok === false) return validateRemoteFailure(obj.error);
  return false;
};

const parseWireLightweight = (detail: unknown): unknown => {
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) return detail;
  return null;
};

const isValidIsolatedEvent = (event: unknown): event is IsolatedEvent => {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  if (e.type === undefined) return false;
  switch (e.type) {
    case 'initialize':
      return typeof e.catalog === 'object' && e.catalog !== null && typeof e.preferences === 'object';
    case 'preferences':
      return typeof e.preferences === 'object';
    case 'review-command':
      return typeof e.command === 'object' && e.command !== null;
    case 'player-command':
      return typeof e.command === 'object' && e.command !== null;
    default:
      return false;
  }
};

const isValidMainEvent = (event: unknown): event is MainEvent => {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  if (e.type === undefined) return false;
  switch (e.type) {
    case 'ready':
    case 'initialized':
      return true;
    case 'snapshot':
      return typeof e.snapshot === 'object' && e.snapshot !== null;
    case 'preferences':
      return typeof e.preferences === 'object';
    default:
      return false;
  }
};

export const parseToMainWireMessage = (detail: unknown): ToMainWireMessage | null => {
  const msg = parseWireLightweight(detail);
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as Record<string, unknown>;
  if (m.kind === 'event') {
    if (!isValidIsolatedEvent(m.event)) return null;
    return { kind: 'event', event: m.event };
  }
  if (m.kind === 'response' && isValidId(m.id) && isValidMethod(m.method) && validateResult(m.result)) {
    return {
      kind: 'response',
      id: m.id,
      method: m.method,
      result: m.result as WireResult<unknown>,
    };
  }
  return null;
};

export const parseFromMainWireMessage = (detail: unknown): FromMainWireMessage | null => {
  const msg = parseWireLightweight(detail);
  if (typeof msg !== 'object' || msg === null) return null;
  const m = msg as Record<string, unknown>;
  if (m.kind === 'event') {
    if (!isValidMainEvent(m.event)) return null;
    return { kind: 'event', event: m.event };
  }
  if (m.kind === 'request' && isValidId(m.id) && isValidMethod(m.method) && typeof m.params === 'object' && m.params !== null) {
    return {
      kind: 'request',
      id: m.id,
      method: m.method,
      params: { ...m.params },
    };
  }
  return null;
};

declare global {
  interface WindowEventMap {
    'message': MessageEvent;
  }
}
