import { getAllowedWebmUrl } from '../../shared/url-policy';

export interface WebmMetadata {
  matchTimestamp: number;
  duration: number;
}

const RANGE_HEADER = 'bytes=0-8192';
const MAX_RANGE_BYTES = 8_193;
const MAX_METADATA_SECONDS = 24 * 60 * 60;
const DATE_UTC_ID = [0x44, 0x61] as const;
const DURATION_ID = [0x44, 0x89] as const;
const TIMECODE_SCALE_ID = [0x2a, 0xd7, 0xb1] as const;

interface VintValue {
  value: number;
  length: number;
}

const readVint = (bytes: Uint8Array, offset: number): VintValue | null => {
  const first = bytes[offset];
  if (first === undefined || first === 0) return null;

  let marker = 0x80;
  let length = 1;
  while (length <= 8 && (first & marker) === 0) {
    marker >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > bytes.length) return null;

  let value = first & (marker - 1);
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[offset + index]!;
  }
  return { value, length };
};

const matchesId = (bytes: Uint8Array, offset: number, id: readonly number[]): boolean =>
  id.every((value, index) => bytes[offset + index] === value);

const readDateUtc = (bytes: Uint8Array, view: DataView, offset: number): number | null => {
  if (!matchesId(bytes, offset, DATE_UTC_ID)) return null;
  const size = readVint(bytes, offset + DATE_UTC_ID.length);
  if (!size || size.value !== 8) return null;

  const payloadOffset = offset + DATE_UTC_ID.length + size.length;
  if (payloadOffset + size.value > bytes.length) return null;

  const timestamp = Number(view.getBigInt64(payloadOffset, false));
  return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : null;
};

const readTimecodeScale = (bytes: Uint8Array, view: DataView, offset: number): number | null => {
  if (!matchesId(bytes, offset, TIMECODE_SCALE_ID)) return null;
  const size = readVint(bytes, offset + TIMECODE_SCALE_ID.length);
  if (!size || size.value < 1 || size.value > 8) return null;
  const payloadOffset = offset + TIMECODE_SCALE_ID.length + size.length;
  if (payloadOffset + size.value > bytes.length) return null;
  let scale = 0;
  for (let index = 0; index < size.value; index += 1) scale = scale * 256 + bytes[payloadOffset + index]!;
  return Number.isFinite(scale) && scale > 0 ? scale : null;
};

const readDuration = (bytes: Uint8Array, view: DataView, offset: number, timecodeScale: number): number | null => {
  if (!matchesId(bytes, offset, DURATION_ID)) return null;
  const size = readVint(bytes, offset + DURATION_ID.length);
  if (!size || (size.value !== 4 && size.value !== 8)) return null;

  const payloadOffset = offset + DURATION_ID.length + size.length;
  if (payloadOffset + size.value > bytes.length) return null;

  const duration = size.value === 4
    ? view.getFloat32(payloadOffset, false)
    : view.getFloat64(payloadOffset, false);
  const seconds = duration * timecodeScale / 1_000_000_000;
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_METADATA_SECONDS ? seconds : null;
};

const parseContentRange = (value: string | null): { start: number; end: number; total: number | null } | null => {
  const match = value?.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/u);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = match[3] === '*' ? null : Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start !== 0 || end < start) return null;
  if (end - start + 1 > MAX_RANGE_BYTES) return null;
  if (total !== null && (!Number.isSafeInteger(total) || total <= end)) return null;
  return { start, end, total };
};

const parseMetadata = (buffer: ArrayBuffer): WebmMetadata | null => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let matchTimestamp: number | null = null;
  let duration: number | null = null;
  let timecodeScale = 1_000_000;

  for (let offset = 0; offset < bytes.length - 3; offset += 1) {
    if (timecodeScale === 1_000_000) {
      const parsedScale = readTimecodeScale(bytes, view, offset);
      if (parsedScale !== null) timecodeScale = parsedScale;
    }
    if (matchTimestamp === null) matchTimestamp = readDateUtc(bytes, view, offset);
    if (duration === null) duration = readDuration(bytes, view, offset, timecodeScale);
    if (matchTimestamp !== null && duration !== null) return { matchTimestamp, duration };
  }

  return matchTimestamp !== null && duration !== null ? { matchTimestamp, duration } : null;
};

export const extractWebmMetadata = async (url: string): Promise<WebmMetadata | null> => {
  try {
    const parsedUrl = getAllowedWebmUrl(url);
    if (!parsedUrl) return null;
    const response = await fetch(parsedUrl, { headers: { Range: RANGE_HEADER } });
    if (!response.ok || response.status !== 206) return null;
    const contentRange = parseContentRange(response.headers.get('content-range'));
    if (!contentRange) return null;
    const contentLength = Number(response.headers.get('content-length'));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_RANGE_BYTES) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== contentLength || buffer.byteLength !== contentRange.end - contentRange.start + 1) return null;
    return parseMetadata(buffer);
  } catch {
    return null;
  }
};
