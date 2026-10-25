// The app's translations, without a native module.
//
// Seven languages - English, Danish, Swedish, Norwegian (Bokmål), German,
// French and Spanish - in plain JS objects under ./locales. A key is a dotted
// path ("gyms.changeCentre"); a value is a string with {placeholders}, or an
// object with `one` / `other` (and optionally `zero`) picked by `count`. A
// key missing in a language falls back to English, and a key missing in both
// comes back as the key itself with a warning in development, so a typo shows
// on screen instead of as an empty label. A language is added by a folder under
// ./locales, its entry here, and a row in the profile page's language list;
// scripts/test-localization.js holds every language to English's keys.
//
// The current language is module state, so a service can translate an error
// message without a React tree. Components go through
// LocalizationContext.js, which re-renders them when the language changes;
// this file only tells its subscribers.
//
// Why not expo-localization: it is a native module, and adding one means a
// new development build before anything can be tried. The device language is
// readable from what React Native already ships (see detectSystemLanguage).
import { I18nManager, NativeModules } from "react-native";

import en from "./locales/en";
import da from "./locales/da";
import sv from "./locales/sv";
import nb from "./locales/nb";
import de from "./locales/de";
import fr from "./locales/fr";
import es from "./locales/es";

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "da", "sv", "nb", "de", "fr", "es"];
export const LANGUAGE_MODES = ["system", ...SUPPORTED_LANGUAGES];

const LOCALES = { en, da, sv, nb, de, fr, es };
// What the Intl formatters get. British English puts the day before the month
// like Danish does, which is what a Danish user reading English expects.
const LOCALE_TAGS = {
  en: "en-GB",
  da: "da-DK",
  sv: "sv-SE",
  nb: "nb-NO",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
};
// Norwegian has two written forms and a phone can say any of three codes; the
// app has Bokmål, which is what almost everybody reads.
const LANGUAGE_ALIASES = { no: "nb", nn: "nb" };

let currentLanguage = DEFAULT_LANGUAGE;
const listeners = new Set();

function normalizeLanguage(language) {
  const raw = String(language ?? "")
    .toLowerCase()
    .split(/[-_]/)[0];
  const code = LANGUAGE_ALIASES[raw] ?? raw;

  return SUPPORTED_LANGUAGES.includes(code) ? code : null;
}

/**
 * The device language, as a supported code, or English. Read from the JS
 * runtime's Intl first, then the two native constants React Native exposes.
 */
export function detectSystemLanguage() {
  const candidates = [];

  try {
    candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    // Older Hermes builds without Intl: fall through to the native constants.
  }

  try {
    candidates.push(I18nManager.getConstants?.().localeIdentifier);
  } catch {
    // Not on this platform.
  }

  try {
    const appleSettings = NativeModules?.SettingsManager?.settings;

    if (appleSettings) {
      candidates.push(appleSettings.AppleLocale, appleSettings.AppleLanguages?.[0]);
    }
  } catch {
    // Not on this platform either.
  }

  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate);

    if (language) {
      return language;
    }
  }

  return DEFAULT_LANGUAGE;
}

/** "system" follows the device; a language code is that language. */
export function resolveLanguage(mode) {
  if (mode === "system" || mode === null || mode === undefined) {
    return detectSystemLanguage();
  }

  return normalizeLanguage(mode) ?? detectSystemLanguage();
}

export function getLanguage() {
  return currentLanguage;
}

export function getLocaleTag(language = currentLanguage) {
  return LOCALE_TAGS[language] ?? LOCALE_TAGS[DEFAULT_LANGUAGE];
}

export function setLanguage(language) {
  const next = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;

  if (next === currentLanguage) {
    return next;
  }

  currentLanguage = next;

  for (const listener of listeners) {
    try {
      listener(next);
    } catch (error) {
      console.warn("Language listener failed:", error);
    }
  }

  return next;
}

export function subscribeToLanguage(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function lookup(table, key) {
  return String(key)
    .split(".")
    .reduce(
      (node, part) => (node !== null && typeof node === "object" ? node[part] : undefined),
      table
    );
}

function interpolate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined || params[name] === null ? match : String(params[name])
  );
}

// One is 1 in every language here but French, where 0 and 1.5 are singular too
// ("0 série", "1,5 kilo"): `one` for anything under 2.
function pickPluralForm(forms, count, language) {
  const numeric = Number(count);

  if (numeric === 0 && forms.zero !== undefined) {
    return forms.zero;
  }

  const isOne = language === "fr" ? Math.abs(numeric) < 2 : Math.abs(numeric) === 1;

  if (isOne && forms.one !== undefined) {
    return forms.one;
  }

  return forms.other ?? forms.one ?? null;
}

/**
 * translate("gyms.membersTrainHere", { count: 3 }) -> "3 people train here".
 * The third argument pins a language; components leave it out and get the
 * current one.
 */
export function translate(key, params = {}, language = currentLanguage) {
  let value = lookup(LOCALES[language] ?? LOCALES[DEFAULT_LANGUAGE], key);

  if (value === undefined && language !== DEFAULT_LANGUAGE) {
    value = lookup(LOCALES[DEFAULT_LANGUAGE], key);
  }

  if (value !== null && typeof value === "object") {
    value = pickPluralForm(value, params.count, language);
  }

  if (value === undefined || value === null) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(`Missing translation for "${key}"`);
    }

    return String(key);
  }

  return interpolate(value, params);
}

export const t = translate;

/** True when the key exists in the given language, for the parity test. */
export function hasTranslation(key, language = currentLanguage) {
  return lookup(LOCALES[language], key) !== undefined;
}

export function getLocaleTable(language) {
  return LOCALES[language];
}

/* ------------------------------------------------------------ formatting -- */

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = { day: "numeric", month: "short" }) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  try {
    return date.toLocaleDateString(getLocaleTag(), options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

export function formatTime(value, options = { hour: "2-digit", minute: "2-digit" }) {
  const date = toDate(value);

  if (!date) {
    return "";
  }

  try {
    return date.toLocaleTimeString(getLocaleTag(), options);
  } catch {
    return date.toLocaleTimeString(undefined, options);
  }
}

export function formatNumber(value, options = {}) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "";
  }

  try {
    return numeric.toLocaleString(getLocaleTag(), options);
  } catch {
    return String(numeric);
  }
}
