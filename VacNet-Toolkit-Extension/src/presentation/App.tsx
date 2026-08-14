import type { MessageCatalog } from '../shared/i18n';
import type { Preferences } from '../domain/preferences';
import { Dashboard } from './components/Dashboard';
import { dashboardModeSignal, preferencesSignal } from './state';
import { createPortal } from 'preact/compat';
import { useEffect } from 'preact/hooks';
import { effect } from '@preact/signals';

interface Props {
  catalog: MessageCatalog;
  onPreferences: (preferences: Partial<Preferences>) => void;
  onClearHistory: () => void;
  onCopyMetrics: () => void;
}

export const App = ({ catalog, onPreferences, onClearHistory, onCopyMetrics }: Props) => {
  const preferences = preferencesSignal.value;
  const toggleDashboard = (mode: 'metrics' | 'history'): void => {
    const next = dashboardModeSignal.value === mode ? null : mode;
    dashboardModeSignal.value = next;
    onPreferences({ dashboardOpen: next !== null });
  };
  const close = (): void => {
    dashboardModeSignal.value = null;
    onPreferences({ dashboardOpen: false });
  };
  const toggleStretch = (): void => {
    onPreferences({ stretchVideo: !preferences.stretchVideo });
  };
  const toggleAutoApplyRepeatVerdicts = (): void => {
    onPreferences({ autoApplyRepeatVerdicts: !preferences.autoApplyRepeatVerdicts });
  };

  useEffect(() => {
    const dispose = effect(() => {
      document.body.classList.toggle('dashboard-open', dashboardModeSignal.value !== null);
    });
    return dispose;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dashboardModeSignal.value !== null) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div class="app-shell">
      <nav class="video-toolbar" aria-label={catalog.reviewInstructions}>
        <div class="hover-dropdown">
          <button type="button" aria-label={catalog.reviewInstructions}>i</button>
          <div class="dropdown-content">
            <strong>{catalog.watchClipInstructions}</strong>
            <hr />
            <ul class="dropdown-list">
              <li>{catalog.xrayActive}</li>
              <li>{catalog.verdictTrainingNotice}</li>
              <li>{catalog.uncertainNotice}</li>
              <li>{catalog.clipSelectionNotice}</li>
            </ul>
          </div>
        </div>
        <div class="hover-dropdown">
          <button type="button" aria-label="Hotkeys">⌨</button>
          <div class="dropdown-content">
            <strong>{catalog.videoJsLocale === 'ru' ? 'Горячие клавиши' : 'Key Bindings'}</strong>
            <hr />
            <ul class="dropdown-list">
              {catalog.hotkeyHelp.split('·').map(hotkey => (
                <li>{hotkey.trim()}</li>
              ))}
            </ul>
          </div>
        </div>
        <button type="button" class={preferences.autoApplyRepeatVerdicts ? 'active' : ''} aria-label={catalog.autoApplyRepeatVerdicts} title={catalog.autoApplyRepeatVerdictsHint} aria-pressed={preferences.autoApplyRepeatVerdicts} onClick={toggleAutoApplyRepeatVerdicts}>↻</button>
        <button type="button" class={preferences.stretchVideo ? 'active' : ''} aria-label={catalog.stretchVideo} title={catalog.stretchVideo} aria-pressed={preferences.stretchVideo} onClick={toggleStretch}>⛶</button>
      </nav>
      {createPortal(
        <>
          <a style={{ color: '#6ea31d', cursor: 'pointer', textDecoration: 'none' }} onClick={() => toggleDashboard('metrics')}>{catalog.devMetricsTitle}</a>
          <a style={{ color: '#6ea31d', cursor: 'pointer', textDecoration: 'none' }} onClick={() => toggleDashboard('history')}>{catalog.clipLogTitle}</a>
        </>,
        document.querySelector('.footer-buttons') || document.body
      )}
      <Dashboard catalog={catalog} onClose={close} onClearHistory={onClearHistory} onCopyMetrics={onCopyMetrics} />
    </div>
  );
};
