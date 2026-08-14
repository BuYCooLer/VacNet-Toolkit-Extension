export interface ClipRange {
  start: number;
  end: number;
}

export type ClipDeduplication = 'new-match' | 'same-match-different-clip' | 'exact-duplicate';

export interface ClipIdentity {
  taskId: string;
  sourceWebmUrl: string;
  videoId: string;
}

export interface ClipData extends ClipIdentity {
  range: ClipRange;
  eventTime: number;
  clipCount: string | null;
  app: string;
}

export interface ClipCompositeIdentity {
  clipKey: string;
}

export interface PlayerMetrics {
  id: string;
  version: string | null;
  language: string | null;
  debugEnabled: boolean;
  players: number;
  frameDuration: number;
}

export interface PageSnapshot {
  clip: ClipData | null;
  deduplication: ClipDeduplication | null;
  player: PlayerMetrics | null;
  hasVideo: boolean;
  submitting: boolean;
  error: string | null;
}

export const extractVideoId = (sourceWebmUrl: string): string => {
  let filename = sourceWebmUrl;
  try {
    const url = new URL(sourceWebmUrl, globalThis.location.href);
    filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
  } catch {
    filename = sourceWebmUrl.split(/[/?#]/u).filter(Boolean).at(-1) ?? sourceWebmUrl;
  }
  const stem = filename.replace(/\.webm$/iu, '');
  const hash = stem.match(/^(?:csow|cl)_([0-9a-f]{16,})$/iu)?.[1];
  return (hash ?? stem).trim().toLowerCase();
};

export const createClipIdentity = (clip: Pick<ClipData, 'videoId' | 'range'>): ClipCompositeIdentity => {
  const videoId = clip.videoId.trim().toLowerCase();
  const start = Math.round(clip.range.start * 1_000);
  const end = Math.round(clip.range.end * 1_000);
  return { clipKey: `video:${videoId}|start:${start}|end:${end}` };
};
