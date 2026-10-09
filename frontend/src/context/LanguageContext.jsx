import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TRANSLATIONS, SUPPORTED_LANGUAGES } from '../i18n/translations';

export const LanguageContext = createContext(null);

const STORAGE_KEY = 'solarmind_preferred_language';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'hi' || saved === 'or')) {
        return saved;
      }
      // Check browser navigator language
      const browserLang = navigator.language ? navigator.language.split('-')[0].toLowerCase() : 'en';
      if (browserLang === 'hi') return 'hi';
      if (browserLang === 'or' || browserLang === 'od') return 'or';
    } catch {
      // Fallback for environments where localStorage / navigator is restricted
    }
    return 'en';
  });

  const setLanguage = useCallback((newLang) => {
    if (newLang !== 'en' && newLang !== 'hi' && newLang !== 'or') {
      newLang = 'en';
    }
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // Ignore storage errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
      document.documentElement.setAttribute('data-language', newLang);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.setAttribute('data-language', language);
    }
  }, [language]);

  /**
   * Helper translation lookup: t('dashboard.currentPower') or t('forms.passwordTooShort')
   */
  const t = useCallback(
    (path, paramsOrFallback, maybeParams) => {
      if (!path) return '';

      let fallback = typeof paramsOrFallback === 'string' ? paramsOrFallback : null;
      let params = typeof paramsOrFallback === 'object' && paramsOrFallback !== null ? paramsOrFallback : maybeParams || {};

      const keys = path.split('.');

      const getNested = (obj) => {
        let curr = obj;
        for (const k of keys) {
          if (curr && typeof curr === 'object' && k in curr) {
            curr = curr[k];
          } else {
            return undefined;
          }
        }
        return typeof curr === 'string' ? curr : undefined;
      };

      // 1. Try active language
      let result = getNested(TRANSLATIONS[language]);

      // 2. Fallback to English
      if (result === undefined && language !== 'en') {
        result = getNested(TRANSLATIONS.en);
      }

      // 3. Fallback to provided fallback string or path key
      if (result === undefined) {
        result = fallback !== null ? fallback : keys[keys.length - 1];
      }

      // 4. Parameter substitution if any (e.g. {{name}})
      if (result && params && typeof params === 'object') {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramVal));
        });
      }

      return result;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
        isRtl: false,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback for components rendered outside of provider in isolated tests
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key, fallback) => (typeof fallback === 'string' ? fallback : key.split('.').pop()),
      supportedLanguages: SUPPORTED_LANGUAGES,
      isRtl: false,
    };
  }
  return context;
};

export default LanguageProvider;
