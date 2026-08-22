import { parseValvePage } from '../features/valve-interop/clip-reader';
import { commitValvePage, validateValveCommit } from '../features/valve-interop/page-synchronizer';
import { createValveSubmitRequest } from '../features/valve-interop/verdict-form-adapter';
import type { MainMessageBus } from '../shared/message-bus';
import type { SubmitCommand, SubmitRequestFactory, ValvePageClient, NextPageReader, ValvePageCommitter, HistoryPersistencePort, PageNavigator, ClipActivationPort, PlayerTransitionPort } from './submit-ports';
import type { ParsedValvePage } from '../features/valve-interop/clip-reader';

export const createSubmitAdapters = (options: {
  bus: MainMessageBus;
  onActivated: (page: ParsedValvePage) => void;
  playerTransition: PlayerTransitionPort;
}): {
  requestFactory: SubmitRequestFactory;
  pageClient: ValvePageClient;
  pageReader: NextPageReader;
  pageCommitter: ValvePageCommitter;
  history: HistoryPersistencePort;
  navigator: PageNavigator;
  activation: ClipActivationPort;
  playerTransition: PlayerTransitionPort;
} => ({
  requestFactory: { create: (command: SubmitCommand, signal: AbortSignal) => createValveSubmitRequest(command.verdicts, command.badClip, signal) },
  pageClient: { submit: async (request) => {
    const response = await fetch(request.url, request.init);
    if (!response.ok) throw new Error(`Valve returned HTTP ${response.status}.`);
    return { url: response.url || location.href, contentType: response.headers.get('content-type') ?? '', text: () => response.text() };
  } },
  pageReader: { read: (html, baseUrl) => parseValvePage(html, baseUrl, (url) => options.bus.readWebmMetadata({ url })) },
  pageCommitter: { validate: validateValveCommit, commit: commitValvePage },
  history: { save: (params) => options.bus.saveHistory(params) },
  navigator: { replace: (url) => location.replace(url) },
  activation: { activate: options.onActivated },
  playerTransition: options.playerTransition,
});
