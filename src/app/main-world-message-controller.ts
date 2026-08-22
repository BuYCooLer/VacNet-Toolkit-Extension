import type { MainMessageBus } from '../shared/message-bus';
import type { IsolatedEvent, PlayerCommand, ReviewCommand } from '../shared/protocol';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled isolated event: ${String(value)}`);
};

interface MessageControllerOptions {
  bus: MainMessageBus;
  onInitialize: (event: Extract<IsolatedEvent, { type: 'initialize' }>) => void;
  onPreferences: (preferences: Extract<IsolatedEvent, { type: 'preferences' }>['preferences']) => void;
  onReviewCommand: (command: ReviewCommand) => void;
  onPlayerCommand: (command: PlayerCommand) => void;
}

export class MainWorldMessageController {
  private readonly unsubscribe: () => void;

  constructor(private readonly options: MessageControllerOptions) {
    this.unsubscribe = options.bus.subscribe((event) => this.receive(event));
  }

  dispose(): void { this.unsubscribe(); }

  private receive(event: IsolatedEvent): void {
    switch (event.type) {
      case 'initialize': this.options.onInitialize(event); return;
      case 'preferences': this.options.onPreferences(event.preferences); return;
      case 'review-command': this.options.onReviewCommand(event.command); return;
      case 'player-command': this.options.onPlayerCommand(event.command); return;
    }
    assertNever(event);
  }
}
