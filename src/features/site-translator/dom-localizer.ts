import type { MessageCatalog } from '../../shared/i18n';
import { DomObserver } from './dom-observer';
import { TextMutator } from './text-mutator';
import { createTranslations } from './translator-config';

export class DomLocalizer {
  private readonly mutator: TextMutator;
  private readonly observer: DomObserver;
  private isStarted = false;

  constructor(catalog: MessageCatalog) {
    this.mutator = new TextMutator(createTranslations(catalog));
    this.observer = new DomObserver((root) => this.mutator.translate(root));
  }

  start(): void {
    if (this.isStarted || !this.mutator.isActive) return;
    this.isStarted = true;
    this.observer.start();
    this.mutator.translate(document.documentElement);
  }

  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;
    this.observer.stop();
  }
}
