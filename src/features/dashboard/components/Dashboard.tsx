import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { useTranslation } from '../../../shared/use-translation';
import styles from './Dashboard.module.css';

const MAX_HISTORY_FILE_BYTES = 10 * 1024 * 1024;

const readFileText = (result: string | ArrayBuffer | null): string => {
  if (typeof result !== 'string') throw new TypeError('History file must contain UTF-8 text.');
  return result;
};

interface DashboardProps {
  onClearHistory: () => void;
  onClose: () => void;
  onCopyMetrics: () => void;
  history: ComponentChildren;
  metrics: ComponentChildren;
  mode: 'metrics' | 'history' | null;
  onImportHistory: (data: unknown) => void;
  onExportHistory: () => void;
  onImportError: (error: unknown) => void;
}

export const Dashboard = ({ history, metrics, mode, onClearHistory, onClose, onCopyMetrics, onImportHistory, onExportHistory, onImportError }: DashboardProps) => {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!mode) return null;

  const isHistory = mode === 'history';
  const className = isHistory ? `${styles.dashboard} ${styles.history}` : styles.dashboard;
  const handleUpload = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;
    target.value = '';
    if (file.size > MAX_HISTORY_FILE_BYTES) {
      onImportError(new RangeError('History file exceeds the 10 MiB limit.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent): void => {
      try {
        const data: unknown = JSON.parse(readFileText(loadEvent.target?.result ?? null));
        onImportHistory(data);
      } catch (error) {
        onImportError(error);
      }
    };
    reader.onerror = (): void => {
      onImportError(reader.error ?? new Error('History file could not be read.'));
    };
    reader.onabort = (): void => {
      onImportError(new DOMException('History file reading was aborted.', 'AbortError'));
    };
    reader.readAsText(file);
  };

  return (
    <aside
      class={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacnet-dashboard-title"
    >
      <header>
        <h2 id="vacnet-dashboard-title">{isHistory ? t('historyLogTitle') : t('devMetricsTitle')}<small>{t('byAuthor')}</small></h2>
        <div class={styles.actions}>
          {isHistory && (
            <>
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleUpload}
              />
              <button
                type="button"
                class={styles.action}
                aria-label={t('uploadVideoHistory')}
                title={t('uploadVideoHistoryHint')}
                onClick={() => fileInputRef.current?.click()}
              >
                ⬆
              </button>
              <button
                type="button"
                class={styles.action}
              aria-label={t('downloadVideoHistory')}
              title={t('downloadVideoHistoryHint')}
              onClick={onExportHistory}
            >
              ⬇
            </button>
            </>
          )}
          <button
            type="button"
            class={styles.action}
            aria-label={isHistory ? t('clearVideoHistory') : t('copyMetrics')}
            title={isHistory ? t('clearVideoHistoryHint') : t('copyMetricsHint')}
            onClick={isHistory ? () => { if (window.confirm(t('confirmClearHistory'))) onClearHistory(); } : onCopyMetrics}
          >
            {isHistory ? '🗑' : '⧉'}
          </button>
          <button type="button" class={styles.close} aria-label={t('closeDashboard')} onClick={onClose}>×</button>
        </div>
      </header>
      <div class={styles.content}>
        {isHistory ? history : metrics}
      </div>
    </aside>
  );
};
