/** Runtime schema for the preferences declared in ./preferences.ts. */
import { z } from 'zod';
import { CustomPresetSchema } from './verdict.schema';
import { DEFAULT_PRESETS } from './verdict';
import { themeColors, themeModes, languages, type Preferences } from './preferences';

const asEnum = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]]);

export const PreferencesSchema: z.ZodType<Preferences, z.ZodTypeDef, unknown> = z.object({
  dashboardOpen: z.boolean().default(false),
  stretchVideo: z.boolean().default(false),
  hideNickname: z.boolean().default(true),
  keepControlsVisible: z.boolean().default(false),
  autoApplyRepeatVerdicts: z.boolean().default(false),
  volume: z.number().finite().min(0).max(1).default(0.1),
  muted: z.boolean().default(false),
  language: asEnum(languages).default('auto'),
  autoSubmitPreset: z.boolean().default(false),
  customPresets: z.array(CustomPresetSchema).default(DEFAULT_PRESETS),
  theme: asEnum(themeColors).default('green'),
  themeMode: asEnum(themeModes).default('dark'),
}).passthrough();
