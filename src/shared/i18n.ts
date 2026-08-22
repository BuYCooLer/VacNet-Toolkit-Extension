import { z } from 'zod';
import { browser } from 'wxt/browser';
import { messageKeys, type MessageKey } from './generated-message-keys';

export { messageKeys, type MessageKey } from './generated-message-keys';

const catalogShape = Object.fromEntries(
  messageKeys.map((key) => [key, z.string().min(1)]),
) as Record<MessageKey, z.ZodString>;

export const MessageCatalogSchema = z.strictObject({
  ...catalogShape,
  videoJsLocale: z.enum(['ru', 'en']),
});

export type MessageCatalog = z.infer<typeof MessageCatalogSchema>;

export type Translate = (key: MessageKey, substitutions?: string | string[]) => string;

export const getMessage: Translate = (key, substitutions) => {
  const message = browser.i18n.getMessage(key, substitutions);
  if (!message) throw new Error(`Missing browser translation: ${key}`);
  return message;
};

export const createCatalog = (): MessageCatalog => MessageCatalogSchema.parse({
  ...Object.fromEntries(messageKeys.map((key) => [key, getMessage(key)])),
  videoJsLocale: browser.i18n.getUILanguage().toLowerCase().startsWith('ru') ? 'ru' : 'en',
});
