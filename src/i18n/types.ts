export type Locale = 'en' | 'fr' | 'pt';

export type TranslationValue = string | TranslationTree;

export interface TranslationTree {
  [key: string]: TranslationValue;
}
