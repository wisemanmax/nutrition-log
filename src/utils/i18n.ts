import en from '../locales/en.json';

type LocaleDict = Record<string, string>;
const locales: Record<string, LocaleDict> = { en };
let currentLocale = 'en';

export const i18n = {
  t(key: string, vars?: Record<string, string | number>): string {
    const dict = locales[currentLocale] ?? locales['en'];
    let text: string = (dict as LocaleDict)[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  },

  setLocale(locale: string): void {
    if (locales[locale]) currentLocale = locale;
  },

  getLocale(): string {
    return currentLocale;
  },

  addLocale(locale: string, dict: LocaleDict): void {
    locales[locale] = dict;
  },

  getSupportedLocales(): string[] {
    return Object.keys(locales);
  },
};
