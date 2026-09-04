import { createPortal } from 'preact/compat';
import type { Preferences } from '../entities/preferences';
import { Dashboard } from '../features/dashboard/components/Dashboard';
import { DashboardMetrics } from '../features/dashboard/components/DashboardMetrics';
import { dashboardStore } from '../features/dashboard/dashboard-store';
import { DashboardHistory } from '../features/history/components/DashboardHistory';
import { updatePreferences, preferencesSignal } from '../features/preferences/preferences-store';
import { snapshotSignal } from '../features/video-player/player-store';
import { historySignal } from '../features/history/history-store';
import { VerdictPanel } from '../features/verdicts/VerdictPanel';
import type { ReviewCommand } from '../shared/protocol';
import { useTranslation } from '../shared/use-translation';
import styles from './App.module.css';

let reportErrorGlobal: (error: unknown) => void = () => {};

interface AppProps {
  footerTarget: HTMLElement | null;
  onReviewCommand: (command: ReviewCommand) => void;
  onClearHistory: () => void;
  onCopyMetrics: () => void;
  onError: (error: unknown) => void;
  onImportHistory: (data: unknown) => void;
  onExportHistory: () => void;
}

interface DashboardLinksProps {
  metricsLabel: string;
  historyLabel: string;
  onSelect: (mode: 'metrics' | 'history') => void;
  activeMode?: 'metrics' | 'history' | null;
}

const DashboardLinks = ({ metricsLabel, historyLabel, onSelect, activeMode }: DashboardLinksProps) => (
  <>
    <a
      href="#"
      class={activeMode === 'metrics' ? 'vacnet-footer-link-active' : undefined}
      onClick={(event) => { event.preventDefault(); onSelect('metrics'); }}
    >
      {metricsLabel}
    </a>
    <a
      href="#"
      class={activeMode === 'history' ? 'vacnet-footer-link-active' : undefined}
      onClick={(event) => { event.preventDefault(); onSelect('history'); }}
    >
      {historyLabel}
    </a>
  </>
);

const persistPreferences = (
  patch: Partial<Preferences>,
  onError: (error: unknown) => void,
): void => {
  void updatePreferences(patch).catch(onError);
};

