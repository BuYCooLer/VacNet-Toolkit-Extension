import type { MessageCatalog } from '../../shared/i18n';
import type { ClipHistoryEntry } from '../../domain/history';
import { createClipIdentity } from '../../domain/clip';
import { verdictNames, type VerdictValue } from '../../domain/verdict';
import { dashboardModeSignal, historySignal, snapshotSignal } from '../state';
import { MetricSection } from './MetricSection';

interface Props {
  catalog: MessageCatalog;
  onClose: () => void;
  onClearHistory: () => void;
  onCopyMetrics: () => void;
}

const verdictText = (value: VerdictValue, catalog: MessageCatalog): string =>
  value === 'positive' ? catalog.btnYes : value === 'negative' ? catalog.btnNo : catalog.btnUncertain;

const deduplicationText = (status: typeof snapshotSignal.value.deduplication, catalog: MessageCatalog): string =>
  status === 'exact-duplicate'
    ? catalog.clipStatusExactDuplicate
    : status === 'same-match-different-clip'
      ? catalog.clipStatusSameVideoDifferentClip
      : status === 'new-match'
        ? catalog.clipStatusNewVideo
        : catalog.clipStatusNewVideo;

const formatRange = (start: number, end: number): string => `${start.toFixed(3)}–${end.toFixed(3)} s`;

