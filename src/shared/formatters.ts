export const formatClipRange = (start: number, end: number): string => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'N/A';
  return `${start.toFixed(3)}–${end.toFixed(3)} s`;
};

export const formatProcessedAt = (timestamp: number): string => {
  if (!Number.isFinite(timestamp)) return 'N/A';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const part = (value: number): string => String(value).padStart(2, '0');
  return `${part(date.getDate())}.${part(date.getMonth() + 1)}.${part(date.getFullYear() % 100)} | ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
};

export const formatMatchDate = (matchTimestamp: number | null): string => {
  if (matchTimestamp === null) return 'Legacy';
  if (!Number.isFinite(matchTimestamp)) return 'N/A';
  const date = new Date(matchTimestamp * 1000);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const part = (value: number): string => String(value).padStart(2, '0');
  return `${part(date.getDate())}.${part(date.getMonth() + 1)}.${part(date.getFullYear() % 100)} | ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
};
