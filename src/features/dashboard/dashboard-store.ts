import { signal } from '@preact/signals';

export type DashboardMode = 'metrics' | 'history';

interface DashboardStore {
  readonly value: DashboardMode | null;
  open: (mode: DashboardMode) => void;
  close: () => void;
  toggle: (mode: DashboardMode) => void;
}

const modeSignal = signal<DashboardMode | null>(null);

export const dashboardStore: DashboardStore = {
  get value(): DashboardMode | null { return modeSignal.value; },
  open: (mode) => { modeSignal.value = mode; },
  close: () => { modeSignal.value = null; },
  toggle: (mode) => { modeSignal.value = modeSignal.value === mode ? null : mode; },
};
