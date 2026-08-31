import { useCallback, useEffect } from 'react';
import type { TOptions } from 'i18next';
import { useRecoilValue } from 'recoil';
import { useTranslation } from 'react-i18next';
import { changeLanguage, isLanguageLoaded, resources } from '~/locales/i18n';
import store from '~/store';

export type TranslationKeys = keyof typeof resources.en.translation;

export default function useLocalize() {
  const lang = useRecoilValue(store.lang);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== lang || !isLanguageLoaded(lang)) {
      void changeLanguage(lang);
    }
  }, [lang, i18n]);

  return useCallback(
    (phraseKey: TranslationKeys, options?: TOptions) => t(phraseKey, options),
    [t],
  );
}
