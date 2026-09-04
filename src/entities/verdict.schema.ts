/** Runtime schemas for the verdict vocabulary declared in ./verdict.ts. */
import { z } from 'zod';
import { verdictNames, verdictValues, PRESET_LABEL_MAX_LENGTH } from './verdict';

export const VerdictNameSchema = z.enum(verdictNames);

export const VerdictValueSchema = z.enum(verdictValues);

export const VerdictSelectionSchema = z.strictObject({
  aimassist: VerdictValueSchema,
  wallhack: VerdictValueSchema,
  autobhop: VerdictValueSchema,
  bot: VerdictValueSchema,
});

export const CustomPresetSchema = z.strictObject({
  label: z.string().max(PRESET_LABEL_MAX_LENGTH),
  verdicts: VerdictSelectionSchema,
});
