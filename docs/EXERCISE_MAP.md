# Exercise Map

Open Train → Exercise Map, immediately below Exercise Library. This is a native React Native screen, with react-native-svg rendering and a virtualized exercise list. It reads the same catalog service as Exercise Library, including custom exercises. No new dependency, database field, migration or write action is introduced.

Search by exercise name or nickname. Select an exercise to highlight its primary and secondary body-map regions; tap a region to find matching exercises. Multiple selected regions use AND by default, with an option for OR and a primary-only filter. Small muscles can also be selected using the labelled buttons. Front, back, both, upper/lower crops and surface/contour styles are available. The screen follows the app's appearance and accent preferences.

Missing muscle metadata stays missing: an exercise is searchable but will not match a selected muscle without metadata. Colours indicate categorical roles rather than measured percentages. Loading, load failure/retry, an empty library and no matching results have explicit states.

The local bodyData.json derives from the standalone prototype. Its upper_traps key is retained for catalog compatibility, but the back contour includes the full trapezius group. This does not claim that an exercise equally activates every subdivision. Existing BodyMapPreview assets/overlays remain unchanged. More granular subdivision data needs a separate design and data decision.

Validation: npm run test:exercise-map checks catalog adaptation and filter behaviour; npm test includes it. Use Expo Android/iOS export to validate native bundling. Device rendering, taps, navigation back to Train, theme changes and performance still require an on-device test.
