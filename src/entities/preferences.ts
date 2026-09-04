/**
 * Preference shape and defaults.
 *
 * Kept free of the validation library for the same reason as ./verdict.ts —
 * the popup imports the defaults and the types only. ./preferences.schema.ts
 * holds the zod schema and the storage layer parses through that.
 */
import { DEFAULT_PRESETS, type CustomPreset } from './verdict';

export type ThemeColor = 'green' | 'gold' | 'blue' | 'red' | 'purple';
export type ThemeMode = 'dark' | 'light';
export type Language = 'auto' | 'ru' | 'en';

export const themeColors: readonly ThemeColor[] = ['green', 'gold', 'blue', 'red', 'purple'];
export const themeModes: readonly ThemeMode[] = ['dark', 'light'];
export const languages: readonly Language[] = ['auto', 'ru', 'en'];

export interface Preferences {
  dashboardOpen: boolean;
  stretchVideo: boolean;
  hideNickname: boolean;
  keepControlsVisible: boolean;
  autoApplyRepeatVerdicts: boolean;
  volume: number;
  muted: boolean;
  language: Language;
  autoSubmitPreset: boolean;
  customPresets: CustomPreset[];
  theme: ThemeColor;
  themeMode: ThemeMode;
  /* The stored object is parsed with passthrough, so unknown keys survive. */
  [key: string]: unknown;
}

export type PreferencesPatch = Partial<Preferences>;

export const PREFERENCES_STATE_VERSION = 7 as const;

const DEFAULT_PREFERENCES: Preferences = {
  dashboardOpen: false,
  stretchVideo: false,
  hideNickname: true,
  keepControlsVisible: false,
  autoApplyRepeatVerdicts: false,
  volume: 0.1,
  muted: false,
  language: 'auto',
  autoSubmitPreset: false,
  customPresets: DEFAULT_PRESETS,
  theme: 'green',
  themeMode: 'dark',
};

export const createDefaultPreferences = (): Preferences => ({ ...DEFAULT_PREFERENCES });

export const defaultPreferences: Readonly<Preferences> = DEFAULT_PREFERENCES;
