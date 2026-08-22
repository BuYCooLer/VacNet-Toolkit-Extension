import {
  parseFromMainWireMessage,
  type HistoryFindParams,
  type HistorySaveParams,
  type MainEvent,
  type WebmMetadataReadParams,
  type WebmMetadata,
} from './protocol';
import type { HistoryLookup } from '../entities/history';
import { MessageBusError, type IsolatedMessageBus } from './message-bus-contracts';
import { dispatchFailure, dispatchHistoryFindResponse, dispatchHistorySaveResponse, dispatchWebmMetadataResponse, dispatchToMain, failure } from './message-bus-wire';

export const createIsolatedMessageTransport = (): IsolatedMessageBus => {
  const POST_MESSAGE_KEY = 'vacnet:message-bus';
  const FROM_MAIN_CHANNEL = 'from-main';
  const listeners = new Set<(event: MainEvent) => void>();
  let historyFindHandler: ((params: HistoryFindParams) => Promise<HistoryLookup>) | null = null;
  let historySaveHandler: ((params: HistorySaveParams) => Promise<void>) | null = null;
  let webmMetadataReadHandler: ((params: WebmMetadataReadParams) => Promise<WebmMetadata | null>) | null = null;
  let isDisposed = false;

  const sendFailure = (id: string, method: 'history.find' | 'history.save' | 'webm-metadata.read', error: ReturnType<typeof failure>): void => {
    if (isDisposed) return;
    dispatchFailure(id, method, error);
  };

  const receive = (event: MessageEvent): void => {
    if (isDisposed || event.origin !== window.location.origin) return;
    const data = event.data as Record<string, unknown> | null | undefined;
    if (!data || typeof data !== 'object') return;
    const payload = data[POST_MESSAGE_KEY] as { channel: string; message: unknown } | null | undefined;
    if (!payload || typeof payload !== 'object' || payload.channel !== FROM_MAIN_CHANNEL) return;
    const message = parseFromMainWireMessage(payload.message);
    if (!message) return;
    if (message.kind === 'event') {
      for (const listener of listeners) listener(message.event);
      return;
    }
    if (message.method === 'history.find') {
      if (!historyFindHandler) {
        sendFailure(message.id, message.method, { code: 'handler-unavailable', message: 'History lookup handler is unavailable.' });
        return;
      }
      void historyFindHandler(message.params as HistoryFindParams)
        .then((value) => { if (!isDisposed) dispatchHistoryFindResponse(message.id, value); })
        .catch((error) => sendFailure(message.id, message.method, failure(error)));
      return;
    }
    if (message.method === 'webm-metadata.read') {
      if (!webmMetadataReadHandler) {
        sendFailure(message.id, message.method, { code: 'handler-unavailable', message: 'WebM metadata handler is unavailable.' });
        return;
      }
      void webmMetadataReadHandler(message.params as WebmMetadataReadParams)
        .then((value) => { if (!isDisposed) dispatchWebmMetadataResponse(message.id, value); })
        .catch((error) => sendFailure(message.id, message.method, failure(error)));
      return;
    }
    if (!historySaveHandler) {
      sendFailure(message.id, message.method, { code: 'handler-unavailable', message: 'History persistence handler is unavailable.' });
      return;
    }
    void historySaveHandler(message.params as HistorySaveParams)
      .then(() => { if (!isDisposed) dispatchHistorySaveResponse(message.id); })
      .catch((error) => sendFailure(message.id, message.method, failure(error)));
  };

  window.addEventListener('message', receive);

  const register = <T>(
    current: T | null,
    handler: T,
    set: (value: T | null) => void,
    label: string,
  ): (() => void) => {
    if (isDisposed) throw new MessageBusError('disposed', 'ISOLATED message bus is disposed.');
    if (current) throw new MessageBusError('duplicate-handler', `${label} handler is already registered.`);
    set(handler);
    return () => { if (current === handler) set(null); };
  };

  return {
    emit: (event) => {
      if (isDisposed) throw new MessageBusError('disposed', 'ISOLATED message bus is disposed.');
      dispatchToMain({ kind: 'event', event });
    },
    subscribe: (listener) => {
      if (isDisposed) throw new MessageBusError('disposed', 'ISOLATED message bus is disposed.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    handleHistoryFind: (handler) => register(historyFindHandler, handler, (value) => { historyFindHandler = value; }, 'History lookup'),
    handleHistorySave: (handler) => register(historySaveHandler, handler, (value) => { historySaveHandler = value; }, 'History persistence'),
    handleWebmMetadataRead: (handler) => register(webmMetadataReadHandler, handler, (value) => { webmMetadataReadHandler = value; }, 'WebM metadata'),
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      window.removeEventListener('message', receive);
      listeners.clear();
      historyFindHandler = null;
      historySaveHandler = null;
      webmMetadataReadHandler = null;
    },
  };
};
