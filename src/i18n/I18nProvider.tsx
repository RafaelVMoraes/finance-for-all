import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { pt } from './locales/pt';
import { Locale, TranslationTree, TranslationValue } from './types';

const STORAGE_KEY = 'fintrack_locale';

const translations: Record<Locale, TranslationTree> = { en, fr, pt };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const getByPath = (obj: TranslationTree, path: string): TranslationValue | undefined =>
  path.split('.').reduce<TranslationValue | undefined>((current, part) => {
    if (!current || typeof current === 'string') return undefined;
    return current[part];
  }, obj);

const interpolate = (template: string, params?: Record<string, string | number>) => {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
    template,
  );
};

const getInitialLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && stored in translations) return stored;
  const browserLanguage = navigator.language.slice(0, 2) as Locale;
  return browserLanguage in translations ? browserLanguage : 'en';
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    const current = getByPath(translations[locale], key);
    const fallback = getByPath(translations.en, key);
    const value = typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : key;
    return interpolate(value, params);
  };

  const contextValue = useMemo(() => ({ locale, setLocale, t }), [locale]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}
