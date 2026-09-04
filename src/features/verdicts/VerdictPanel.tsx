import { useState } from 'preact/hooks';
import type { ClipData, ClipDeduplication } from '../../entities/clip';
import {
  emptyVerdicts,
  verdictNames,
  verdictValues,
  DEFAULT_PRESETS,
  type CustomPreset,
  type VerdictName,
  type VerdictSelection,
  type VerdictValue,
} from '../../entities/verdict';
import type { Translate } from '../../shared/i18n';
import { useTranslation } from '../../shared/use-translation';
import { formatMatchDate } from '../../shared/formatters';
import styles from './VerdictPanel.module.css';

export type { CustomPreset };

/** Presets past this position have no digit key to bind to. */
const MAX_PRESET_HOTKEYS = 9;

interface VerdictPanelProps {
  clip: ClipData | null;
  deduplication: ClipDeduplication | null;
  clipCount: string | null;
  error: string | null;
  onChange: (name: VerdictName, value: VerdictValue) => void;
  onApplyPreset?: (verdicts: VerdictSelection) => void;
  onSubmit: (verdicts: VerdictSelection, badClip: boolean) => void;
  previousVerdicts: VerdictSelection | null;
  submitting: boolean;
  verdicts: VerdictSelection;
  presets?: CustomPreset[];
  onUpdatePresets?: (presets: CustomPreset[]) => void;
  autoSubmitPreset?: boolean;
}

const labels = (t: Translate): Record<VerdictName, string> => ({
  aimassist: t('labelAimAssist'),
  wallhack: t('labelWallHack'),
  autobhop: t('labelAutoBhop'),
  bot: t('labelBot'),
});

/*
 * Abbreviations for the four columns of the preset editor. Left untranslated
 * on purpose: these are the community's own shorthand and read the same in
 * both locales, where the full category names would not fit the column.
 */
const shortLabels: Record<VerdictName, string> = {
  aimassist: 'Aim',
  wallhack: 'WH',
  autobhop: 'BHop',
  bot: 'Bot',
};

