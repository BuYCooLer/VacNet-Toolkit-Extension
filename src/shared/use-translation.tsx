import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { MessageCatalog, MessageKey, Translate } from './i18n';

const TranslationContext = createContext<MessageCatalog | null>(null);

interface TranslationProviderProps {
  catalog: MessageCatalog;
  children: ComponentChildren;
}

export const TranslationProvider = ({ catalog, children }: TranslationProviderProps) => (
  <TranslationContext.Provider value={catalog}>{children}</TranslationContext.Provider>
);

const interpolate = (message: string, substitutions?: string | string[]): string => {
  if (substitutions === undefined) return message;
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  let valueIndex = 0;
  return message.replace(/\{[^{}]+\}/gu, (placeholder) => {
    const value = values[valueIndex];
    valueIndex += 1;
    return value ?? placeholder;
  });
};

export const useTranslation = (): Translate => {
  const catalog = useContext(TranslationContext);
  if (!catalog) throw new Error('useTranslation must be used inside TranslationProvider.');
  return (key: MessageKey, substitutions?: string | string[]) =>
    interpolate(catalog[key], substitutions);
};
