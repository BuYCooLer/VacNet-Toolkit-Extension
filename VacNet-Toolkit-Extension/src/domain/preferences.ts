export interface Preferences {
  dashboardOpen: boolean;
  stretchVideo: boolean;
  autoApplyRepeatVerdicts: boolean;
  volume: number;
  muted: boolean;
}

export const defaultPreferences: Preferences = {
  dashboardOpen: false,
  stretchVideo: false,
  autoApplyRepeatVerdicts: false,
  volume: 0.1,
  muted: false,
};

export const isPreferences = (value: unknown): value is Preferences => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.dashboardOpen === 'boolean'
    && typeof candidate.stretchVideo === 'boolean'
    && typeof candidate.autoApplyRepeatVerdicts === 'boolean'
    && typeof candidate.volume === 'number'
    && Number.isFinite(candidate.volume)
    && candidate.volume >= 0
    && candidate.volume <= 1
    && typeof candidate.muted === 'boolean';
};
