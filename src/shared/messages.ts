/**
 * Message lookup with no schema dependency.
 *
 * Split out of i18n.ts so that consumers which only need to translate a
 * string — the popup, in particular — do not pull the validation library into
 * their bundle. i18n.ts re-exports everything here and adds the catalog
 * schema on top for the content scripts, which validate the whole catalog.
 */
import { browser } from 'wxt/browser';
import { messageKeys, type MessageKey } from './generated-message-keys';
import ruRaw from '../../public/_locales/ru/messages.json';
import enRaw from '../../public/_locales/en/messages.json';

export { messageKeys, type MessageKey } from './generated-message-keys';

const ruDict = ruRaw as Record<string, { message: string }>;
const enDict = enRaw as Record<string, { message: string }>;

export type Language = 'auto' | 'ru' | 'en';

export type Translate = (key: MessageKey, substitutions?: string | string[]) => string;

export const isRussian = (lang: Language): boolean => {
  if (lang === 'ru') return true;
  if (lang === 'en') return false;
  try {
    if (browser.i18n.getUILanguage().toLowerCase().startsWith('ru')) return true;
  } catch {}
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ru');
};

export const getMessage = (
  key: MessageKey,
  substitutions?: string | string[],
  lang: Language = 'auto',
): string => {
  if (lang === 'ru' && ruDict[key]?.message) return ruDict[key].message;
  if (lang === 'en' && enDict[key]?.message) return enDict[key].message;
  try {
    const message = browser.i18n.getMessage(key, substitutions);
    if (message) return message;
  } catch {}
  return ruDict[key]?.message || enDict[key]?.message || key;
};

/** Every message resolved for one language, plus the Video.js locale marker. */
export const buildMessages = (lang: Language = 'auto'): Record<string, string> => ({
  ...Object.fromEntries(messageKeys.map((key) => [key, getMessage(key, undefined, lang)])),
  videoJsLocale: isRussian(lang) ? 'ru' : 'en',
});

/** A translate function bound to one language. Used where no catalog exists. */
export const createTranslate = (lang: Language = 'auto'): Translate =>
  (key, substitutions) => getMessage(key, substitutions, lang);
