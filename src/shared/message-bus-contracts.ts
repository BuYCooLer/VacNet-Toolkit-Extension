import type { HistoryLookup } from '../entities/history';
import type {
  HistoryFindParams,
  HistorySaveParams,
  IsolatedEvent,
  MainEvent,
  WebmMetadata,
  WebmMetadataReadParams,
} from './protocol';

export type Unsubscribe = () => void;
export type RequestMethod = 'history.find' | 'history.save' | 'webm-metadata.read';

export interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: MessageBusError) => void;
  timeoutId: number;
}

export class MessageBusError extends Error {
  constructor(
    readonly code: 'timeout' | 'disposed' | 'duplicate-handler' | 'remote',
    message: string,
    readonly method?: RequestMethod,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'MessageBusError';
  }
}

export interface MainMessageBus {
  emit: (event: MainEvent) => void;
  subscribe: (listener: (event: IsolatedEvent) => void) => Unsubscribe;
  findHistory: (params: HistoryFindParams) => Promise<HistoryLookup>;
  saveHistory: (params: HistorySaveParams) => Promise<void>;
  readWebmMetadata: (params: WebmMetadataReadParams) => Promise<WebmMetadata | null>;
  dispose: () => void;
}

export interface IsolatedMessageBus {
  emit: (event: IsolatedEvent) => void;
  subscribe: (listener: (event: MainEvent) => void) => Unsubscribe;
  handleHistoryFind: (handler: (params: HistoryFindParams) => Promise<HistoryLookup>) => Unsubscribe;
  handleHistorySave: (handler: (params: HistorySaveParams) => Promise<void>) => Unsubscribe;
  handleWebmMetadataRead: (handler: (params: WebmMetadataReadParams) => Promise<WebmMetadata | null>) => Unsubscribe;
  dispose: () => void;
}
