export const getSafeExternalUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

export const redactUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return value;
  }
};
