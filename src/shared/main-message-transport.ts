import type { HistoryLookup } from '../entities/history';
import {
  parseToMainWireMessage,
  type HistoryFindParams,
  type HistorySaveParams,
  type IsolatedEvent,
  type WebmMetadata,
  type WebmMetadataReadParams,
  type ToMainWireMessage,
  type RemoteFailure,
} from './protocol';

type WireResult<T> = { ok: true; value: T } | { ok: false; error: unknown };
import { MessageBusError, type MainMessageBus, type PendingRequest } from './message-bus-contracts';
import type { RequestMethod } from './message-bus-contracts';
import { dispatchHistoryFindRequest, dispatchHistorySaveRequest, dispatchWebmMetadataRequest, dispatchToIsolated, remoteError, REQUEST_TIMEOUT_MS, timeoutError } from './message-bus-wire';

export const createMainMessageTransport = (): MainMessageBus => {
  const POST_MESSAGE_KEY = 'vacnet:message-bus';
  const TO_MAIN_CHANNEL = 'to-main';
  const listeners = new Set<(event: IsolatedEvent) => void>();
  const pendingHistoryFind = new Map<string, PendingRequest<HistoryLookup>>();
  const pendingHistorySave = new Map<string, PendingRequest<null>>();
  const pendingWebmMetadataRead = new Map<string, PendingRequest<WebmMetadata | null>>();
  let isDisposed = false;

  const handleResponse = <T>(
    message: Extract<ToMainWireMessage, { kind: 'response' }>,
    pendingMap: Map<string, PendingRequest<T>>,
  ): void => {
    const pending = pendingMap.get(message.id);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pendingMap.delete(message.id);
    const result = message.result as WireResult<T>;
    if (result.ok) pending.resolve(result.value);
    else pending.reject(remoteError(message.method, message.id, result.error as RemoteFailure));
  };

  const receive = (event: MessageEvent): void => {
    if (isDisposed || event.origin !== window.location.origin) return;
    const data = event.data as Record<string, unknown> | null | undefined;
    if (!data || typeof data !== 'object') return;
    const payload = data[POST_MESSAGE_KEY] as { channel: string; message: unknown } | null | undefined;
    if (!payload || typeof payload !== 'object' || payload.channel !== TO_MAIN_CHANNEL) return;
    const message = parseToMainWireMessage(payload.message);
    if (!message) return;
    if (message.kind === 'event') {
      for (const listener of listeners) listener(message.event);
      return;
    }
    switch (message.method) {
      case 'history.find': return handleResponse(message, pendingHistoryFind);
      case 'history.save': return handleResponse(message, pendingHistorySave);
      case 'webm-metadata.read': return handleResponse(message, pendingWebmMetadataRead);
    }
  };

  window.addEventListener('message', receive);

  const request = <T>(
    method: RequestMethod,
    params: HistoryFindParams | HistorySaveParams | WebmMetadataReadParams,
    pending: Map<string, PendingRequest<T>>,
    label: string,
    send: (id: string, params: HistoryFindParams | HistorySaveParams | WebmMetadataReadParams) => void,
  ): Promise<T> => {
    if (isDisposed) return Promise.reject(new MessageBusError('disposed', 'MAIN message bus is disposed.', method));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pending.delete(id);
        reject(timeoutError(method, id, label));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timeoutId });
      send(id, params);
    });
  };

  return {
    emit: (event) => {
      if (isDisposed) throw new MessageBusError('disposed', 'MAIN message bus is disposed.');
      dispatchToIsolated({ kind: 'event', event });
    },
    subscribe: (listener) => {
      if (isDisposed) throw new MessageBusError('disposed', 'MAIN message bus is disposed.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    findHistory: (params) => request('history.find', params, pendingHistoryFind, 'History lookup', (id, value) => dispatchHistoryFindRequest(id, value as HistoryFindParams)),
    saveHistory: (params) => request('history.save', params, pendingHistorySave, 'History persistence', (id, value) => dispatchHistorySaveRequest(id, value as HistorySaveParams)).then(() => undefined),
    readWebmMetadata: (params) => request('webm-metadata.read', params, pendingWebmMetadataRead, 'WebM metadata lookup', (id, value) => dispatchWebmMetadataRequest(id, value as WebmMetadataReadParams)),
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      window.removeEventListener('message', receive);
      listeners.clear();
      const error = new MessageBusError('disposed', 'MAIN message bus is disposed.');
      for (const pendingMap of [pendingHistoryFind, pendingHistorySave, pendingWebmMetadataRead]) {
        for (const pending of pendingMap.values()) {
          window.clearTimeout(pending.timeoutId);
          pending.reject(error);
        }
        pendingMap.clear();
      }
    },
  };
};
