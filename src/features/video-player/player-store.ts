import { signal } from '@preact/signals';
import type { PageSnapshot } from '../../entities/clip';
import { emptyVerdicts } from '../../entities/verdict';
import { initialPageSnapshot, normalizePageSnapshot } from './snapshot-state';

export const snapshotSignal = signal<PageSnapshot>(initialPageSnapshot());

export const updateSnapshot = (snapshot: PageSnapshot): void => {
  snapshotSignal.value = normalizePageSnapshot(snapshot);
};

export const updateVerdicts = (transform: (verdicts: PageSnapshot['verdicts']) => PageSnapshot['verdicts']): void => {
  const currentVerdicts = { ...snapshotSignal.value.verdicts };
  snapshotSignal.value = {
    ...snapshotSignal.value,
    verdicts: { ...transform(currentVerdicts) },
  };
};

export const updateError = (error: string | null): void => {
  snapshotSignal.value = { ...snapshotSignal.value, error };
};

export const updateSubmitting = (submitting: boolean): void => {
  snapshotSignal.value = { ...snapshotSignal.value, submitting };
};

export const updatePlayer = (player: PageSnapshot['player']): void => {
  snapshotSignal.value = { ...snapshotSignal.value, player };
};

export const resetSnapshot = (): void => {
  snapshotSignal.value = { ...initialPageSnapshot(), verdicts: emptyVerdicts() };
};
