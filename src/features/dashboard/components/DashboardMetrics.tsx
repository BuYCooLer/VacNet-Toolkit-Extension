import { createClipIdentity } from '../../../entities/clip';
import type { PageSnapshot } from '../../../entities/clip';
import { MetricSection } from '../../../shared/components/MetricSection';
import { formatClipRange, formatMatchDate } from '../../../shared/formatters';
import { useTranslation } from '../../../shared/use-translation';

const describeDeduplication = (
  status: PageSnapshot['deduplication'],
  t: ReturnType<typeof useTranslation>,
): string => {
  if (status === null) return t('clipSummaryChecking');
  if (status === 'exact-duplicate') return t('clipStatusExactDuplicate');
  if (status === 'new-clip') return t('clipStatusNewClip');
  return t('clipStatusNewMatch');
};

export const DashboardMetrics = ({ snapshot }: { snapshot: PageSnapshot }) => {
  const t = useTranslation();
  return (
    <>
      <MetricSection title={t('clipDataTitle')} entries={[
         { key: 'task-id', label: t('taskId'), value: snapshot.clip?.taskId ?? t('statusLoadingNextClip') },
         { key: 'webm-url', label: t('webmUrl'), value: snapshot.clip?.sourceWebmUrl ?? t('statusLoadingNextClip'), href: snapshot.clip?.sourceWebmUrl ?? null },
         { key: 'video-id', label: t('videoId'), value: snapshot.clip?.videoId ?? t('statusLoadingNextClip') },
         { key: 'app', label: t('app'), value: snapshot.clip?.app ?? t('statusLoadingNextClip') },
         { key: 'clip-range', label: t('clipRange'), value: snapshot.clip ? formatClipRange(snapshot.clip.range.start, snapshot.clip.range.end) : t('statusLoadingNextClip') },
         { key: 'event-time', label: t('eventTime'), value: snapshot.clip ? `${snapshot.clip.eventTime.toFixed(3)} s` : t('statusLoadingNextClip') },
         { key: 'match-timestamp', label: t('matchDate'), value: snapshot.clip ? (snapshot.clip.matchTimestamp !== null ? formatMatchDate(snapshot.clip.matchTimestamp) : t('unknownDate')) : t('statusLoadingNextClip') },
         { key: 'clip-key', label: t('clipKey'), value: snapshot.clip ? createClipIdentity(snapshot.clip).clipKey : t('statusLoadingNextClip') },
         { key: 'identity-status', label: t('clipIdentityStatus'), value: describeDeduplication(snapshot.deduplication, t) },
      ]} />
      <MetricSection title={t('plyrRuntime')} entries={[
         { key: 'player-id', label: t('playerId'), value: snapshot.player?.id ?? t('notFound') },
         { key: 'player-version', label: t('version'), value: snapshot.player?.version ?? t('notFound') },
         { key: 'player-language', label: t('language'), value: snapshot.player?.language ?? t('notFound') },
         { key: 'debug', label: t('debug'), value: snapshot.player ? (snapshot.player.debugEnabled ? t('enabled') : t('disabled')) : t('notFound') },
      ]} />
    </>
  );
};
