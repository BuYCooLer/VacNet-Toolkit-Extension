export const verdictNames = ['aimassist', 'wallhack', 'autobhop', 'bot'] as const;

export const verdictValues = ['positive', 'skip', 'negative'] as const;

export type VerdictName = (typeof verdictNames)[number];

export type VerdictValue = (typeof verdictValues)[number];

export type VerdictSelection = Record<VerdictName, VerdictValue>;

export const emptyVerdicts = (): VerdictSelection => ({
  aimassist: 'skip',
  wallhack: 'skip',
  autobhop: 'skip',
  bot: 'skip',
});

export const isVerdictValue = (value: unknown): value is VerdictValue =>
  typeof value === 'string' && verdictValues.some((item) => item === value);

export const isVerdictSelection = (value: unknown): value is VerdictSelection => {
  if (!isRecord(value)) return false;
  return verdictNames.every((name) => isVerdictValue(value[name]));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
