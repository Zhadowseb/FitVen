### Fixed
Found while taking the Play Store screenshots on 2026-10-04.
- **The start sheet follows the accent you pick.** With Ultraviolet chosen, "SUGGESTED" and the "2x" chip still came out Coral, the accent the app had started with. The sheet built its styles in a `useMemo` keyed on `theme`, which is the same object whatever the accent, since `applyAccentTheme()` changes it in place. The accent is a dependency now, here and in the exercise filter sheet, which had the same memo.
- **"SUGGESTED" no longer runs into the date.** On a repeat row it sat beside the title and covered "27.09.2026", because the title column is only about 134 dp wide on a 360 dp phone. The badge has its own line above the title now.
- **The consent screen speaks of runs the way the privacy policy does:** runs tracked with an earlier version of FitVen, since FitVen no longer tracks runs (2.17.4).
