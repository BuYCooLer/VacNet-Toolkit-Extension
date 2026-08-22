import { z } from 'zod';
import { storage } from 'wxt/utils/storage';
import {
  defaultPreferences,
  createDefaultPreferences,
  PREFERENCES_STATE_VERSION,
  PreferencesSchema,
  type Preferences,
  type PreferencesPatch,
} from '../../entities/preferences';

const PREFERENCES_STORAGE_VERSION = PREFERENCES_STATE_VERSION;

const legacyDashboardOpen = storage.defineItem<unknown>('local:dashboardOpen', { fallback: null });
const legacyStretchVideo = storage.defineItem<unknown>('local:stretchVideo', { fallback: null });

const LegacyPreferencesSchema = z.object({
  dashboardOpen: z.boolean().optional(),
  stretchVideo: z.boolean().optional(),
  autoApplyRepeatVerdicts: z.boolean().optional(),
  volume: z.number().finite().min(0).max(1).optional(),
  muted: z.boolean().optional(),
});

const migratePreferences = async (value: unknown): Promise<Preferences> => {
  const current = PreferencesSchema.safeParse(value);
  if (current.success) return current.data;

  const [legacyValue, dashboardOpen, stretchVideo] = await Promise.all([
    Promise.resolve(LegacyPreferencesSchema.safeParse(value)),
    legacyDashboardOpen.getValue(),
    legacyStretchVideo.getValue(),
  ]);
  const legacy = legacyValue.success ? legacyValue.data : {};
  return PreferencesSchema.parse({
    ...defaultPreferences,
    ...legacy,
    dashboardOpen: legacy.dashboardOpen ?? z.boolean().catch(defaultPreferences.dashboardOpen).parse(dashboardOpen),
    stretchVideo: legacy.stretchVideo ?? z.boolean().catch(defaultPreferences.stretchVideo).parse(stretchVideo),
  });
};

const migrateV3 = (value: unknown): unknown => {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  if (parsed.success) {
    const source = parsed.data;
    return {
      ...source,
      hideNickname: typeof source.hideNickname === 'boolean' ? source.hideNickname : defaultPreferences.hideNickname,
    };
  }
  return value;
};

const migrateV5 = (value: unknown): unknown => {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  if (parsed.success) {
    const source = parsed.data;
    return {
      ...source,
      keepControlsVisible: typeof source.keepControlsVisible === 'boolean' ? source.keepControlsVisible : defaultPreferences.keepControlsVisible,
    };
  }
  return value;
};

const storedPreferences = storage.defineItem<Preferences>('local:preferences', {
  fallback: createDefaultPreferences(),
  version: PREFERENCES_STORAGE_VERSION,
  migrations: {
    2: migratePreferences,
    3: migrateV3,
    4: async (value: unknown) => migrateV3(await migratePreferences(value)),
    5: async (value: unknown) => PreferencesSchema.parse(migrateV5(migrateV3(await migratePreferences(value)))),
  },
});

const getValue = async (): Promise<Preferences> => {
  return PreferencesSchema.parse(await storedPreferences.getValue());
};

const cleanupLegacy = async (): Promise<void> => {
  await Promise.all([
    legacyDashboardOpen.removeValue(),
    legacyStretchVideo.removeValue(),
  ]);
};

const filterPatch = (current: Preferences, patch: unknown): Preferences => {
  if (typeof patch !== 'object' || patch === null) {
    throw new TypeError('VACNET preferences patch must be an object.');
  }
  const partial = patch as Partial<Preferences>;
  return PreferencesSchema.parse({ ...current, ...partial });
};

export const mergePreferencesPatch = (current: Preferences, patch: unknown): Preferences =>
  filterPatch(current, patch);

const setValue = async (preferences: Preferences): Promise<void> => {
  await storedPreferences.setValue(PreferencesSchema.parse(preferences));
};

const watch = (
  listener: (preferences: Preferences) => void,
  onError: (error: TypeError) => void,
): (() => void) =>
  storedPreferences.watch((value) => {
    const result = PreferencesSchema.safeParse(value);
    if (!result.success) {
      onError(new TypeError('VACNET preferences changed to an invalid value.', { cause: result.error }));
      return;
    }
    listener(result.data);
  });

const hydrateAndWatch = async (
  listener: (preferences: Preferences) => void,
  onError: (error: TypeError) => void,
): Promise<() => void> => {
  let revision = 0;
  const unwatch = watch((preferences) => {
    revision += 1;
    listener(preferences);
  }, onError);
  try {
    const preferences = await getValue();
    if (revision === 0) listener(preferences);
    return unwatch;
  } catch (error) {
    unwatch();
    throw error;
  }
};

const mutate = async (patch: PreferencesPatch): Promise<Preferences> => {
  const next = filterPatch(await getValue(), patch);
  await setValue(next);
  return next;
};

export const preferencesStorage = { getValue, setValue, watch, hydrateAndWatch, mutate, cleanupLegacy };
