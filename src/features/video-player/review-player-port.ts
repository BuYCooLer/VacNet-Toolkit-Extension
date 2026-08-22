import type { ClipData, PlayerMetrics } from '../../entities/clip';
import type { Preferences, PreferencesPatch } from '../../entities/preferences';
import type { PlayerCommand } from '../../shared/protocol';

export interface ReviewPlayerPort {
  configure: (preferences: Preferences, clip: ClipData) => void;
  applyPreferences: (preferences: Preferences) => void;
  handle: (command: PlayerCommand) => void;
  load: (source: string, clip: ClipData, signal: AbortSignal) => Promise<void>;
  metrics: () => PlayerMetrics | null;
  hasVideo: () => boolean;
  dispose: () => void;
}

export type PreferencesChangeHandler = (preferences: PreferencesPatch) => void;
