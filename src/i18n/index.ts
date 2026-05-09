import { createIntl, createIntlCache, IntlShape } from 'react-intl';
import { LS } from '../utils/storage';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';

export type SupportedLocale = 'en' | 'es' | 'fr';

export const SUPPORTED_LOCALES: Array<{ id: SupportedLocale; label: string; flag: string }> = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
];

const MESSAGES: Record<SupportedLocale, Record<string, string>> = { en, es, fr };

const LS_KEY = 'nl-locale';

export function getStoredLocale(): SupportedLocale {
  const stored = LS.get<string>(LS_KEY);
  if (stored && stored in MESSAGES) return stored as SupportedLocale;
  const browser = navigator.language?.slice(0, 2) as SupportedLocale;
  return browser in MESSAGES ? browser : 'en';
}

export function setStoredLocale(locale: SupportedLocale): void {
  LS.set(LS_KEY, locale);
}

const cache = createIntlCache();
let _intl: IntlShape | null = null;

export function getIntl(locale?: SupportedLocale): IntlShape {
  const l = locale || getStoredLocale();
  if (!_intl || _intl.locale !== l) {
    _intl = createIntl({ locale: l, messages: MESSAGES[l] }, cache);
  }
  return _intl;
}

export function t(id: string, values?: Record<string, string | number>): string {
  return getIntl().formatMessage({ id }, values);
}

export { en, es, fr };
