interface MainWorldLifecycleOptions {
  onDomReady: () => void;
  onDispose: () => void;
}

export class MainWorldLifecycle {
  private isDisposed = false;
  private isStarted = false;
  private readonly options: MainWorldLifecycleOptions;

  constructor(options: MainWorldLifecycleOptions) {
    this.options = options;
  }

  start(): void {
    if (this.isStarted || this.isDisposed) return;
    this.isStarted = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.handleDomReady, { once: true });
      return;
    }
    this.options.onDomReady();
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    document.removeEventListener('DOMContentLoaded', this.handleDomReady);
    this.options.onDispose();
  }

  private readonly handleDomReady = (): void => {
    if (this.isDisposed) return;
    this.options.onDomReady();
  };
}
