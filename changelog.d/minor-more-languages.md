### Added
- **Five more languages: Swedish, Norwegian (Bokmål), German, French and Spanish.** Pick one under Profile → Language, or leave it on System: a phone set to any of them now opens the app in it (a phone in Norwegian - Bokmål, Nynorsk or "no" - gets Bokmål). Dates, times and numbers follow the language (`sv-SE`, `nb-NO`, `de-DE`, `fr-FR`, `es-ES`). A text that is not translated yet shows in English, one key at a time, as Danish always has.
- **French counts 0 as singular** ("0 série", like "1 série"), the one place its plural differs from the others.
- **The test holds every started language to English:** the same keys, the same `{placeholders}`, plural forms where English has them (`scripts/test-localization.js`). A language is either not started (an empty table, all English) or complete.
- **Not translated, on purpose:** the privacy policy and terms (a new version has to be accepted again by everybody), exercise names, push notifications from the server and the store texts. The word to type to delete an account is still `DELETE` in every language.
- **Knowledge articles** have the five languages beside English and Danish; the article test requires the same bullets, sections and zone notes in each.

### Fixed
- **`scripts/test-watch-walks.js` no longer depends on today's date.** It used a fixed "now" for most of the test but the real clock for "Allow", so the 14-day window drifted away from its walks and "2 walks found" became 1 on 24 October. `enableWatchWalks` takes a clock like `refreshPendingWatchWalks` does, and the test passes its own.