const formatProcessedAt = (timestamp: number): string => {
  const date = new Date(timestamp);
  const part = (value: number): string => String(value).padStart(2, '0');
  return `${part(date.getDate())}.${part(date.getMonth() + 1)}.${part(date.getFullYear() % 100)} | ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
};

interface VideoHistory {
  videoId: string;
  sourceWebmUrl: string;
  entries: ClipHistoryEntry[];
}

const groupByVideo = (entries: ClipHistoryEntry[]): VideoHistory[] => {
  const videos = new Map<string, VideoHistory>();
  entries.forEach((entry) => {
    const video = videos.get(entry.videoId);
    if (video) {
      video.entries.push(entry);
      return;
    }
    videos.set(entry.videoId, { videoId: entry.videoId, sourceWebmUrl: entry.sourceWebmUrl, entries: [entry] });
  });
  return Array.from(videos.values()).sort((first, second) => Math.max(...second.entries.map((entry) => entry.timestamp)) - Math.max(...first.entries.map((entry) => entry.timestamp)));
};

const clipLink = (entry: ClipHistoryEntry): string => `${entry.sourceWebmUrl}#t=${entry.range.start.toFixed(3)}`;

export const Dashboard = ({ catalog, onClose, onClearHistory, onCopyMetrics }: Props) => {
  const mode = dashboardModeSignal.value;
  if (!mode) return null;
  const snapshot = snapshotSignal.value;
  const history = historySignal.value;
  const entries = Object.values(history.entries).sort((first, second) => second.timestamp - first.timestamp);
  const videos = groupByVideo(entries);
  const labels = {
    aimassist: catalog.labelAimAssist,
    wallhack: catalog.labelWallHack,
    autobhop: catalog.labelAutoBhop,
    bot: catalog.labelBot,
  };
  return (
    <aside class={`dashboard dashboard-${mode}`} role="dialog" aria-modal="true" aria-label={mode === 'history' ? catalog.clipLogTitle : catalog.devMetricsTitle}>
      <header>
        <h2>{mode === 'history' ? catalog.clipLogTitle : catalog.devMetricsTitle}<small>{catalog.byAuthor}</small></h2>
        <div class="dashboard-actions">
          <button type="button" class="dashboard-action" aria-label={mode === 'history' ? catalog.clearVideoHistory : catalog.copyMetrics} title={mode === 'history' ? catalog.clearVideoHistoryHint : catalog.copyMetricsHint} onClick={mode === 'history' ? onClearHistory : onCopyMetrics}>{mode === 'history' ? '⌫' : '⧉'}</button>
          <button type="button" class="close" aria-label={catalog.closeDashboard} onClick={onClose}>×</button>
        </div>
      </header>
      <div class="dashboard-content">
        {mode === 'metrics' ? (
          <>
            <MetricSection title={catalog.clipDataTitle} entries={[
              { label: catalog.taskId, value: snapshot.clip?.taskId ?? catalog.statusLoadingNextClip },
              { label: catalog.webmUrl, value: snapshot.clip?.sourceWebmUrl ?? catalog.statusLoadingNextClip, href: snapshot.clip?.sourceWebmUrl ?? null },
              { label: catalog.videoId, value: snapshot.clip?.videoId ?? catalog.statusLoadingNextClip },
              { label: catalog.app, value: snapshot.clip?.app ?? '730' },
              { label: catalog.clipRange, value: snapshot.clip ? formatRange(snapshot.clip.range.start, snapshot.clip.range.end) : '0.000–12.000 s' },
              { label: catalog.eventTime, value: `${(snapshot.clip?.eventTime ?? 0).toFixed(3)} s` },
              { label: catalog.clipKey, value: snapshot.clip ? createClipIdentity(snapshot.clip).clipKey : catalog.statusLoadingNextClip },
              { label: catalog.clipIdentityStatus, value: deduplicationText(snapshot.deduplication, catalog) },
            ]} />
            <MetricSection title={catalog.videoJsRuntime} entries={[
              { label: catalog.playerId, value: snapshot.player?.id ?? catalog.notFound },
              { label: catalog.version, value: snapshot.player?.version ?? catalog.notFound },
              { label: catalog.language, value: snapshot.player?.language ?? catalog.notFound },
              { label: catalog.debug, value: snapshot.player?.debugEnabled ? catalog.enabled : catalog.disabled },
              { label: catalog.playerCount, value: snapshot.player?.players ?? 0 },
              { label: catalog.frameDuration, value: snapshot.player ? `${snapshot.player.frameDuration.toFixed(4)} s` : catalog.notFound },
            ]} />
          </>
        ) : (
          <>
            <MetricSection title={catalog.clipLogSummary} entries={[
              { label: catalog.totalClipsViewed, value: snapshot.clip?.clipCount ?? 0 },
              { label: catalog.savedInLocalHistory, value: entries.length },
              { label: catalog.clipRepeats, value: history.stats.repeats },
            ]} />
            <section class="history-section">
              <h3>{catalog.recentClips}</h3>
              <div class="history-list">
                {videos.length === 0 ? <p class="empty">{catalog.noClipHistory}</p> : videos.map((video, videoIndex) => {
                  const videoEntries = [...video.entries].sort((first, second) => first.timestamp - second.timestamp);
                  const taskIds = Array.from(new Set(videoEntries.map((entry) => entry.taskId)));
                  const lastClip = videoEntries.at(-1);
                  if (!lastClip) return null;
                  const videoNumber = videos.length - videoIndex;
                  return (
                    <details class="history-item history-video" key={video.videoId}>
                      <summary>
                        <span title={video.videoId}>{catalog.historyVideo} {videoNumber} - {formatProcessedAt(lastClip.timestamp)}</span>
                        <span class="history-task-trigger" tabIndex={0}>{taskIds.length} {catalog.historyTasks}<span class="history-task-tooltip" role="tooltip">{taskIds.map((taskId) => <span key={taskId}>{taskId}</span>)}</span></span>
                      </summary>
                      <div class="history-video-content">
                        <div class="history-video-tools">
                          <a href={video.sourceWebmUrl} target="_blank" rel="noreferrer">{catalog.openVideo}</a>
                          <span>{catalog.historyClipCount}: {videoEntries.length}</span>
                        </div>
                        <p class="history-video-id">{catalog.videoId}: {video.videoId}</p>
                        <ol class="history-clip-list">
                          {videoEntries.map((entry, index) => (
                            <li class="history-clip" key={`${entry.taskId}-${entry.timestamp}`}>
                              <div class="history-clip-header">
                                <strong>{catalog.clipNumber} {index + 1}</strong>
                                <a href={clipLink(entry)} target="_blank" rel="noreferrer">{formatRange(entry.range.start, entry.range.end)}</a>
                              </div>
                              <div class="history-clip-meta">
                                <span>{catalog.taskId}: {entry.taskId}</span>
                                <span>{catalog.eventTime}: {entry.eventTime.toFixed(3)} s</span>
                                <span class={`history-clip-status history-clip-status-${entry.deduplication}`}>{deduplicationText(entry.deduplication, catalog)}</span>
                              </div>
                              {entry.badClip && <strong class="bad-clip">{catalog.badClip}</strong>}
                              <dl>
                                {verdictNames.map((name) => (
                                  <div key={name}>
                                    <dt>{labels[name]}</dt>
                                    <dd class={`verdict-${entry[name]}`}>{verdictText(entry[name], catalog)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
};
