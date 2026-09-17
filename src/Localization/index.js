// import { useTranslation } from "@localization"      in a component
// import { t } from "@localization"                   anywhere else
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_MODES,
  SUPPORTED_LANGUAGES,
  detectSystemLanguage,
  formatDate,
  formatNumber,
  formatTime,
  getLanguage,
  getLocaleTag,
  resolveLanguage,
  setLanguage,
  subscribeToLanguage,
  t,
  translate,
} from "./i18n";
export { LocalizationProvider, useTranslation } from "./LocalizationContext";
