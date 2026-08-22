import { z } from 'zod';

export const PreferencesSchema = z.strictObject({
  dashboardOpen: z.boolean(),
  stretchVideo: z.boolean(),
  hideNickname: z.boolean(),
  keepControlsVisible: z.boolean(),
  autoApplyRepeatVerdicts: z.boolean(),
  volume: z.number().finite().min(0).max(1),
  muted: z.boolean(),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export type PreferencesPatch = Partial<Preferences>;

export const PREFERENCES_STATE_VERSION = 5 as const;

const DEFAULT_PREFERENCES: Preferences = {
  dashboardOpen: false,
  stretchVideo: false,
  hideNickname: true,
  keepControlsVisible: false,
  autoApplyRepeatVerdicts: false,
  volume: 0.1,
  muted: false,
};

export const createDefaultPreferences = (): Preferences => ({ ...DEFAULT_PREFERENCES });

export const defaultPreferences: Readonly<Preferences> = DEFAULT_PREFERENCES;
