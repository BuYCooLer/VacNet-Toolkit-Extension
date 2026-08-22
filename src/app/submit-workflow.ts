import type { ClipData } from '../entities/clip';
import type { ValveTimerHijacker } from '../features/valve-interop/timer-hijacker';
import type { SubmitCommand, SubmitRequestFactory, ValvePageClient, NextPageReader, ValvePageCommitter, HistoryPersistencePort, PageNavigator, ClipActivationPort, PlayerTransitionPort } from './submit-ports';

export interface SubmitWorkflowOptions {
  requestFactory: SubmitRequestFactory;
  pageClient: ValvePageClient;
  pageReader: NextPageReader;
  pageCommitter: ValvePageCommitter;
  history: HistoryPersistencePort;
  navigator: PageNavigator;
  activation: ClipActivationPort;
  playerTransition: PlayerTransitionPort;
  timerHijacker: ValveTimerHijacker;
  getContext: () => { clip: ClipData };
  onSubmitting: (submitting: boolean) => void;
  onError: (message: string) => void;
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class SubmitWorkflow {
  private activeController: AbortController | null = null;
  private isDisposed = false;

  private readonly options: SubmitWorkflowOptions;

  constructor(options: SubmitWorkflowOptions) {
    this.options = options;
  }

  async submit(command: SubmitCommand): Promise<void> {
    if (this.isDisposed || this.activeController) return;

    const controller = new AbortController();
    let acceptedPageUrl: string | null = null;
    this.activeController = controller;

    try {
      this.options.onSubmitting(true);
      const context = this.options.getContext();
      const request = this.options.requestFactory.create(command, controller.signal);
      const response = await this.options.pageClient.submit(request);
      acceptedPageUrl = response.url;

      const historyPersistence = this.options.history.save({
        clip: context.clip,
        verdicts: command.verdicts,
        badClip: command.badClip,
      }).then(
        () => null,
        (error: unknown) => describeError(error),
      );

      if (!response.contentType.toLowerCase().includes('text/html')) {
        throw new Error(`Valve returned unsupported content type: ${response.contentType || 'missing'}.`);
      }

      const nextPage = await this.options.pageReader.read(await response.text(), acceptedPageUrl);
      this.options.pageCommitter.validate(nextPage);
      this.options.timerHijacker.markClipTransition();
      this.options.pageCommitter.commit(nextPage);
      this.options.activation.activate(nextPage);
      await this.options.playerTransition.transition(nextPage.clip);
      void historyPersistence.then((historyError) => {
        if (historyError && !this.isDisposed) {
          this.options.onError(`Verdict accepted, but local history failed: ${historyError}`);
        }
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (acceptedPageUrl) this.options.navigator.replace(acceptedPageUrl);
      this.options.onError(describeError(error));
    } finally {
      if (this.activeController === controller) this.activeController = null;
      this.options.onSubmitting(false);
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.activeController?.abort();
    this.activeController = null;
  }
}
