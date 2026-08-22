import { historyKey, type ClipHistoryEntry } from '../../../entities/history';
import { verdictNames, type VerdictValue } from '../../../entities/verdict';
import type { Translate } from '../../../shared/i18n';
import { useTranslation } from '../../../shared/use-translation';
import { formatClipRange, formatMatchDate } from '../../../shared/formatters';
import { getSafeExternalUrl } from '../../../shared/external-url';
import { type MatchHistory } from '../utils';
import styles from './HistoryList.module.css';

interface HistoryMatchCardProps {
  match: MatchHistory;
  matchNumber: number;
}

const verdictText = (value: VerdictValue, t: Translate): string => {
  if (value === 'positive') return t('btnYes');
  if (value === 'negative') return t('btnNo');
  return t('btnUncertain');
};

const deduplicationText = (entry: ClipHistoryEntry, t: Translate): string => {
  if (entry.deduplication === 'exact-duplicate') return t('clipStatusExactDuplicate');
  if (entry.deduplication === 'new-clip') return t('clipStatusNewClip');
  return t('clipStatusNewMatch');
};

const clipLink = (entry: ClipHistoryEntry): string =>
  `${entry.sourceWebmUrl}#t=${entry.range.start.toFixed(3)}`;

const statusClass = (entry: ClipHistoryEntry): string => {
  if (entry.deduplication === 'exact-duplicate') return `${styles.status} ${styles.statusExact}`;
  return `${styles.status} ${styles.statusNew}`;
};

const verdictClass = (value: VerdictValue): string => {
  if (value === 'positive') return styles.positive ?? '';
  if (value === 'negative') return styles.negative ?? '';
  return styles.skip ?? '';
};

export const HistoryMatchCard = ({ match, matchNumber }: HistoryMatchCardProps) => {
  const t = useTranslation();
  const entries = [...match.entries].sort((first, second) => first.timestamp - second.timestamp);
  const lastClip = entries.at(-1);
  if (!lastClip) return null;
  const firstClip = entries[0];
  if (!firstClip) return null;

  const taskIds = Array.from(new Set(entries.map((entry) => entry.taskId)));
  const labels = {
    aimassist: t('labelAimAssist'),
    wallhack: t('labelWallHack'),
    autobhop: t('labelAutoBhop'),
    bot: t('labelBot'),
  };

  return (
    <details class={styles.item}>
      <summary>
        <span title={match.fallbackVideoId ?? t('unknownDate')}>
          {t('historyMatch')} {matchNumber} - {match.matchTimestamp !== null ? formatMatchDate(match.matchTimestamp) : t('unknownDate')}
        </span>
        <button
          type="button"
          class={styles.taskTrigger}
          aria-label={`${t('taskId')}: ${taskIds.join(', ')}`}
          aria-describedby={`history-task-tooltip-${matchNumber}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {taskIds.length} {t('historyTasks')}
          <span class={styles.taskTooltip} id={`history-task-tooltip-${matchNumber}`} role="tooltip">
            {taskIds.map((taskId) => <span key={taskId}>{taskId}</span>)}
          </span>
        </button>
      </summary>
      <div class={styles.content}>
        <div class={styles.tools}>
          {getSafeExternalUrl(firstClip.sourceWebmUrl)
            ? <a href={getSafeExternalUrl(firstClip.sourceWebmUrl) ?? undefined} target="_blank" rel="noreferrer">{t('openVideo')}</a>
            : <span>{t('openVideo')}</span>}
          <span>{entries.length}</span>
        </div>
        {match.fallbackVideoId && <p class={styles.videoId}>{t('videoId')}: {match.fallbackVideoId}</p>}
        <ol class={styles.clipList}>
          {entries.map((entry, index) => (
            <li class={styles.clip} key={historyKey(entry)}>
              <div class={styles.clipHeader}>
                <strong>{t('clipNumber')} {index + 1}</strong>
                {getSafeExternalUrl(clipLink(entry))
                  ? <a href={getSafeExternalUrl(clipLink(entry)) ?? undefined} target="_blank" rel="noreferrer">
                      {formatClipRange(entry.range.start, entry.range.end)}
                    </a>
                  : <span>{formatClipRange(entry.range.start, entry.range.end)}</span>}
              </div>
              <div class={styles.clipMeta}>
                {match.fallbackVideoId === null && <span title={entry.videoId}>{t('videoId')}: {entry.videoId.substring(0, 16)}...</span>}
                <span>{t('taskId')}: {entry.taskId}</span>
                <span>{t('eventTime')}: {entry.eventTime.toFixed(3)} s</span>
                <span class={statusClass(entry)}>
                  {deduplicationText(entry, t)}
                </span>
              </div>
              {entry.badClip && <strong class={styles.badClip}>{t('badClip')}</strong>}
              <dl>
                {verdictNames.map((name) => (
                  <div key={name}>
                    <dt>{labels[name]}</dt>
                    <dd class={verdictClass(entry[name])}>{verdictText(entry[name], t)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
};
