import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  LANGUAGE_MODES,
  getLanguage,
  getLocaleTag,
  resolveLanguage,
  setLanguage,
  subscribeToLanguage,
  translate,
} from "./i18n";

// Same shape as the theme preference in Contexts/ThemeContext.js: a mode the
// user picked ("system", "en", "da") stored on the device, resolved to a
// language at start and whenever it changes.
const LANGUAGE_MODE_STORAGE_KEY = "fitapp.language-mode";

const LocalizationContext = createContext({
  language: getLanguage(),
  languageMode: "system",
  locale: getLocaleTag(),
  isLanguageLoading: true,
  setLanguageMode: () => {},
  t: translate,
});

function normalizeLanguageMode(mode) {
  return LANGUAGE_MODES.includes(mode) ? mode : "system";
}

export function LocalizationProvider({ children }) {
  const [languageMode, setLanguageModeState] = useState("system");
  const [language, setLanguageState] = useState(() => getLanguage());
  // App.js waits on this the way it waits on the theme, so the first screen
  // is not painted in English and repainted in Danish a tick later.
  const [isLanguageLoading, setIsLanguageLoading] = useState(true);

  useEffect(() => subscribeToLanguage(setLanguageState), []);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      let mode = "system";

      try {
        mode = normalizeLanguageMode(await AsyncStorage.getItem(LANGUAGE_MODE_STORAGE_KEY));
      } catch (error) {
        console.error("Failed to load the language preference:", error);
      }

      const resolved = setLanguage(resolveLanguage(mode));

      if (isMounted) {
        setLanguageModeState(mode);
        setLanguageState(resolved);
        setIsLanguageLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguageMode = useCallback(async (mode) => {
    const nextMode = normalizeLanguageMode(mode);

    setLanguageModeState(nextMode);
    setLanguageState(setLanguage(resolveLanguage(nextMode)));

    try {
      await AsyncStorage.setItem(LANGUAGE_MODE_STORAGE_KEY, nextMode);
    } catch (error) {
      console.error("Failed to save the language preference:", error);
    }
  }, []);

  const value = useMemo(
    () => ({
      language,
      languageMode,
      locale: getLocaleTag(language),
      isLanguageLoading,
      setLanguageMode,
      // Bound to the language in state, so a component that calls t() during
      // render re-renders with the new language when the state changes.
      t: (key, params) => translate(key, params, language),
    }),
    [isLanguageLoading, language, languageMode, setLanguageMode]
  );

  return (
    <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
  );
}

/**
 * const { t, language } = useTranslation();
 * Components use this rather than importing t from i18n.js, so they follow a
 * language change while mounted.
 */
export function useTranslation() {
  return useContext(LocalizationContext);
}
