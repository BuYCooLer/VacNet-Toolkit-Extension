import { MetricSection } from '../../../shared/components/MetricSection';
import { useTranslation } from '../../../shared/use-translation';
import { HistoryMatchCard } from './HistoryMatchCard';
import { groupHistoryByMatch, matchHistoryKey } from '../utils';
import type { HistoryState } from '../../../entities/history';
import styles from './HistoryList.module.css';

interface DashboardHistoryProps {
  totalClipsViewed: string | number;
  history: HistoryState;
}

export const DashboardHistory = ({ totalClipsViewed, history }: DashboardHistoryProps) => {
  const t = useTranslation();
  const entries = Object.values(history.entries).sort((first, second) => second.timestamp - first.timestamp);
  const matches = groupHistoryByMatch(entries);

  return (
    <>
      <MetricSection title={t('clipLogSummary')} entries={[
        { label: t('totalClipsViewed'), value: totalClipsViewed },
        { label: t('savedInLocalHistory'), value: entries.length },
        { label: t('clipRepeats'), value: history.stats.repeats },
      ]} />
      <section class={styles.section}>
        <h3>{t('recentClips')}</h3>
        <div class={styles.list}>
          {matches.length === 0
            ? <p class={styles.empty}>{t('noClipHistory')}</p>
            : matches.map((match, index) => (
              <HistoryMatchCard
                key={matchHistoryKey(match)}
                match={match}
                matchNumber={matches.length - index}
              />
            ))}
        </div>
      </section>
    </>
  );
};
