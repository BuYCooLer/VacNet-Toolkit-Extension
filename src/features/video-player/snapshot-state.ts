import type { PageSnapshot } from '../../entities/clip';
import { emptyVerdicts } from '../../entities/verdict';

export const initialPageSnapshot = (): PageSnapshot => ({
  clip: null,
  deduplication: null,
  player: null,
  verdicts: emptyVerdicts(),
  previousVerdicts: null,
  hasVideo: false,
  submitting: false,
  error: null,
});

export const normalizePageSnapshot = (snapshot: PageSnapshot): PageSnapshot => ({
  ...snapshot,
  clip: snapshot.clip ? { ...snapshot.clip, range: { ...snapshot.clip.range } } : null,
  player: snapshot.player ? { ...snapshot.player } : null,
  verdicts: { ...snapshot.verdicts },
  previousVerdicts: snapshot.previousVerdicts ? { ...snapshot.previousVerdicts } : null,
});
