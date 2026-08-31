import i18n, { changeLanguage, initializeI18n, isLanguageLoaded } from './i18n';
import English from './en/translation.json';
import French from './fr/translation.json';
import Spanish from './es/translation.json';
import TraditionalChinese from './zh-Hant/translation.json';
import { TranslationKeys } from '~/hooks';

describe('i18next translation tests', () => {
  // Ensure i18next is initialized before any tests run
  beforeAll(async () => {
    await initializeI18n();
  });

  it('should return the correct translation for a valid key in English', async () => {
    await changeLanguage('en');
    expect(i18n.t('com_ui_examples')).toBe(English.com_ui_examples);
  });

  it('should load and return the correct translation for a valid key in French', async () => {
    i18n.removeResourceBundle('fr', 'translation');
    expect(isLanguageLoaded('fr')).toBe(false);
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(false);

    await changeLanguage('fr');

    expect(isLanguageLoaded('fr')).toBe(true);
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(true);
    expect(i18n.t('com_ui_examples')).toBe(French.com_ui_examples);
  });

  it('should load and return the correct translation for a valid key in Spanish', async () => {
    await changeLanguage('es');
    expect(i18n.t('com_ui_examples')).toBe(Spanish.com_ui_examples);
  });

  it('should load Traditional Chinese for the zh-TW fallback', async () => {
    i18n.removeResourceBundle('zh-Hant', 'translation');

    await changeLanguage('zh-TW');

    expect(i18n.hasResourceBundle('zh-Hant', 'translation')).toBe(true);
    expect(i18n.t('com_ui_examples')).toBe(TraditionalChinese.com_ui_examples);
  });

  it('should fallback to English for an invalid language code', async () => {
    // When an invalid language is provided, i18next should fallback to English
    await changeLanguage('invalid-code');
    expect(i18n.t('com_ui_examples')).toBe(English.com_ui_examples);
  });

  it('should return the key itself for an invalid key', async () => {
    await changeLanguage('en');
    expect(i18n.t('invalid-key' as TranslationKeys)).toBe('invalid-key'); // Returns the key itself
  });

  it('should correctly format placeholders in the translation', async () => {
    await changeLanguage('en');
    expect(i18n.t('com_endpoint_default_with_num', { 0: 'John' })).toBe('default: John');

    await changeLanguage('fr');
    expect(i18n.t('com_endpoint_default_with_num', { 0: 'Marie' })).toBe('par défaut : Marie');
  });
});
