### Changed
- **The label on a primary button reads in every accent theme.** Three of the eight theme and scheme pairs drew it under the 4.5:1 WCAG AA asks of text. Only the ink changed (`ink` and `textInverted` in `AccentThemes`), never a primary, so the fills, `primaryText` and the tints look exactly as they did:
  - **Ultraviolet dark**: 3.06:1 → 5.68:1. Its purple is too light for a white label, so the ink is a deep violet, `#110D26` - dark, as it is in the other themes' dark schemes.
  - **Ultraviolet light**: 4.33:1 → 4.72:1. White instead of the lavender-tinted `#F5F4FF`.
  - **Coral light**: 4.26:1 → 4.71:1. `#120404` instead of `#2A0C0C`; Coral dark keeps its ink, at 7.19:1.
- `scripts/test-accent-contrast.js` measures every accent theme in both schemes, as `applyAccentTheme` leaves the palette: the ink on `primary`, and `primaryText` on the card and the background, all at 4.5:1 or more.
