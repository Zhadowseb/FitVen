import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AccentThemes,
  DEFAULT_ACCENT_THEME,
  applyAccentTheme,
} from "../Resources/GlobalStyling/colors";

const THEME_PREFERENCE_STORAGE_KEY = "fitapp.theme-preference";
const ACCENT_THEME_STORAGE_KEY = "fitapp.accent-theme";
const THEME_MODES = ["dark", "light", "auto"];

const ThemeModeContext = createContext({
  themeMode: "auto",
  setThemeMode: () => {},
  accentTheme: DEFAULT_ACCENT_THEME,
  setAccentTheme: () => {},
});

function normalizeThemeMode(mode) {
  return THEME_MODES.includes(mode) ? mode : "auto";
}

function normalizeAccentTheme(accentKey) {
  return AccentThemes[accentKey] ? accentKey : DEFAULT_ACCENT_THEME;
}

// "auto" clears the override so useColorScheme() follows the OS again.
function applyThemeMode(mode) {
  Appearance.setColorScheme(mode === "auto" ? null : mode);
}

export function ThemeModeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState("auto");
  const [accentTheme, setAccentThemeState] = useState(DEFAULT_ACCENT_THEME);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [storedMode, storedAccent] = await Promise.all([
          AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_THEME_STORAGE_KEY),
        ]);
        const mode = normalizeThemeMode(storedMode);
        const accent = normalizeAccentTheme(storedAccent);

        // Mutate the palettes before the state update so every component
        // rendered by the resulting re-render reads the new accent.
        applyAccentTheme(accent);
        applyThemeMode(mode);

        if (isMounted) {
          setThemeModeState(mode);
          setAccentThemeState(accent);
        }
      } catch (error) {
        console.error("Failed to load the theme preference:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    const nextMode = normalizeThemeMode(mode);

    setThemeModeState(nextMode);
    applyThemeMode(nextMode);

    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextMode);
    } catch (error) {
      console.error("Failed to save the theme preference:", error);
    }
  }, []);

  const setAccentTheme = useCallback(async (accentKey) => {
    const nextAccent = normalizeAccentTheme(accentKey);

    applyAccentTheme(nextAccent);
    setAccentThemeState(nextAccent);

    try {
      await AsyncStorage.setItem(ACCENT_THEME_STORAGE_KEY, nextAccent);
    } catch (error) {
      console.error("Failed to save the accent theme:", error);
    }
  }, []);

  const value = useMemo(
    () => ({ themeMode, setThemeMode, accentTheme, setAccentTheme }),
    [themeMode, setThemeMode, accentTheme, setAccentTheme]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
