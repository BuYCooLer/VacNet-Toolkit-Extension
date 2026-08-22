import type { RemoteFailure, ToMainWireMessage, FromMainWireMessage, HistoryFindParams, HistorySaveParams, WebmMetadata, WebmMetadataReadParams } from './protocol';
import type { HistoryLookup } from '../entities/history';
import { fromMainEvent, toMainEvent } from './protocol';
import { MessageBusError, type RequestMethod } from './message-bus-contracts';

export const REQUEST_TIMEOUT_MS = 5_000;

const POST_MESSAGE_KEY = 'vacnet:message-bus';
const TO_MAIN_CHANNEL = 'to-main';
const FROM_MAIN_CHANNEL = 'from-main';

interface PostMessagePayload {
  channel: typeof TO_MAIN_CHANNEL | typeof FROM_MAIN_CHANNEL;
  message: ToMainWireMessage | FromMainWireMessage;
}

export const dispatch = (_name: string, message: ToMainWireMessage | FromMainWireMessage, channel: typeof TO_MAIN_CHANNEL | typeof FROM_MAIN_CHANNEL): void => {
  const payload: PostMessagePayload = { channel, message };
  window.postMessage({ [POST_MESSAGE_KEY]: payload }, window.location.origin);
};

export const dispatchToMain = (message: ToMainWireMessage): void => dispatch(toMainEvent, message, TO_MAIN_CHANNEL);
export const dispatchToIsolated = (message: FromMainWireMessage): void => dispatch(fromMainEvent, message, FROM_MAIN_CHANNEL);

export const dispatchHistoryFindRequest = (id: string, params: HistoryFindParams): void =>
  dispatch(fromMainEvent, { kind: 'request', id, method: 'history.find', params }, FROM_MAIN_CHANNEL);

export const dispatchHistorySaveRequest = (id: string, params: HistorySaveParams): void =>
  dispatch(fromMainEvent, { kind: 'request', id, method: 'history.save', params }, FROM_MAIN_CHANNEL);

export const dispatchWebmMetadataRequest = (id: string, params: WebmMetadataReadParams): void =>
  dispatch(fromMainEvent, { kind: 'request', id, method: 'webm-metadata.read', params }, FROM_MAIN_CHANNEL);

export const dispatchHistoryFindResponse = (id: string, value: HistoryLookup): void =>
  dispatch(toMainEvent, { kind: 'response', id, method: 'history.find', result: { ok: true, value } }, TO_MAIN_CHANNEL);

export const dispatchHistorySaveResponse = (id: string): void =>
  dispatch(toMainEvent, { kind: 'response', id, method: 'history.save', result: { ok: true, value: null } }, TO_MAIN_CHANNEL);

export const dispatchWebmMetadataResponse = (id: string, value: WebmMetadata | null): void =>
  dispatch(toMainEvent, { kind: 'response', id, method: 'webm-metadata.read', result: { ok: true, value } }, TO_MAIN_CHANNEL);

export const dispatchFailure = (
  id: string,
  method: 'history.find' | 'history.save' | 'webm-metadata.read',
  error: RemoteFailure,
): void => dispatch(toMainEvent, { kind: 'response', id, method, result: { ok: false, error } }, TO_MAIN_CHANNEL);

export const remoteError = (method: RequestMethod, requestId: string, failure: RemoteFailure): MessageBusError =>
  new MessageBusError('remote', `${failure.code}: ${failure.message}`, method, requestId);

export const timeoutError = (method: RequestMethod, requestId: string, label: string): MessageBusError =>
  new MessageBusError('timeout', `${label} timed out.`, method, requestId);

export const failure = (error: unknown): RemoteFailure => ({
  code: 'handler-failed',
  message: error instanceof Error ? error.message : String(error),
});
