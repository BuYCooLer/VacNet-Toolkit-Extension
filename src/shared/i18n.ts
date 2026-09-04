import { z } from 'zod';
import { messageKeys, type MessageKey, buildMessages, type Language } from './messages';

export {
  messageKeys,
  getMessage,
  createTranslate,
  isRussian,
  type MessageKey,
  type Language,
  type Translate,
} from './messages';

const catalogShape = Object.fromEntries(
  messageKeys.map((key) => [key, z.string().min(1)]),
) as Record<MessageKey, z.ZodString>;

export const MessageCatalogSchema = z.strictObject({
  ...catalogShape,
  videoJsLocale: z.enum(['ru', 'en']),
});

export type MessageCatalog = z.infer<typeof MessageCatalogSchema>;

export const createCatalog = (lang: Language = 'auto'): MessageCatalog =>
  MessageCatalogSchema.parse(buildMessages(lang));
