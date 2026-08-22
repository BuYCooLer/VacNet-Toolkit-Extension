import { createClipIdentity, type ClipData, type ClipDeduplication } from '../entities/clip';
import { readValveClip, type ParsedValvePage } from '../features/valve-interop/clip-reader';
import { storeInitialValveClip } from '../features/valve-interop/page-synchronizer';
import type { MainMessageBus } from '../shared/message-bus';
import type { VerdictSelection } from '../entities/verdict';

interface ClipCoordinatorOptions {
  bus: MainMessageBus;
  onStateChanged: () => void;
  onError: (message: string) => void;
  onActivated: (page: ParsedValvePage) => void;
}

export class ClipCoordinator {
  constructor(private readonly options: ClipCoordinatorOptions) {}

  async initialize(): Promise<ClipData> {
    const clip = await readValveClip(document, location.href, (url) => this.options.bus.readWebmMetadata({ url }));
    storeInitialValveClip(clip);
    return clip;
  }

  activate(page: ParsedValvePage): void { this.options.onActivated(page); }

  async identify(clip: ClipData, isCurrent: () => boolean, setState: (state: { status: ClipDeduplication; previous: VerdictSelection | null; identity: string }) => void): Promise<void> {
    const { identity } = createClipIdentity(clip);
    try {
      const lookup = await this.options.bus.findHistory({ clip });
      if (!isCurrent()) return;
      const previous: VerdictSelection | null = lookup.entry ? {
        aimassist: lookup.entry.aimassist,
        wallhack: lookup.entry.wallhack,
        autobhop: lookup.entry.autobhop,
        bot: lookup.entry.bot,
      } : null;
      setState({ status: lookup.status, previous, identity });
      this.options.onStateChanged();
    } catch (error) {
      if (!isCurrent()) return;
      this.options.onError(`History lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
