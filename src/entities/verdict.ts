/**
 * Verdict vocabulary and defaults.
 *
 * Deliberately free of any dependency on the validation library: the popup and
 * other light entry points need the constants and the types, and pulling zod in
 * for them costs roughly 50 kB of bundle for no benefit. The matching runtime
 * schemas live in ./verdict.schema.ts and are imported only where untrusted
 * input is actually parsed.
 */

export const verdictNames = ['aimassist', 'wallhack', 'autobhop', 'bot'] as const;

export const verdictValues = ['positive', 'skip', 'negative'] as const;

export type VerdictName = (typeof verdictNames)[number];

export type VerdictValue = (typeof verdictValues)[number];

export type VerdictSelection = { [Name in VerdictName]: VerdictValue };

export const emptyVerdicts = (): VerdictSelection => ({
  aimassist: 'skip',
  wallhack: 'skip',
  autobhop: 'skip',
  bot: 'skip',
});

export const PRESET_LABEL_MAX_LENGTH = 16;

export interface CustomPreset {
  label: string;
  verdicts: VerdictSelection;
}

export const DEFAULT_PRESETS: CustomPreset[] = [
  { label: 'LEGIT', verdicts: { aimassist: 'negative', wallhack: 'negative', autobhop: 'negative', bot: 'negative' } },
  { label: 'AIM', verdicts: { aimassist: 'positive', wallhack: 'negative', autobhop: 'negative', bot: 'negative' } },
  { label: 'WH', verdicts: { aimassist: 'negative', wallhack: 'positive', autobhop: 'negative', bot: 'negative' } },
  { label: 'RAGE', verdicts: { aimassist: 'positive', wallhack: 'positive', autobhop: 'positive', bot: 'negative' } },
];
