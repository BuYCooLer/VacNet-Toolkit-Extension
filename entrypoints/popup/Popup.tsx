import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  defaultPreferences,
  type Preferences,
  type ThemeColor,
  type ThemeMode,
} from '../../src/entities/preferences';
import { sendMessage } from '../../src/shared/extension-messaging';
import { STORAGE_COORDINATION_VERSION } from '../../src/shared/storage-contract';
import { createTranslate, isRussian, type MessageKey } from '../../src/shared/messages';
import styles from './Popup.module.css';

const VACNET_CLIPS_URL = 'https://www.counter-strike.net/vacnet/clips';

/*
 * WXT stores `local:preferences` under the plain chrome.storage.local key
 * "preferences" (the area is the part before the colon). Writes go through the
 * background worker instead of touching storage here: it owns the migration
 * chain and serialises concurrent mutations, so two quick toggles cannot read
 * the same snapshot and clobber one another.
 */
const PREFS_STORAGE_KEY = 'preferences';

/* Read from the manifest so the badge cannot drift from the shipped version. */
const VERSION = (() => {
  try {
    return chrome.runtime?.getManifest?.().version ?? '';
  } catch {
    return '';
  }
})();

interface ThemeOption {
  id: ThemeColor;
  color: string;
  labelKey: MessageKey;
}

const THEMES: ThemeOption[] = [
  { id: 'green', color: '#a7d46f', labelKey: 'themeGreen' },
  { id: 'gold', color: '#e5a93c', labelKey: 'themeGold' },
  { id: 'blue', color: '#38bdf8', labelKey: 'themeBlue' },
  { id: 'red', color: '#f87171', labelKey: 'themeRed' },
  { id: 'purple', color: '#c084fc', labelKey: 'themePurple' },
];

interface ToggleKeyed {
  key: 'hideNickname' | 'autoSubmitPreset' | 'stretchVideo' | 'keepControlsVisible';
  titleKey: MessageKey;
  descKey: MessageKey;
  icon: preact.JSX.Element;
}

