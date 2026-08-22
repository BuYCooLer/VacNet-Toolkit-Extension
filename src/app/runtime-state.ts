import type { ClipData, ClipDeduplication, PageSnapshot } from '../entities/clip';
import { createDefaultPreferences, type Preferences } from '../entities/preferences';
import { emptyVerdicts, type VerdictSelection } from '../entities/verdict';
import type { MessageCatalog } from '../shared/i18n';

export class RuntimeState {
  private catalog: MessageCatalog | null = null;
  private preferences: Preferences = createDefaultPreferences();
  private clip: ClipData | null = null;
  private deduplication: ClipDeduplication | null = null;
  private verdicts: VerdictSelection = emptyVerdicts();
  private previousVerdicts: VerdictSelection | null = null;
  private submitting = false;
  private error: string | null = null;

  getCatalog(): MessageCatalog | null { return this.catalog; }
  getPreferences(): Preferences { return { ...this.preferences }; }
  getClip(): ClipData | null { return this.clip ? { ...this.clip, range: { ...this.clip.range } } : null; }
  getVerdicts(): VerdictSelection { return { ...this.verdicts }; }

  setCatalog(catalog: MessageCatalog): void { this.catalog = catalog; }
  setPreferences(preferences: Preferences): void { this.preferences = { ...preferences }; }
  setDeduplication(status: ClipDeduplication | null): void { this.deduplication = status; }
  setPreviousVerdicts(verdicts: VerdictSelection | null): void {
    this.previousVerdicts = verdicts ? { ...verdicts } : null;
  }
  setSubmitting(submitting: boolean): void { this.submitting = submitting; }
  setError(error: string | null): void { this.error = error; }
  setVerdicts(verdicts: VerdictSelection): void { this.verdicts = { ...verdicts }; }
  updateVerdict(name: keyof VerdictSelection, value: VerdictSelection[keyof VerdictSelection]): void {
    this.verdicts = { ...this.verdicts, [name]: value };
  }
  resetClipState(clip: ClipData): void {
    this.clip = { ...clip, range: { ...clip.range } };
    this.deduplication = null;
    this.previousVerdicts = null;
    this.verdicts = emptyVerdicts();
    this.error = null;
  }

  snapshot(player: Pick<{ metrics: () => PageSnapshot['player']; hasVideo: () => boolean }, 'metrics' | 'hasVideo'>): PageSnapshot {
    return {
      clip: this.clip ? { ...this.clip, range: { ...this.clip.range } } : null,
      deduplication: this.deduplication,
      player: player.metrics(),
      verdicts: { ...this.verdicts },
      previousVerdicts: this.previousVerdicts ? { ...this.previousVerdicts } : null,
      hasVideo: player.hasVideo(),
      submitting: this.submitting,
      error: this.error,
    };
  }
}
