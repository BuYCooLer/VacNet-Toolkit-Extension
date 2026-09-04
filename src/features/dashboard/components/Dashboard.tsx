import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../../../shared/use-translation';
import styles from './Dashboard.module.css';

const MAX_HISTORY_FILE_BYTES = 10 * 1024 * 1024;

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const readFileText = (result: string | ArrayBuffer | null): string => {
  if (typeof result !== 'string') throw new TypeError('History file must contain UTF-8 text.');
  return result;
};

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

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
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const isOpen = mode !== null;
  const isHistory = mode === 'history';

  /*
   * Move focus into the dialog when it opens and hand it back to whatever was
   * focused before when it closes. Focus lives in the shadow root, so the
   * element to restore has to be read from there rather than from document.
   */
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const root = dialog.getRootNode();
    const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    restoreFocusRef.current = active instanceof HTMLElement ? active : null;
    dialog.focus();
    return () => {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [isOpen]);

  // A dialog that has been dismissed must not reopen mid-confirmation.
  useEffect(() => {
    if (!isOpen) setConfirmingClear(false);
  }, [isOpen]);

  if (!mode) return null;

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

  /* Keep Tab cycling inside the dialog, as aria-modal promises. */
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => element.offsetParent !== null || element === dialog);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const root = dialog.getRootNode();
    const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <aside
      ref={dialogRef}
      class={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vacnet-dashboard-title"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
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
                <UploadIcon />
              </button>
              <button
                type="button"
                class={styles.action}
                aria-label={t('downloadVideoHistory')}
                title={t('downloadVideoHistoryHint')}
                onClick={onExportHistory}
              >
                <DownloadIcon />
              </button>
            </>
          )}
          <button
            type="button"
            class={styles.action}
            aria-label={isHistory ? t('clearVideoHistory') : t('copyMetrics')}
            title={isHistory ? t('clearVideoHistoryHint') : t('copyMetricsHint')}
            onClick={isHistory ? () => setConfirmingClear(true) : onCopyMetrics}
          >
            {isHistory ? <TrashIcon /> : <CopyIcon />}
          </button>
          <button type="button" class={styles.close} aria-label={t('closeDashboard')} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>
      <div class={styles.content}>
        {confirmingClear && (
          <div class={styles.confirm} role="alertdialog" aria-label={t('clearVideoHistory')}>
            <span>{t('confirmClearHistory')}</span>
            <div class={styles.confirmActions}>
              <button
                type="button"
                class={styles.confirmButton}
                onClick={() => setConfirmingClear(false)}
              >
                {t('confirmCancel')}
              </button>
              <button
                type="button"
                class={`${styles.confirmButton} ${styles.confirmDanger}`}
                onClick={() => { setConfirmingClear(false); onClearHistory(); }}
              >
                {t('confirmClear')}
              </button>
            </div>
          </div>
        )}
        {isHistory ? history : metrics}
      </div>
    </aside>
  );
};