const ShieldIcon = (
  <svg class={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const BoltIcon = (
  <svg class={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ExpandIcon = (
  <svg class={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const SlidersIcon = (
  <svg class={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const TOGGLES: ToggleKeyed[] = [
  { key: 'hideNickname', titleKey: 'hideNickname', descKey: 'popupHideNicknameDesc', icon: ShieldIcon },
  { key: 'autoSubmitPreset', titleKey: 'autoSubmitPreset', descKey: 'popupAutoSubmitDesc', icon: BoltIcon },
  { key: 'stretchVideo', titleKey: 'stretchVideo', descKey: 'popupStretchDesc', icon: ExpandIcon },
  { key: 'keepControlsVisible', titleKey: 'keepControlsVisible', descKey: 'popupControlsDesc', icon: SlidersIcon },
];

export const Popup = () => {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [activeTab, setActiveTab] = useState<'settings' | 'hotkeys'>('settings');
  const [isVacNetTab, setIsVacNetTab] = useState<boolean>(false);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    try {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        const currentUrl = tabs[0]?.url || '';
        setIsVacNetTab(currentUrl.includes('counter-strike.net/vacnet/'));
      });
    } catch {
      setIsVacNetTab(false);
    }

    let cancelled = false;
    sendMessage('getPreferences', undefined)
      .then((stored) => {
        if (!cancelled && stored) setPreferences({ ...defaultPreferences, ...stored });
      })
      .catch((error: unknown) => {
        console.error('[VACNET Popup] Could not read preferences:', error);
      });

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local') return;
      const change = changes[PREFS_STORAGE_KEY];
      if (!change?.newValue || typeof change.newValue !== 'object') return;
      setPreferences((prev) => ({ ...prev, ...(change.newValue as Partial<Preferences>) }));
    };

    chrome.storage?.onChanged?.addListener(handleStorageChange);
    return () => {
      cancelled = true;
      chrome.storage?.onChanged?.removeListener(handleStorageChange);
    };
  }, []);

  /*
   * Optimistic local update plus a serialised write. The queue keeps rapid
   * toggling in order; the authoritative object that comes back from the
   * background replaces the optimistic one.
   */
  const updatePref = (patch: Partial<Preferences>): void => {
    setPreferences((prev) => ({ ...prev, ...patch }));
    const operation = queueRef.current
      .then(() => sendMessage('mutatePreferences', { version: STORAGE_COORDINATION_VERSION, patch }))
      .then((next) => {
        if (next) setPreferences({ ...defaultPreferences, ...next });
      });
    queueRef.current = operation.catch((error: unknown) => {
      console.error('[VACNET Popup] Could not save preferences:', error);
    });
  };

  const handleOpenVacNet = (): void => {
    /*
     * window.close() has to happen inside the callback. Calling it straight
     * after query() tears down the popup's context before the callback runs,
     * so the tab is never focused or opened.
     */
    try {
      chrome.tabs.query({ url: 'https://www.counter-strike.net/vacnet/*' }, (tabs) => {
        const existing = tabs?.[0];
        if (existing?.id !== undefined) {
          chrome.tabs.update(existing.id, { active: true });
          if (existing.windowId !== undefined) {
            chrome.windows.update(existing.windowId, { focused: true });
          }
        } else {
          chrome.tabs.create({ url: VACNET_CLIPS_URL });
        }
        window.close();
      });
    } catch {
      window.open(VACNET_CLIPS_URL, '_blank');
      window.close();
    }
  };

  const language = preferences.language ?? 'auto';
  const t = useMemo(() => createTranslate(language), [language]);
  const ru = isRussian(language);
  const currentTheme: ThemeColor = preferences.theme || 'green';
  const currentMode: ThemeMode = preferences.themeMode || 'dark';

  const hotkeyRow = (labelKey: MessageKey, keys: string) => (
    <div class={styles.hotkeyRow} key={labelKey}>
      <span class={styles.hotkeyLabel}>{t(labelKey)}</span>
      <span class={styles.kbd}>{keys}</span>
    </div>
  );

  return (
    <div class={styles.container} data-theme={currentTheme} data-mode={currentMode}>
      <header class={styles.header}>
        <div class={styles.headerLeft}>
          <div class={styles.logoWrapper}>
            <img src="/icon.png" alt="" class={styles.logo} />
          </div>
          <div class={styles.brandInfo}>
            <div class={styles.brandRow}>
              <span class={styles.brandName}>VACNET TOOLKIT</span>
              {VERSION && <span class={styles.versionBadge}>v{VERSION}</span>}
            </div>
            <div class={styles.statusIndicator}>
              <span class={isVacNetTab ? styles.pulseDot : styles.pulseDotInactive} />
              <span>{isVacNetTab ? t('popupStatusActive') : t('popupStatusWaiting')}</span>
            </div>
          </div>
        </div>

        <div class={styles.langPill} role="group" aria-label={t('popupLanguageSelector')}>
          <button
            type="button"
            class={`${styles.langPillBtn} ${ru ? styles.langPillActive : ''}`}
            aria-pressed={ru}
            onClick={() => updatePref({ language: 'ru' })}
            title="Русский"
          >
            RU
          </button>
          <button
            type="button"
            class={`${styles.langPillBtn} ${!ru ? styles.langPillActive : ''}`}
            aria-pressed={!ru}
            onClick={() => updatePref({ language: 'en' })}
            title="English"
          >
            EN
          </button>
        </div>
      </header>

      <nav class={styles.tabNav} aria-label={t('popupNavigation')}>
        <button
          type="button"
          class={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
          aria-pressed={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          <svg class={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>{t('popupTabSettings')}</span>
        </button>
        <button
          type="button"
          class={`${styles.tabBtn} ${activeTab === 'hotkeys' ? styles.tabBtnActive : ''}`}
          aria-pressed={activeTab === 'hotkeys'}
          onClick={() => setActiveTab('hotkeys')}
        >
          <svg class={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
          </svg>
          <span>{t('popupTabHotkeys')}</span>
        </button>
      </nav>

      {activeTab === 'settings' && (
        <>
          <div class={styles.card}>
            <div class={styles.cardHeader}>
              <span class={styles.cardTitle}>{t('popupSectionControls')}</span>
            </div>

            {TOGGLES.map(({ key, titleKey, descKey, icon }) => (
              <div class={styles.toggleRow} key={key}>
                <div class={styles.toggleMeta}>
                  <div class={styles.toggleTitleRow}>
                    {icon}
                    <span class={styles.toggleTitle}>{t(titleKey)}</span>
                  </div>
                  <span class={styles.toggleDesc}>{t(descKey)}</span>
                </div>
                <label class={styles.switch}>
                  <input
                    type="checkbox"
                    aria-label={t(titleKey)}
                    checked={Boolean(preferences[key])}
                    onChange={(event) => updatePref({ [key]: (event.target as HTMLInputElement).checked })}
                  />
                  <span class={styles.slider} />
                </label>
              </div>
            ))}
          </div>

          <div class={styles.card}>
            <div class={styles.cardHeader}>
              <span class={styles.cardTitle}>{t('popupSectionAppearance')}</span>
            </div>
            <div class={styles.appearanceGrid}>
              <div class={styles.appearanceItem}>
                <span class={styles.appearanceLabel}>{t('popupThemeMode')}</span>
                <div class={styles.segmentedControl}>
                  <button
                    type="button"
                    class={`${styles.segmentBtn} ${currentMode === 'dark' ? styles.segmentBtnActive : ''}`}
                    aria-pressed={currentMode === 'dark'}
                    onClick={() => updatePref({ themeMode: 'dark' })}
                  >
                    <svg class={styles.modeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span>{t('popupThemeDark')}</span>
                  </button>
                  <button
                    type="button"
                    class={`${styles.segmentBtn} ${currentMode === 'light' ? styles.segmentBtnActive : ''}`}
                    aria-pressed={currentMode === 'light'}
                    onClick={() => updatePref({ themeMode: 'light' })}
                  >
                    <svg class={styles.modeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                    <span>{t('popupThemeLight')}</span>
                  </button>
                </div>
              </div>

              <div class={styles.appearanceItem}>
                <span class={styles.appearanceLabel}>{t('popupColorTheme')}</span>
                <div class={styles.swatchGroup} role="group" aria-label={t('popupColorTheme')}>
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      class={`${styles.swatchBtn} ${currentTheme === theme.id ? styles.swatchBtnActive : ''}`}
                      style={{ backgroundColor: theme.color }}
                      aria-pressed={currentTheme === theme.id}
                      aria-label={t(theme.labelKey)}
                      onClick={() => updatePref({ theme: theme.id })}
                      title={t(theme.labelKey)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div class={styles.ctaWrapper}>
            <button type="button" class={styles.primaryCta} onClick={handleOpenVacNet}>
              <svg class={styles.ctaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{t('popupOpenVacnet')}</span>
            </button>
          </div>
        </>
      )}

      {activeTab === 'hotkeys' && (
        <div class={styles.card}>
          <div class={styles.hotkeySection}>
            <div class={styles.hotkeySectionTitle}>{t('popupHotkeysVerdicts')}</div>
            <div class={styles.hotkeyList}>
              {hotkeyRow('popupHkPresets', '1 .. 9')}
              {hotkeyRow('popupHkReset', '0')}
              {hotkeyRow('popupHkSubmit', 'Enter')}
              {hotkeyRow('popupHkSkip', 'Backspace')}
            </div>
          </div>

          <div class={styles.hotkeySection}>
            <div class={styles.hotkeySectionTitle}>{t('popupHotkeysPlayback')}</div>
            <div class={styles.hotkeyList}>
              {hotkeyRow('popupHkPlayPause', 'Space')}
              {hotkeyRow('popupHkRestart', 'R')}
              {hotkeyRow('popupHkJumpEvent', 'E')}
              {hotkeyRow('popupHkZoom', 'Z')}
              {hotkeyRow('popupHkSpeed', '[ / ]')}
              {hotkeyRow('popupHkFrameStep', '← / →')}
            </div>
          </div>

          <div class={styles.hintText}>{t('popupHotkeyHint')}</div>
        </div>
      )}

      <footer class={styles.footer}>
        <span>VACNet Toolkit</span>
        <a
          href="https://github.com/BuYCooLer/VacNet-Toolkit-Extension"
          target="_blank"
          rel="noopener noreferrer"
          class={styles.footerLink}
        >
          GitHub ↗
        </a>
      </footer>
    </div>
  );
};
