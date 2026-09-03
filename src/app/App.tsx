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
}

const DashboardLinks = ({ metricsLabel, historyLabel, onSelect }: DashboardLinksProps) => (
  <>
    <a href="#" onClick={(event) => { event.preventDefault(); onSelect('metrics'); }}>{metricsLabel}</a>
    <a href="#" onClick={(event) => { event.preventDefault(); onSelect('history'); }}>{historyLabel}</a>
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
        class={preferences.value.hideNickname ? styles.active : undefined}
        aria-label={t('hideNickname')}
        title={t('hideNicknameHint')}
        aria-pressed={preferences.value.hideNickname}
        onClick={() => persistPreferences({ hideNickname: !preferences.value.hideNickname }, reportErrorGlobal)}
      >{"\u{1F464}\u{FE0E}"}</button>
      <button
        type="button"
        class={preferences.value.autoApplyRepeatVerdicts ? styles.active : undefined}
        aria-label={t('autoApplyRepeatVerdicts')}
        title={t('autoApplyRepeatVerdictsHint')}
        aria-pressed={preferences.value.autoApplyRepeatVerdicts}
        onClick={() => persistPreferences({ autoApplyRepeatVerdicts: !preferences.value.autoApplyRepeatVerdicts }, reportErrorGlobal)}
      >↻</button>
      <button
        type="button"
        class={preferences.value.keepControlsVisible ? styles.active : undefined}
        aria-label={t('keepControlsVisible')}
        title={t('keepControlsVisibleHint')}
        aria-pressed={preferences.value.keepControlsVisible}
        onClick={() => persistPreferences({ keepControlsVisible: !preferences.value.keepControlsVisible }, reportErrorGlobal)}
      >{"\u{1F4CC}\u{FE0E}"}</button>
      <button
        type="button"
        class={preferences.value.stretchVideo ? styles.active : undefined}
        aria-label={t('stretchVideo')}
        title={t('stretchVideo')}
        aria-pressed={preferences.value.stretchVideo}
        onClick={() => persistPreferences({ stretchVideo: !preferences.value.stretchVideo }, reportErrorGlobal)}
      >⛶</button>
    </>
  );
};

const VerdictPanelContainer = ({ onReviewCommand }: { onReviewCommand: (command: ReviewCommand) => void }) => {
  const snapshot = snapshotSignal;
  return (
    <VerdictPanel
      clip={snapshot.value.clip}
      deduplication={snapshot.value.deduplication}
      clipCount={snapshot.value.clip?.clipCount ?? null}
      error={snapshot.value.error}
      previousVerdicts={snapshot.value.previousVerdicts}
      submitting={snapshot.value.submitting}
      verdicts={snapshot.value.verdicts}
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
          <button type="button" aria-label={t('reviewInstructions')}>i</button>
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
          <button type="button" aria-label={t('hotkeyTitle')}>⌨</button>
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
        />,
        footerTarget
      ) : (
        <nav class={styles.footerTools} aria-label={t('devMetricsTitle')}>
          <DashboardLinks
            metricsLabel={t('devMetricsTitle')}
            historyLabel={t('historyLogTitle')}
            onSelect={toggleDashboard}
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
