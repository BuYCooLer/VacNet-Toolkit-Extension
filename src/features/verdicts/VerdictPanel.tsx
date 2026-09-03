import { useState } from 'preact/hooks';
import type { ClipData, ClipDeduplication } from '../../entities/clip';
import { emptyVerdicts, verdictNames, verdictValues, type VerdictName, type VerdictSelection, type VerdictValue } from '../../entities/verdict';
import type { Translate } from '../../shared/i18n';
import { useTranslation } from '../../shared/use-translation';
import { formatMatchDate } from '../../shared/formatters';
import styles from './VerdictPanel.module.css';

export interface CustomPreset {
  label: string;
  verdicts: VerdictSelection;
}

const DEFAULT_PRESETS: CustomPreset[] = [
  { label: 'LEGIT', verdicts: { aimassist: 'negative', wallhack: 'negative', autobhop: 'negative', bot: 'negative' } },
  { label: 'AIM', verdicts: { aimassist: 'positive', wallhack: 'negative', autobhop: 'negative', bot: 'negative' } },
  { label: 'WH', verdicts: { aimassist: 'negative', wallhack: 'positive', autobhop: 'negative', bot: 'negative' } },
  { label: 'RAGE', verdicts: { aimassist: 'positive', wallhack: 'positive', autobhop: 'positive', bot: 'negative' } },
];

const PRESETS_STORAGE_KEY = 'vacnet_custom_presets';

const loadStoredPresets = (): CustomPreset[] => {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as CustomPreset[];
      }
    }
  } catch {}
  return DEFAULT_PRESETS;
};

const saveStoredPresets = (presets: CustomPreset[]): void => {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {}
};

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
}

const labels = (t: Translate): Record<VerdictName, string> => ({
  aimassist: t('labelAimAssist'),
  wallhack: t('labelWallHack'),
  autobhop: t('labelAutoBhop'),
  bot: t('labelBot'),
});

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
}: VerdictPanelProps) => {
  const t = useTranslation();
  const categoryLabels = labels(t);
  const summary = duplicateSummary(deduplication, t);

  const [presets, setPresets] = useState<CustomPreset[]>(() => loadStoredPresets());
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleUpdatePreset = (index: number, updated: CustomPreset) => {
    const next = [...presets];
    next[index] = updated;
    setPresets(next);
    saveStoredPresets(next);
  };

  const handleResetPresets = () => {
    setPresets(DEFAULT_PRESETS);
    saveStoredPresets(DEFAULT_PRESETS);
  };

  return (
    <section class={styles.panel} aria-label={t('verdictTitle')}>
      <h1>{t('verdictTitle')}</h1>

      <div class={styles.presets}>
        {presets.map((preset, index) => (
          <button
            key={index}
            type="button"
            class={styles.presetBtn}
            disabled={submitting}
            title={preset.label}
            onClick={() => onApplyPreset?.(preset.verdicts)}
          >
            {preset.label || `#${index + 1}`}
          </button>
        ))}
        <button
          type="button"
          class={styles.presetBtn}
          disabled={submitting}
          title="Сброс (Не уверен)"
          onClick={() => onApplyPreset?.(emptyVerdicts())}
        >
          {'\u21BA'}
        </button>
        <button
          type="button"
          class={`${styles.presetBtn} ${isConfigOpen ? styles.presetBtnActive : ''}`}
          title="Настройка пресетов"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
        >
          {'\u2699'}
        </button>
      </div>

      {isConfigOpen && (
        <div class={styles.presetSettings}>
          <div class={styles.presetSettingsHeader}>
            <strong class={styles.presetSettingsTitle}>Настройка пресетов</strong>
            <button
              type="button"
              class={styles.presetSettingsClose}
              onClick={() => setIsConfigOpen(false)}
            >
              &times;
            </button>
          </div>

          {presets.map((preset, pIdx) => (
            <div class={styles.presetRow} key={pIdx}>
              <div class={styles.presetRowHeader}>
                <span class={styles.presetIndex}>#{pIdx + 1}</span>
                <input
                  type="text"
                  class={styles.presetInput}
                  value={preset.label}
                  maxLength={12}
                  placeholder="Имя"
                  onInput={(ev) => {
                    const label = (ev.target as HTMLInputElement).value;
                    handleUpdatePreset(pIdx, { ...preset, label });
                  }}
                />
              </div>

              <div class={styles.presetGrid}>
                {verdictNames.map((name) => {
                  const val = preset.verdicts[name] || 'skip';
                  const selectColorClass =
                    val === 'positive'
                      ? styles.presetSelectPositive
                      : val === 'negative'
                        ? styles.presetSelectNegative
                        : styles.presetSelectSkip;
                  return (
                    <div class={styles.presetCol} key={name}>
                      <span class={styles.presetCatLabel}>
                        {name === 'aimassist' ? 'Aim' : name === 'wallhack' ? 'WH' : name === 'autobhop' ? 'BHop' : 'Bot'}
                      </span>
                      <select
                        class={`${styles.presetSelect} ${selectColorClass}`}
                        value={val}
                        onChange={(ev) => {
                          const value = (ev.target as HTMLSelectElement).value as VerdictValue;
                          handleUpdatePreset(pIdx, {
                            ...preset,
                            verdicts: { ...preset.verdicts, [name]: value },
                          });
                        }}
                      >
                        <option value="negative">Нет</option>
                        <option value="skip">—</option>
                        <option value="positive">Да</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div class={styles.presetActions}>
            <button type="button" class={styles.presetActionBtn} onClick={handleResetPresets}>
              Сбросить
            </button>
            <button
              type="button"
              class={`${styles.presetActionBtn} ${styles.presetActionDone}`}
              onClick={() => setIsConfigOpen(false)}
            >
              Готово
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
                  <label class={`${styles.choice} ${choiceColorClass(value)}`} key={value} htmlFor={inputId}>
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
