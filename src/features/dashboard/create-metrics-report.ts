import type { Preferences } from '../../entities/preferences';
import type { PageSnapshot } from '../../entities/clip';
import { redactUrl } from '../../shared/external-url';

interface MetricsReportOptions {
  pageUrl: string;
  preferences: Preferences;
  snapshot: PageSnapshot;
  video: HTMLVideoElement | null;
}

const redactSnapshot = (snapshot: PageSnapshot): PageSnapshot => ({
  ...snapshot,
  clip: snapshot.clip
    ? { ...snapshot.clip, sourceWebmUrl: redactUrl(snapshot.clip.sourceWebmUrl) }
    : null,
});

export const createMetricsReport = ({ pageUrl, preferences, snapshot, video }: MetricsReportOptions): string => {
  const report = {
    generatedAt: new Date().toISOString(),
    pageUrl: redactUrl(pageUrl),
    snapshot: redactSnapshot(snapshot),
    video: video
      ? {
          currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          readyState: video.readyState,
          networkState: video.networkState,
        }
      : null,
    preferences: {
      dashboardOpen: preferences.dashboardOpen,
      stretchVideo: preferences.stretchVideo,
      hideNickname: preferences.hideNickname,
      autoApplyRepeatVerdicts: preferences.autoApplyRepeatVerdicts,
    },
  };
  return JSON.stringify(report, (_key: string, value: unknown): unknown => {
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    return value;
  }, 2);
};