const ToolbarButtons = () => {
  const t = useTranslation();
  const preferences = preferencesSignal;
  return (
    <>
      <button
        type="button"
        class={preferences.value.autoSubmitPreset ? styles.active : undefined}
        aria-label={t('autoSubmitPreset')}
        title={t('autoSubmitPresetHint')}
        aria-pressed={preferences.value.autoSubmitPreset}
        onClick={() => persistPreferences({ autoSubmitPreset: !preferences.value.autoSubmitPreset }, reportErrorGlobal)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </button>
      <button
        type="button"
        class={preferences.value.hideNickname ? styles.active : undefined}
        aria-label={t('hideNickname')}
        title={t('hideNicknameHint')}
        aria-pressed={preferences.value.hideNickname}
        onClick={() => persistPreferences({ hideNickname: !preferences.value.hideNickname }, reportErrorGlobal)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </button>
      <button
        type="button"
        class={preferences.value.autoApplyRepeatVerdicts ? styles.active : undefined}
        aria-label={t('autoApplyRepeatVerdicts')}
        title={t('autoApplyRepeatVerdictsHint')}
        aria-pressed={preferences.value.autoApplyRepeatVerdicts}
        onClick={() => persistPreferences({ autoApplyRepeatVerdicts: !preferences.value.autoApplyRepeatVerdicts }, reportErrorGlobal)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
      <button
        type="button"
        class={preferences.value.keepControlsVisible ? styles.active : undefined}
        aria-label={t('keepControlsVisible')}
        title={t('keepControlsVisibleHint')}
        aria-pressed={preferences.value.keepControlsVisible}
        onClick={() => persistPreferences({ keepControlsVisible: !preferences.value.keepControlsVisible }, reportErrorGlobal)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="17" x2="12" y2="22" />
          <path d="M5 17h14v-2l-2-2V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v8l-2 2v2z" />
        </svg>
      </button>
      <button
        type="button"
        class={preferences.value.stretchVideo ? styles.active : undefined}
        aria-label={t('stretchVideo')}
        title={t('stretchVideo')}
        aria-pressed={preferences.value.stretchVideo}
        onClick={() => persistPreferences({ stretchVideo: !preferences.value.stretchVideo }, reportErrorGlobal)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
    </>
  );
};

const VerdictPanelContainer = ({ onReviewCommand }: { onReviewCommand: (command: ReviewCommand) => void }) => {
  const snapshot = snapshotSignal;
  const preferences = preferencesSignal;
  return (
    <VerdictPanel
      clip={snapshot.value.clip}
      deduplication={snapshot.value.deduplication}
      clipCount={snapshot.value.clip?.clipCount ?? null}
      error={snapshot.value.error}
      previousVerdicts={snapshot.value.previousVerdicts}
      submitting={snapshot.value.submitting}
      verdicts={snapshot.value.verdicts}
      presets={preferences.value.customPresets}
      autoSubmitPreset={preferences.value.autoSubmitPreset}
      onUpdatePresets={(customPresets) => {
        persistPreferences({ customPresets }, reportErrorGlobal);
      }}
      onChange={(name, value) => {
        onReviewCommand({ type: 'set-verdict', name, value });
      }}
      onApplyPreset={(verdicts) => {
        onReviewCommand({ type: 'set-verdicts', verdicts });
      }}
      onSubmit={(verdicts, badClip) => {
        onReviewCommand({ type: 'submit', verdicts, badClip });
      }}
    />
  );
};

const DashboardContainer = ({
  onImportHistory,
  onExportHistory,
  onError,
  onClearHistory,
  onCopyMetrics,
}: {
  onImportHistory: (data: unknown) => void;
  onExportHistory: () => void;
  onError: (error: unknown) => void;
  onClearHistory: () => void;
  onCopyMetrics: () => void;
}) => {
  const snapshot = snapshotSignal;
  const closeDashboard = (): void => {
    dashboardStore.close();
    persistPreferences({ dashboardOpen: false }, onError);
  };
  return (
    <Dashboard
      history={<DashboardHistory history={historySignal.value} totalClipsViewed={snapshot.value.clip?.clipCount ?? 0} />}
      metrics={<DashboardMetrics snapshot={snapshot.value} />}
      mode={dashboardStore.value}
      onImportHistory={onImportHistory}
      onExportHistory={onExportHistory}
      onImportError={onError}
      onClose={closeDashboard}
      onClearHistory={onClearHistory}
      onCopyMetrics={onCopyMetrics}
    />
  );
};

export const App = ({
  footerTarget,
  onClearHistory,
  onCopyMetrics,
  onError,
  onReviewCommand,
  onImportHistory,
  onExportHistory,
}: AppProps) => {
  const t = useTranslation();
  reportErrorGlobal = onError;

  const toggleDashboard = (mode: 'metrics' | 'history'): void => {
    const nextMode = dashboardStore.value === mode ? null : mode;
    if (nextMode === null) dashboardStore.close();
    else dashboardStore.open(nextMode);
    persistPreferences({ dashboardOpen: nextMode !== null }, onError);
  };

  return (
    <div class={styles.appShell}>
      <nav class={styles.videoToolbar} aria-label={t('reviewInstructions')}>
        <div class={styles.hoverDropdown}>
          <button type="button" aria-label={t('reviewInstructions')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <div class={styles.dropdownContent}>
            <strong>{t('watchClipInstructions')}</strong>
            <hr />
            <ul class={styles.dropdownList}>
              <li>{t('xrayActive')}</li>
              <li>{t('verdictTrainingNotice')}</li>
              <li>{t('uncertainNotice')}</li>
              <li>{t('clipSelectionNotice')}</li>
            </ul>
          </div>
        </div>
        <div class={styles.hoverDropdown}>
          <button type="button" aria-label={t('hotkeyTitle')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
            </svg>
          </button>
          <div class={styles.dropdownContent}>
            <strong>{t('hotkeyTitle')}</strong>
            <hr />
            <ul class={styles.dropdownList}>
              {t('hotkeyHelp').split('·').map((hotkey) => <li key={hotkey}>{hotkey.trim()}</li>)}
            </ul>
          </div>
        </div>
        <ToolbarButtons />
      </nav>
      {footerTarget ? createPortal(
        <DashboardLinks
          metricsLabel={t('devMetricsTitle')}
          historyLabel={t('historyLogTitle')}
          onSelect={toggleDashboard}
          activeMode={dashboardStore.value}
        />,
        footerTarget
      ) : (
        <nav class={styles.footerTools} aria-label={t('devMetricsTitle')}>
          <DashboardLinks
            metricsLabel={t('devMetricsTitle')}
            historyLabel={t('historyLogTitle')}
            onSelect={toggleDashboard}
            activeMode={dashboardStore.value}
          />
        </nav>
      )}
      <VerdictPanelContainer onReviewCommand={onReviewCommand} />
      <DashboardContainer
        onImportHistory={onImportHistory}
        onExportHistory={onExportHistory}
        onError={onError}
        onClearHistory={onClearHistory}
        onCopyMetrics={onCopyMetrics}
      />
    </div>
  );
};