const choiceLabel = (value: VerdictValue, t: Translate): string => {
  if (value === 'positive') return t('btnYes');
  if (value === 'negative') return t('btnNo');
  return t('btnUncertain');
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled clip deduplication status: ${String(value)}`);
};

interface DuplicateSummary {
  videoLabel: string;
  videoClass: string;
  momentLabel: string;
  momentClass: string;
}

const duplicateSummary = (status: ClipDeduplication | null, t: Translate): DuplicateSummary => {
  if (status === null) {
    return {
      videoLabel: t('clipSummaryChecking'),
      videoClass: styles.valSkip ?? '',
      momentLabel: t('clipSummaryChecking'),
      momentClass: styles.valSkip ?? '',
    };
  }

  switch (status) {
    case 'exact-duplicate':
      return {
        videoLabel: t('clipSummaryRepeat'),
        videoClass: styles.valPositive ?? '',
        momentLabel: t('clipSummaryRepeat'),
        momentClass: styles.valPositive ?? '',
      };
    case 'new-clip':
    case 'new-match':
      return {
        videoLabel: t('clipSummaryNew'),
        videoClass: styles.valNegative ?? '',
        momentLabel: t('clipSummaryNew'),
        momentClass: styles.valNegative ?? '',
      };
  }

  return assertNever(status);
};

const valueColorClass = (value: VerdictValue): string => {
  if (value === 'positive') return styles.valPositive ?? '';
  if (value === 'negative') return styles.valNegative ?? '';
  return styles.valSkip ?? '';
};

const choiceColorClass = (value: VerdictValue): string => {
  if (value === 'positive') return styles.positive ?? '';
  if (value === 'negative') return styles.negative ?? '';
  return styles.skip ?? '';
};

const presetSelectClass = (value: VerdictValue): string => {
  if (value === 'positive') return styles.presetSelectPositive ?? '';
  if (value === 'negative') return styles.presetSelectNegative ?? '';
  return styles.presetSelectSkip ?? '';
};

const ResetIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const GearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const VerdictPanel = ({
  clip,
  clipCount,
  deduplication,
  error,
  onChange,
  onApplyPreset,
  onSubmit,
  previousVerdicts,
  submitting,
  verdicts,
  presets: propPresets,
  onUpdatePresets,
  autoSubmitPreset,
}: VerdictPanelProps) => {
  const t = useTranslation();
  const categoryLabels = labels(t);
  const summary = duplicateSummary(deduplication, t);

  const committed = propPresets && propPresets.length > 0 ? propPresets : DEFAULT_PRESETS;

  /*
   * While the editor is open, `draft` is the rendered source of truth. It has
   * to be, because label edits are only persisted on blur: rendering the
   * committed props during typing would discard each keystroke as soon as it
   * was made. `null` means the editor is closed and the props are shown
   * directly, so preference changes from elsewhere flow straight through.
   */
  const [draft, setDraft] = useState<CustomPreset[] | null>(null);
  const presets = draft ?? committed;
  const isConfigOpen = draft !== null;

  const commit = (next: CustomPreset[]): void => {
    setDraft(next);
    onUpdatePresets?.(next);
  };

  const editDraft = (index: number, updated: CustomPreset): CustomPreset[] => {
    const next = [...presets];
    next[index] = updated;
    return next;
  };

  const closeConfig = (): void => {
    if (draft) onUpdatePresets?.(draft);
    setDraft(null);
  };

  return (
    <section class={styles.panel} aria-label={t('verdictTitle')}>
      <div class={styles.presets}>
        {presets.map((preset, index) => {
          const hotkey = index < MAX_PRESET_HOTKEYS ? String(index + 1) : null;
          return (
            <button
              key={index}
              type="button"
              class={styles.presetBtn}
              disabled={submitting}
              title={hotkey ? `${preset.label} [${hotkey}]` : preset.label}
              onClick={() => {
                onApplyPreset?.(preset.verdicts);
                if (autoSubmitPreset && clip) {
                  onSubmit(preset.verdicts, false);
                }
              }}
            >
              {hotkey && <span class={styles.presetHotkey}>[{hotkey}]</span>}
              {preset.label || `#${index + 1}`}
            </button>
          );
        })}
        <button
          type="button"
          class={`${styles.presetBtn} ${styles.presetIconBtn}`}
          disabled={submitting}
          aria-label={t('presetResetHint')}
          title={t('presetResetHint')}
          onClick={() => onApplyPreset?.(emptyVerdicts())}
        >
          <ResetIcon />
        </button>
        <button
          type="button"
          class={`${styles.presetBtn} ${styles.presetIconBtn} ${isConfigOpen ? styles.presetBtnActive : ''}`}
          aria-label={t('presetSettingsOpenHint')}
          aria-expanded={isConfigOpen}
          title={t('presetSettingsOpenHint')}
          onClick={() => (isConfigOpen ? closeConfig() : setDraft(committed))}
        >
          <GearIcon />
        </button>
      </div>

      {draft !== null && (
        <div class={styles.presetSettings}>
          <div class={styles.presetSettingsHeader}>
            <strong class={styles.presetSettingsTitle}>{t('presetSettingsTitle')}</strong>
            <button
              type="button"
              class={styles.presetSettingsClose}
              aria-label={t('presetSettingsCloseHint')}
              title={t('presetSettingsCloseHint')}
              onClick={closeConfig}
            >
              <CloseIcon />
            </button>
          </div>

          {draft.map((preset, pIdx) => (
            <div class={styles.presetRow} key={pIdx}>
              <div class={styles.presetRowHeader}>
                <span class={styles.presetIndex}>#{pIdx + 1}</span>
                <input
                  type="text"
                  class={styles.presetInput}
                  value={preset.label}
                  maxLength={12}
                  placeholder={t('presetNamePlaceholder')}
                  aria-label={`${t('presetNamePlaceholder')} #${pIdx + 1}`}
                  onInput={(ev) => {
                    const label = (ev.target as HTMLInputElement).value;
                    setDraft(editDraft(pIdx, { ...preset, label }));
                  }}
                  onChange={(ev) => {
                    const label = (ev.target as HTMLInputElement).value;
                    commit(editDraft(pIdx, { ...preset, label }));
                  }}
                />
              </div>

              <div class={styles.presetGrid}>
                {verdictNames.map((name) => {
                  const value = preset.verdicts[name] ?? 'skip';
                  return (
                    <div class={styles.presetCol} key={name}>
                      <span class={styles.presetCatLabel}>{shortLabels[name]}</span>
                      <select
                        class={`${styles.presetSelect} ${presetSelectClass(value)}`}
                        value={value}
                        aria-label={`${categoryLabels[name]} — #${pIdx + 1}`}
                        onChange={(ev) => {
                          const next = (ev.target as HTMLSelectElement).value as VerdictValue;
                          commit(editDraft(pIdx, {
                            ...preset,
                            verdicts: { ...preset.verdicts, [name]: next },
                          }));
                        }}
                      >
                        <option value="negative">{t('btnNo')}</option>
                        <option value="skip">—</option>
                        <option value="positive">{t('btnYes')}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div class={styles.presetActions}>
            <button type="button" class={styles.presetActionBtn} onClick={() => commit(DEFAULT_PRESETS)}>
              {t('presetResetAll')}
            </button>
            <button
              type="button"
              class={`${styles.presetActionBtn} ${styles.presetActionDone}`}
              onClick={closeConfig}
            >
              {t('presetDone')}
            </button>
          </div>
        </div>
      )}
      {verdictNames.map((name) => (
        <fieldset class={styles.category} disabled={submitting} key={name}>
          <legend>{categoryLabels[name]}</legend>
          <div class={styles.choices}>
            {verdictValues.map((value) => {
              const inputId = `vacnet-${name}-${value}`;
              return (
                <label class={`${styles.choice} ${choiceColorClass(value)}`} key={value}>
                  <input
                    id={inputId}
                    type="radio"
                    name={`vacnet-${name}`}
                    value={value}
                    checked={verdicts[name] === value}
                    onChange={() => onChange(name, value)}
                  />
                  <span>{choiceLabel(value, t)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {error && <p class={styles.error} role="alert">{error}</p>}
      <div class={styles.actions}>
        <button type="button" disabled={submitting} onClick={() => onSubmit(verdicts, false)}>
          {t('btnSubmit')}
        </button>
        <button type="button" disabled={submitting} onClick={() => onSubmit(emptyVerdicts(), false)}>
          {t('btnSkip')}
        </button>
      </div>

      {clip && (
        <div class={previousVerdicts ? styles.infoGrid : styles.infoGridSingle}>
          <section class={styles.previous}>
            <h2>{t('clipDetails')}</h2>
            <dl>
              <div><dt>{t('clipSummaryVideo')}</dt><dd class={summary.videoClass}>{summary.videoLabel}</dd></div>
              <div><dt>{t('clipSummaryMoment')}</dt><dd class={summary.momentClass}>{summary.momentLabel}</dd></div>
              <div><dt>{t('matchDate')}</dt><dd>{clip.matchTimestamp !== null ? formatMatchDate(clip.matchTimestamp) : t('unknownDate')}</dd></div>
              <div><dt>{t('taskId')}</dt><dd>{clip.taskId}</dd></div>
              <div><dt>{t('clipSummaryRange')}</dt><dd>{clip.range.start.toFixed(3)} - {clip.range.end.toFixed(3)}</dd></div>
            </dl>
          </section>

          {previousVerdicts && (
            <section class={styles.previous}>
              <h2>{t('previousVerdicts')}</h2>
              <dl>
                {verdictNames.map((name) => {
                  const val = previousVerdicts[name];
                  return (
                    <div key={name}>
                      <dt>{categoryLabels[name]}</dt>
                      <dd class={valueColorClass(val)}>{choiceLabel(val, t)}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}
        </div>
      )}

      {submitting && <p class={styles.status} role="status">{t('statusLoadingNextClip')}</p>}

      {clipCount && <div class={styles.clipCount}>{t('clipsLabeled')} {clipCount}</div>}
    </section>
  );
};
