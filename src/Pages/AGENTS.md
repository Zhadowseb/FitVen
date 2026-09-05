# AGENTS.md

## Scope

This file applies to `src/Pages` and all descendant folders.

## UI Guidance

- Inspect the page component, its style file, and its local components together before editing.
- Reuse themed components and shared design tokens from `src/Resources` before adding new primitives.
- Keep page-specific components inside the relevant page folder unless they are reused across multiple screens.
- Preserve the established navigation, naming, and spacing patterns near the touched screen.
- Make mobile-first changes and avoid layouts that depend on one exact device width.

## Theming

- Look the theme up in the component body, never in `StyleSheet.create`:
  `const colorScheme = useColorScheme(); const theme = Colors[colorScheme] ?? Colors.light;`
- A `*Style.js` file holds layout only. Colours are applied inline:
  `style={[styles.card, { backgroundColor: theme.cardBackground }]}`.
- The reason is not style: `applyAccentTheme()` mutates the `Colors` object in
  place when the user picks an accent, while `StyleSheet.create` is evaluated
  once at import. A colour written into a style sheet freezes at whatever the
  palette was when the app started, and stops following light/dark and accent.
- The exceptions are `shadowColor: "#000"`, which is what a shadow is, and
  white text over a photograph, which has to look the same either way.
- The accent has two tokens: `primary` for fills, `primaryText` for text and
  icons. No single colour clears 4.5:1 both as text on white and as a
  background under dark ink.

## Behavior Guidance

- Keep data loading and mutations in services or repositories when that pattern already exists.
- For user-facing flows, account for loading, empty, and error states when behavior changes.
- When editing a nested screen tree, check the immediate parent and child components for side effects before finishing.
