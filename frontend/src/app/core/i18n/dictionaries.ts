import { EN } from './en-dictionary';
import { RO } from './ro-dictionary';

export type Lang = 'en' | 'ro';

export interface Dictionary {
  readonly [key: string]: string;
}

export const DICTIONARIES: Record<Lang, Dictionary> = {
  en: EN,
  ro: RO,
};

export const LANGUAGES: readonly { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ro', label: 'Romanian', native: 'Română' },
];
