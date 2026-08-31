import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEn from './en/translation.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: translationEn },
} as const;

type TranslationResource = Record<string, string>;

type LocaleLoader = () => Promise<{ default: TranslationResource }>;

type LocaleLoaderEntry = {
  language: string;
  loader: LocaleLoader;
};

const localeLoaders = new Map<string, LocaleLoader>([
  ['ar', () => import('./ar/translation.json')],
  ['bo', () => import('./bo/translation.json')],
  ['bs', () => import('./bs/translation.json')],
  ['ca', () => import('./ca/translation.json')],
  ['cs', () => import('./cs/translation.json')],
  ['da', () => import('./da/translation.json')],
  ['de', () => import('./de/translation.json')],
  ['es', () => import('./es/translation.json')],
  ['et', () => import('./et/translation.json')],
  ['fa', () => import('./fa/translation.json')],
  ['fi', () => import('./fi/translation.json')],
  ['fr', () => import('./fr/translation.json')],
  ['he', () => import('./he/translation.json')],
  ['hu', () => import('./hu/translation.json')],
  ['hy', () => import('./hy/translation.json')],
  ['id', () => import('./id/translation.json')],
  ['is', () => import('./is/translation.json')],
  ['it', () => import('./it/translation.json')],
  ['ja', () => import('./ja/translation.json')],
  ['ka', () => import('./ka/translation.json')],
  ['ko', () => import('./ko/translation.json')],
  ['lt', () => import('./lt/translation.json')],
  ['lv', () => import('./lv/translation.json')],
  ['nb', () => import('./nb/translation.json')],
  ['nl', () => import('./nl/translation.json')],
  ['nn', () => import('./nn/translation.json')],
  ['pl', () => import('./pl/translation.json')],
  ['pt-BR', () => import('./pt-BR/translation.json')],
  ['pt-PT', () => import('./pt-PT/translation.json')],
  ['ru', () => import('./ru/translation.json')],
  ['sk', () => import('./sk/translation.json')],
  ['sl', () => import('./sl/translation.json')],
  ['sv', () => import('./sv/translation.json')],
  ['th', () => import('./th/translation.json')],
  ['tr', () => import('./tr/translation.json')],
  ['ug', () => import('./ug/translation.json')],
  ['uk', () => import('./uk/translation.json')],
  ['vi', () => import('./vi/translation.json')],
  ['zh-Hans', () => import('./zh-Hans/translation.json')],
  ['zh-Hant', () => import('./zh-Hant/translation.json')],
]);

const localeLoaderEntries = new Map<string, LocaleLoaderEntry>(
  Array.from(localeLoaders, ([language, loader]) => [language.toLowerCase(), { language, loader }]),
);

const localeAliases = new Map<string, string>([
  ['zh-tw', 'zh-Hant'],
  ['zh-hk', 'zh-Hant'],
  ['zh', 'zh-Hans'],
]);

const localeLoadPromises = new Map<string, Promise<void>>();

const getLocaleLoader = (language: string) => {
  const normalizedLanguage = language.replace('_', '-');
  const baseLanguage = normalizedLanguage.split('-')[0];
  const candidates = [
    normalizedLanguage,
    localeAliases.get(normalizedLanguage.toLowerCase()),
    baseLanguage,
    localeAliases.get(baseLanguage.toLowerCase()),
  ];

  const localeLanguage = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && localeLoaderEntries.has(candidate.toLowerCase()),
  );

  return localeLanguage ? localeLoaderEntries.get(localeLanguage.toLowerCase()) : undefined;
};

export const isLanguageLoaded = (language: string) => {
  const localeLoader = getLocaleLoader(language);
  return !localeLoader || i18n.hasResourceBundle(localeLoader.language, defaultNS);
};

export const loadLanguage = async (language: string) => {
  const localeLoader = getLocaleLoader(language);
  if (!localeLoader || i18n.hasResourceBundle(localeLoader.language, defaultNS)) {
    return;
  }

  const activeLoad = localeLoadPromises.get(localeLoader.language);
  if (activeLoad) {
    return activeLoad;
  }

  const loadPromise = localeLoader
    .loader()
    .then(({ default: translation }) => {
      i18n.addResourceBundle(localeLoader.language, defaultNS, translation, true, true);
    })
    .catch(() => {
      console.error(`Unable to load ${localeLoader.language} translations`);
    })
    .finally(() => {
      localeLoadPromises.delete(localeLoader.language);
    });

  localeLoadPromises.set(localeLoader.language, loadPromise);
  return loadPromise;
};

export const changeLanguage = async (language: string) => {
  await loadLanguage(language);
  return i18n.changeLanguage(language);
};

const i18nInitialization = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      'zh-TW': ['zh-Hant', 'en'],
      'zh-HK': ['zh-Hant', 'en'],
      zh: ['zh-Hans', 'en'],
      default: ['en'],
    },
    fallbackNS: 'translation',
    ns: ['translation'],
    debug: false,
    defaultNS,
    resources,
    interpolation: { escapeValue: false },
  });

export const initializeI18n = async () => {
  await i18nInitialization;
  await changeLanguage(i18n.language);
};

export default i18n;
