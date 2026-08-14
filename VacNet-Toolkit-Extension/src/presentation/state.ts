import { signal } from '@preact/signals';
import type { PageSnapshot } from '../domain/clip';
import { emptyHistory, type HistoryState } from '../domain/history';
import { defaultPreferences, type Preferences } from '../domain/preferences';
import type { DashboardMode } from '../shared/protocol';

export const preferencesSignal = signal<Preferences>(defaultPreferences);
export const historySignal = signal<HistoryState>(emptyHistory());
export const snapshotSignal = signal<PageSnapshot>({ clip: null, deduplication: null, player: null, hasVideo: false, submitting: false, error: null });
export const dashboardModeSignal = signal<DashboardMode | null>(null);
export const readySignal = signal(false);
