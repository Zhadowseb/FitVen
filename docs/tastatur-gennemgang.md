# Teknisk rapport: tastaturhåndtering på mobil (FitVen)

Ekstern gennemgang. Kun læsning — ingen kode er ændret.
Dato: 2026-08-31. Kodebase: `C:\Users\sebas\Desktop\FitVen\FitVen`, app-version 0.19.1.

---

## Executive summary

Problemet er **ét gennemgående mønster**, ikke spredte fejl. Appen har en fælles wrapper
(`ThemedKeyboardProtection`), men den bruges kun på **6 af 27 skærme**, og på **Android er den
reelt uden effekt**: den sætter `behavior={undefined}` på `KeyboardAvoidingView` (som dermed
renderer en almindelig `View`), den bruger `automaticallyAdjustKeyboardInsets` (iOS-only), og
dens auto-scroll-beregning bygger på `endCoordinates.screenY`, som er ubrugelig på Android under
edge-to-edge. Samtidig er `android.softwareKeyboardLayoutMode: "resize"` sat sammen med
`edgeToEdgeEnabled: true` — en kendt konflikt, hvor `adjustResize` ikke længere resizer vinduet.
**Ingen** modal, bottom sheet eller pop-up i appen har nogen form for tastaturhåndtering, og
netop dér ligger de værste felter (fritekst-noter som sidste element, med Gem-knap under sig).
Anbefalet løsning: indfør `react-native-keyboard-controller` som fælles fundament, omskriv
`ThemedKeyboardProtection` til at bruge det, lav en ny `ThemedKeyboardSheet`-variant til modaler
og bottom sheets, og rul den ud på alle 43 aktive felter. Global konfiguration rettes først.

---

## Del 1 — Grundlag

### 1.1 Stak

| Punkt | Værdi | Konsekvens |
|---|---|---|
| Framework | React Native **0.81.5** via **Expo SDK ~54.0.25** | Ren native app, ingen web/hybrid. Web-emner (viewport-meta, `interactive-widget`) er irrelevante. |
| React | 19.1.0 | — |
| Ny arkitektur | `newArchEnabled: true` (app.json + `android/gradle.properties:38`) | Fabric/TurboModules aktiv. Relevant for valg af tastaturbibliotek. |
| Navigation | `@react-navigation/native` 7.1.21 + `native-stack` 7.8.0 | Alle skærme er native-stack-skærme; headers er slået fra (`headerShown: false`) på alle undtagen `SetPage`. |
| Tastaturbibliotek | **Ingen** | Ingen `react-native-keyboard-controller`, ingen `react-native-keyboard-aware-scroll-view`. Alt er håndbygget. |
| Native iOS-projekt | Findes ikke i repo (managed prebuild) | Al iOS-konfiguration kommer fra `app.json`. |
| Native Android-projekt | `android/` er prebuildet og checket ind | Manifest kan læses direkte — se 1.2. |

### 1.2 Globale indstillinger

**Android**

| Indstilling | Faktisk værdi | Kilde | Betydning |
|---|---|---|---|
| `softwareKeyboardLayoutMode` | `"resize"` | `app.json:56` | Oversættes til `adjustResize` i manifestet. |
| `android:windowSoftInputMode` | `adjustResize` | `android/app/src/main/AndroidManifest.xml:37` | Vinduet *skal* krympe når tastaturet vises. |
| `edgeToEdgeEnabled` | `true` | `app.json:55` og `android/gradle.properties:47,65` | **Konflikten.** Under edge-to-edge sættes `decorFitsSystemWindows=false`, og `SOFT_INPUT_ADJUST_RESIZE` (deprecated fra API 30) har da ingen effekt. Vinduet krymper ikke; IME kommer kun ind som `WindowInsets.Type.ime()`, som appen ikke læser nogen steder. |
| `targetSdk` / `compileSdk` | Sættes af `expo-root-project`-pluginet (Expo SDK 54 ⇒ API 36) | `android/build.gradle:24` | API 35+ håndhæver edge-to-edge. Konflikten ovenfor er derfor aktiv på alle moderne enheder. |
| `android:configChanges` | `keyboard\|keyboardHidden\|orientation\|screenSize\|screenLayout\|uiMode` | Manifest:37 | Activity genskabes ikke ved tastaturændring — godt. |
| `android:screenOrientation` | `unspecified` | Manifest:37 | Men se 1.2.3: JS låser orientering. |
| Modal-vinduer | `SOFT_INPUT_ADJUST_RESIZE`, **ikke** edge-to-edge | `react-native/ReactAndroid/.../views/modal/ReactModalHostView.kt:327` | RN's `<Modal>` opretter et separat Dialog-vindue som **faktisk** resizer. Modaler opfører sig derfor anderledes end selve skærmen på Android. Vigtig asymmetri. |

**iOS**

| Indstilling | Faktisk værdi | Kilde | Betydning |
|---|---|---|---|
| `requireFullScreen` | `true` | `app.json:23` | Ingen iPad Slide Over/Split View ⇒ tastaturhøjde er forudsigelig. |
| `supportsTablet` | `true` | `app.json:22` | iPad skal med i testmatrix (floating keyboard på iPad kan give `screenY === 0`). |
| `userInterfaceStyle` | `"dark"` | `app.json:8` | Irrelevant for tastatur. |
| Keyboard-avoidance | Kun i JS | — | iOS resizer aldrig vinduet; **alt** afhænger af app-koden. |

**Orientering (begge platforme)**

`App.js:322-331` låser aktivt orienteringen: `PORTRAIT_UP` på alle ruter undtagen
`RUN_HEART_RATE_CHART_ROUTE` (som er `LANDSCAPE`). Den skærm (`RunHeartRateChartPage`) har
**ingen inputfelter**. **Konklusion: landskabsvisning er ikke et problem for noget inputfelt i
appen.** Det punkt i checklisten kan lukkes.

### 1.3 Findes der et fælles mønster?

Ja — men det er kun delvist udrullet, og det virker kun på iOS.

`src/Resources/ThemedComponents/ThemedKeyboardProtection.js` er en kombineret
provider + `KeyboardAvoidingView` + `ScrollView`. Den udstiller `requestScrollToInput(inputRef)`
via React context, som `ThemedTextInput` og `ThemedEditableCell` kalder i `onFocus`.

**Udrulning:**

| Mønster | Antal skærme | Skærme |
|---|---|---|
| `ThemedKeyboardProtection scroll` | **6** | `LoginPage`, `RegisterPage`, `ProfilePage`, `OneRepMaxCalculatorPage`, `Resistance` (WorkoutPage), `Run` (WorkoutPage — 2 steder: loading-state + hovedvisning) |
| Egen `KeyboardAvoidingView` | **1** | `SocialPostEditPage` |
| `keyboardShouldPersistTaps="handled"` uden anden håndtering | **5** | `NotificationSettingsPage`, `SearchPage` (har ingen felt), `SocialUserListPage`, `ExerciseSocialPostSettingsPage`, `CustomExerciseModal` (indre scroll, kun step 2) |
| **Ingen håndtering overhovedet** | **Alle modaler, alle bottom sheets, resten** | `ThemedModal`, `ThemedBottomSheet`, `ThemedWorkoutModal`, `ExerciseCatalogPage`, `ProgramOverviewPage`, `SetPage`, m.fl. |

**Fem konkrete defekter i den fælles wrapper (alle bekræftet i kode):**

1. **`behavior={Platform.OS === "ios" ? "padding" : undefined}`** (`ThemedKeyboardProtection.js:109`).
   RN's `KeyboardAvoidingView` med `behavior === undefined` rammer `default`-grenen og returnerer
   en ren `<View>` **uden nogen justering**
   (`node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js:286-295`).
   På Android gør wrapperen altså ingenting via KAV.
2. **`automaticallyAdjustKeyboardInsets`** (linje 121) er en iOS-only prop — no-op på Android.
3. **Auto-scroll er død på Android.** Linje 80-82 sætter `keyboardTopRef` til
   `event.endCoordinates.screenY`. På Android beregner RN `screenY` som
   `mVisibleViewArea.bottom` fra `getWindowVisibleDisplayFrame()`
   (`ReactRootView.java:906-913`). Fordi vinduet **ikke** krymper under edge-to-edge, er den værdi
   ≈ skærmens bund. `scrollToInput` (linje 53) finder derfor aldrig overlap og scroller aldrig.
   Fallbacken `windowHeight - endCoordinates.height`, som *ville* være korrekt, nås aldrig, fordi
   `screenY` altid er sat (`??` er ikke `||`).
4. **`keyboardVerticalOffset` er 0 alle 7 steder.** RN's KAV måler sin egen ramme med `onLayout`,
   som giver koordinater **relativt til forælderen**, ikke til skærmen. På skærme hvor wrapperen
   ligger under en header (`ProfilePage`, `OneRepMaxCalculatorPage`, `Resistance`, `Run`) bliver
   `frame.y ≈ 0`, og den beregnede padding bliver for lille med ca. header-højden + top-inset.
   På iOS løftes indholdet altså systematisk for lidt.
5. **Tredobbelt kompensation på iOS.** Samtidig aktiv: KAV `behavior="padding"` (fuld
   tastaturhøjde), `automaticallyAdjustKeyboardInsets` (ScrollView-inset = tastaturhøjde) **og**
   `contentContainerStyle.paddingBottom = 24 + keyboardInset` (linje 129). Tre lag der hver
   kompenserer for hele tastaturet. Det giver overdrevent tomrum og synlige layout-hop.

**Modal/sheet-primitiverne:**

- `ThemedModal.js` — `<Modal transparent animationType="fade">`, overlay med
  `justifyContent: "center"`, `maxHeight: 400` som standard. **Ingen** `KeyboardAvoidingView`,
  ingen `keyboardShouldPersistTaps`, ingen `Keyboard`-lyttere. `overflow: "hidden"` betyder at
  indhold der ikke passer bliver klippet, ikke scrollbart.
- `ThemedWorkoutModal.js` — ren pass-through til `ThemedModal`. Samme mangler.
- `ThemedBottomSheet.js` — `position: absolute; bottom: 0`, `height = SCREEN_HEIGHT * 0.95`,
  `translateY` snap på 40 % / 5 %. `SCREEN_HEIGHT` læses **én gang på modul-niveau** (linje 16).
  Ingen tastaturhåndtering, ingen `keyboardShouldPersistTaps` på den indre `ScrollView`.

**Context-lækage (vigtigt for kode-agenten):** `useThemedKeyboardProtection()` returnerer et
no-op default, *medmindre* komponenten ligger i React-træet under en `ThemedKeyboardProtection`.
RN's `<Modal>` bryder **ikke** React-context. Derfor sker der to forskellige ting:

- Modaler renderet som søskende til wrapperen (`WorkoutPage`-overlays, `FeedbackModal` i
  `ProfilePage:911` — wrapperen lukker på linje 908) får det tomme default ⇒ ingenting sker.
- Modaler renderet *inde i* wrapperen (`PanelSettingsModal` og `SetList`s bottom sheet, som
  ligger under `Resistance`s wrapper på `Resistance.js:630`) får den rigtige funktion og scroller
  **siden bag modalen** når man fokuserer et felt i modalen. Det hjælper ikke feltet, og det
  efterlader siden i en forskudt scrollposition når modalen lukkes.

### 1.4 Referenceimplementering

**Der findes ingen skærm der er gjort helt rigtigt.** Den bedste af dem — og den der kommer
tættest på et brugbart mønster — er `SocialPostEditPage`:

```
ThemedView (safe top/left/right)
 └ ThemedHeader                          ← uden for KAV, korrekt
 └ KeyboardAvoidingView (flex: 1, behavior: ios ? "padding" : undefined)
    ├ ScrollView (flex: 1, keyboardShouldPersistTaps="handled")
    │   └ … felt …
    └ View styles.footer                 ← faste knapper, inde i KAV ⇒ løftes med på iOS
```

Det rigtige i mønstret: headeren er uden for KAV'en (så `keyboardVerticalOffset` reelt kan være
0), footeren med Gem/Annuller er **inde i** KAV'en, og scroll-området har
`keyboardShouldPersistTaps="handled"`. Det er den struktur Del 2 bygger videre på.
Det manglende: Android-grenen er `undefined` (samme defekt som wrapperen), og der er ingen
auto-scroll til det fokuserede felt.

`LoginPage` og `RegisterPage` er de skærme hvor den nuværende wrapper faktisk *virker* på iOS,
fordi der ikke er nogen header over den og ingen bundmenu under den (uautentificeret tilstand) —
altså netop de forhold hvor defekt 4 og 5 ikke slår igennem. De er derfor ikke en reference, men
et heldigt sammentræf.

### 1.5 Fuld inventarliste over inputfelter

43 aktive felter fordelt på 34 render-steder, plus 6 felter i død kode. Sorteret efter fil.

| # | Skærm / kontekst | Felt (som brugeren ser det) | Fil:linje | Type | Håndtering |
|---|---|---|---|---|---|
| 1 | Exercise catalog → Add custom exercise (modal, step 1) | "Exercise name" (`autoFocus`) | `src/Pages/ExerciseCatalogPage/Components/CustomExerciseModal/CustomExerciseModal.js:151` | ThemedTextInput | Ingen |
| 2 | *(død kode)* Add exercise to library (modal) | "Exercise Name" | `src/Pages/ExerciseLibraryPage/Components/AddExerciseStorage/AddExerciseStorageModal.js:30` | TextInput | Ingen |
| 3 | Add exercise to workout (picker) | "Search exercises..." | `src/Pages/ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList.js:394` | TextInput | Ingen |
| 4 | Exercise library (katalog) | "Search exercises..." | `…/ExerciseLibraryList.js:1034` | TextInput | Ingen |
| 5 | Social post exercises | "Search exercises..." | `src/Pages/ExerciseSocialPostSettingsPage/ExerciseSocialPostSettingsPage.js:209` | TextInput | `keyboardShouldPersistTaps` i FlatList |
| 6 | Login | "Email" | `src/Pages/LoginPage/LoginPage.js:128` | ThemedTextInput | ThemedKeyboardProtection |
| 7 | Login | "Password" | `src/Pages/LoginPage/LoginPage.js:143` | ThemedTextInput | ThemedKeyboardProtection |
| 8 | Microcycle → Log sickness (modal) | "Note" (multiline) | `src/Pages/MicrocyclePage/Components/MicrocycleList/MicrocycleList.js:1293` | ThemedTextInput | Ingen |
| 9 | Notification settings → Custom | "Search people you follow" | `src/Pages/NotificationSettingsPage/NotificationSettingsPage.js:355` | TextInput | `keyboardShouldPersistTaps` |
| 10 | Profile | "Display name" | `src/Pages/ProfilePage/ProfilePage.js:553` | **rå** TextInput | Wrapper findes, men feltet kalder ikke `requestScrollToInput` |
| 11 | Profile | "Bio" (multiline) | `src/Pages/ProfilePage/ProfilePage.js:608` | **rå** TextInput | Samme |
| 12 | Program overview → Settings | "Program name" | `src/Pages/ProgramOverviewPage/ProgramOverviewPage.js:754` | ThemedEditableCell | Ingen |
| 13 | Program overview → Add block (modal) | "Focus (e.g. Hypertrophy)" | `src/Pages/ProgramOverviewPage/Components/MesocycleList/AddMesocycleModal.js:28` | ThemedTextInput | Ingen |
| 14 | Program overview → Add 1 RM (modal) | "Enter weight" | `src/Pages/ProgramOverviewPage/Components/rm_list/Components/AddEstimatedSet/AddEstimatedSet.js:201` | ThemedTextInput | Ingen |
| 15 | Program overview → Edit 1 RM (modal) | "Enter weight" | `…/EditEstimatedSet/EditEstimatedSet.js:238` | ThemedTextInput | Ingen |
| 16 | Programs → New program (modal) | "Example: Spring strength block" | `src/Pages/ProgramPage/Components/AddProgram/AddProgram.js:74` | ThemedTextInput | Ingen |
| 17 | Register | "Username" | `src/Pages/RegisterPage/RegisterPage.js:189` | ThemedTextInput | ThemedKeyboardProtection |
| 18 | Register | "Email" | `src/Pages/RegisterPage/RegisterPage.js:211` | ThemedTextInput | ThemedKeyboardProtection |
| 19 | Register | "Password" | `src/Pages/RegisterPage/RegisterPage.js:226` | ThemedTextInput | ThemedKeyboardProtection |
| 20 | Register | "Retype password" | `src/Pages/RegisterPage/RegisterPage.js:242` | ThemedTextInput | ThemedKeyboardProtection |
| 21-25 | *(død skærm)* SetPage | "note", "Pause", "RPE", "Reps", "Weight" | `src/Pages/SetPage/SetPage.js:140,147,155,163,171` | TextInput | Ingen |
| 26 | Sickness log → Register/Edit (modal) | "Note" (multiline) | `src/Pages/SicknessPage/SicknessPage.js:490` | ThemedTextInput | Ingen |
| 27 | Edit post | "Write a note..." (multiline) | `src/Pages/SocialPostEditPage/SocialPostEditPage.js:163` | ThemedTextInput | Egen KeyboardAvoidingView |
| 28 | Find Friends | "Search username tags or display names" | `src/Pages/SocialUserListPage/SocialUserListPage.js:177` | ThemedTextInput | `keyboardShouldPersistTaps` |
| 29 | Workout → Change name (modal) | "Workout label" (`autoFocus`) | `src/Pages/WorkoutPage/WorkoutPage.js:405` | ThemedTextInput | Ingen |
| 30 | Workout (styrke) → Exercise Settings (modal) | "Add note" (multiline) | `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/PanelSettingsModal.js:118` | ThemedTextInput | Context lækker fra siden (skadelig) |
| 31-35 | Workout (styrke) → sæt-tabel | "Reps", "RPE", "%" (`rm_percentage`), "Weight", hviletid | `…/ExerciseRow/SetList/SetList.js:589` (kaldes fra 656, 665, 672, 680, 854) | ThemedEditableCell ×5 | ThemedKeyboardProtection (via `Resistance.js:630`) |
| 36 | Workout (styrke) → sæt-indstillinger (bottom sheet) | "Add note" (multiline) | `…/ExerciseRow/SetList/SetList.js:1112` | ThemedTextInput | Context lækker fra siden (skadelig) |
| 37-39 | Workout (løb) → endurance-plan | "DURATION", "DISTANCE", "PACE" | `src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js:3778, 3846, 3917` | ThemedEditableCell ×3 | ThemedKeyboardProtection (via `Run.js:5008`) |
| 40-42 | Workout (løb) → interval-tabel | "DIST", "PACE", "TIME" pr. række | `src/Pages/WorkoutPage/WorkoutTypes/Run/RunSetList.js:648` (kaldes fra 866, 879, 912, 1031, 1043, 1068) | ThemedEditableCell ×3 | ThemedKeyboardProtection (via `Run.js:5008`) |
| 43-45 | Workout (løb) → sæt-redigering (bottom sheet) | "DIST", "PACE", "TIME" | `src/Pages/WorkoutPage/WorkoutTypes/Run/RunSetList.js:1414, 1438, 1463` | ThemedEditableCell ×3 | Context lækker fra siden (skadelig) |
| 46 | Profile → Workout types → Max heart rate (modal) | "Max bpm" / "Current N bpm" | `src/Pages/WorkoutTypesSettingsPage/WorkoutTypesSettingsPage.js:773` | ThemedTextInput | Ingen |
| 47 | Profile → Send feedback (modal) | "Tell us what happened…" (multiline) | `src/Resources/Components/FeedbackModal/FeedbackModal.js:88` | ThemedTextInput | Ingen |

Kontrolleret: der findes **ingen** andre input-primitiver i appen. En udtømmende søgning på
`TextInput`, `TextField`, `SearchBar`, `contentEditable` og `inputAccessory` giver kun de
ovenstående plus de to wrapper-komponenter (`ThemedTextInput.js`, `ThemedEditableCell.js`).
`@react-native-picker/picker`, `expo-checkbox`, `ThemedDateWheelPicker`, `ThemedPicker`,
`ThemedSwitch` og `ThemedSegmentedToggle` åbner ikke tastatur.

**Død kode** (må ikke prioriteres): `SetPage` er registreret i `App.js:376`, men der findes
**ingen** `navigate("SetPage")` i hele kodebasen. `AddExerciseStorageModal` importeres ikke
nogen steder. 6 felter i alt.

---

## Del 2 — Anbefalet fælles løsning

### 2.1 Ét standardmønster: `react-native-keyboard-controller`

**Anbefaling: indfør `react-native-keyboard-controller` som fundament, og byg alle tre wrappere
oven på det.**

Begrundelse — hvorfor netop det, og ikke bare "reparér den nuværende wrapper":

1. **Android-hullet kan ikke lukkes med RN's egne primitiver.** Appen er edge-to-edge på API 35+.
   `adjustResize` virker ikke der, og RN's `KeyboardAvoidingView` har ingen Android-implementering
   (se defekt 1). Den eneste vej frem er at læse `WindowInsets.Type.ime()` direkte — det er
   præcis hvad `react-native-keyboard-controller` gør, og det er det bibliotek Expo selv
   henviser til for edge-to-edge-projekter.
2. **`endCoordinates.screenY` er upålidelig.** Både Android-edge-to-edge (defekt 3) og iPad med
   floating keyboard giver forkerte værdier. Biblioteket eksponerer i stedet
   `KeyboardController`/`useKeyboardHandler` med korrekt højde og progression.
3. **Frame-fejlen forsvinder.** `KeyboardAvoidingView` fra biblioteket måler mod vinduet, ikke mod
   forælderen, så defekt 4 (`keyboardVerticalOffset` = 0 under en header) forsvinder af sig selv.
4. **`KeyboardAwareScrollView` erstatter den håndskrevne `scrollToInput`.** Den finder selv det
   fokuserede felt, respekterer `bottomOffset` (plads til fejlbesked/tegntæller under feltet) og
   håndterer at et multiline-felt vokser.
5. **New Architecture er slået til** (`newArchEnabled: true`), som biblioteket kræver — ingen
   blokering.

Alternativet — at reparere den nuværende wrapper i hånden — kræver at man selv skriver en native
inset-lytter for Android. Det er samme arbejde, men uden vedligehold.

### 2.2 Hvordan mønstret skal opføre sig forskelligt på iOS og Android

Dette er kernen. De to platforme skal **ikke** have samme opsætning.

| Aspekt | iOS | Android |
|---|---|---|
| Hvem flytter indholdet | Kun appen. Systemet gør intet. | Appen. Vinduet krymper **ikke** (edge-to-edge), så man kan ikke læne sig på OS'et. |
| Mekanisme | `KeyboardAvoidingView` fra biblioteket, `behavior="padding"` | Samme komponent, `behavior="padding"` — **ikke** `undefined`. Biblioteket har en rigtig Android-implementering. |
| Bundmenu (`ThemedBottomNavigation`) | Ligger uden for skærmens layout (søskende i `App.js:414`) og bliver dækket af tastaturet. Skal ikke kompenseres. | Samme. Men fordi vinduet ikke krymper, sker der ikke længere det Android-typiske "menuen hopper op over tastaturet". |
| `keyboardVerticalOffset` | 0, forudsat at wrapperen placeres **under** headeren (som i `SocialPostEditPage`). Ellers header-højde + top-inset. | Samme regel. |
| Luk-tastatur-gestus | `keyboardDismissMode="interactive"` (træk tastaturet ned) | `keyboardDismissMode="on-drag"` |
| Ekstra inset | **Ingen.** Fjern `automaticallyAdjustKeyboardInsets` og fjern `paddingBottom: 24 + keyboardInset`. Kompensér én gang, ét sted. | Ingen. |
| "Færdig"-knap over tastaturet | Nødvendig ved `keyboardType` `numeric`/`decimal-pad`/`number-pad`, hvor iOS ikke har en returtast. Brug bibliotekets `KeyboardToolbar`. | Android har systemets tilbage-gestus; toolbar er en bonus, ikke et krav. |
| Modaler | RN's `<Modal>` gør **intet** for tastaturet. Wrapper skal ind i modalen. | RN's Modal-dialog **er** `adjustResize` og **ikke** edge-to-edge, så den krymper faktisk. Wrapperen skal derfor være tolerant over for at vinduet allerede har flyttet sig — ellers dobbeltkompensation. |
| Tastaturhøjde | Varierer med QuickType-linjen, emoji-rækken og tredjeparts-tastaturer. Aldrig antag en værdi. | Samme, plus at Gboards clipboard-/emoji-bjælke kan give 20-30 % ekstra højde. |

### 2.3 Genanvendelige komponenter

**A) Omskriv `src/Resources/ThemedComponents/ThemedKeyboardProtection.js`** (behold filnavn og
eksport, så de 7 nuværende kaldesteder ikke skal ændres).

Props-API (bagudkompatibelt superset af det nuværende):

| Prop | Type | Default | Ansvar |
|---|---|---|---|
| `children` | node | — | — |
| `scroll` | bool | `false` | `true` ⇒ `KeyboardAwareScrollView`; `false` ⇒ kun `KeyboardAvoidingView` |
| `contentContainerStyle` | style | — | Videreføres uændret |
| `scrollViewProps` | object | `{}` | Videreføres uændret |
| `style` | style | — | Videreføres uændret |
| `keyboardVerticalOffset` | number | `0` | Bevares for skærme hvor wrapperen ikke ligger under headeren |
| **`bottomOffset`** (ny) | number | `24` | Ekstra luft under det fokuserede felt — her ligger fejlbesked, tegntæller og hjælpetekst. Sættes til 72 på felter med fejlbesked + tæller under sig |
| **`footer`** (ny) | node | — | Faste knapper der skal løftes med tastaturet (bruges af `SocialPostEditPage`) |
| **`toolbar`** (ny) | bool | `false` | Viser "Færdig"-bjælke — sæt `true` på alle numeriske felter |

Ansvar: fjern `automaticallyAdjustKeyboardInsets`, fjern `contentInsetAdjustmentBehavior`, fjern
`paddingBottom: 24 + keyboardInset`, fjern hele `keyboardDidShow`/`keyboardDidHide`-blokken og
`scrollToInput`-beregningen (biblioteket overtager). Behold context-provideren som en tom shim i
én release, så `ThemedTextInput`/`ThemedEditableCell` ikke crasher, og fjern derefter
`requestScrollToInput`-kaldene fra dem.

**B) Ny komponent: `src/Resources/ThemedComponents/ThemedKeyboardSheet.js`**

Den mangler helt i dag, og det er den der løser flest KRITISK-fund.

| Prop | Type | Ansvar |
|---|---|---|
| `children` | node | Indhold |
| `footer` | node | Faste knapper (Gem/Annuller/Slet). **Skal** placeres inde i keyboard-laget, så de løftes med |
| `scroll` | bool | Om indholdet skal være scrollbart (default `true`) |
| `bottomOffset` | number | Som ovenfor |

Skal håndtere: `KeyboardAvoidingView` **inde i** `<Modal>` (ikke udenfor — det virker ikke),
`keyboardShouldPersistTaps="handled"` på det indre scroll-område, `Keyboard.dismiss()` på
backdrop-tryk før `onClose`, og — vigtigt — at den ikke dobbeltkompenserer på Android hvor
Dialog-vinduet allerede krymper. Konkret: mål det tilgængelige vindue i stedet for at antage
skærmhøjden.

**C) `ThemedModal.js` og `ThemedBottomSheet.js` bygges om til at bruge (B) internt.**

Dette er det største enkeltgreb i rapporten: alle 14 modal-/sheet-felter bliver løst på én gang,
uden at de 14 kaldesteder skal ændres.

I `ThemedModal` skal derudover:
- `justifyContent: "center"` udskiftes med `justifyContent: "flex-end"` når tastaturet er fremme
  (en centreret modal har ingen steder at gå hen).
- `maxHeight: 400` (linje 72) laves dynamisk: `maxHeight: availableHeight - keyboardHeight - 32`.
  Den faste 400 er i sig selv en fejl — se TAST-10.
- `overflow: "hidden"` suppleres med et scroll-lag, så klippet indhold bliver tilgængeligt.

I `ThemedBottomSheet` skal derudover:
- `SCREEN_HEIGHT` (linje 16) flyttes fra modul-scope ind i komponenten via `useWindowDimensions()`.
  Modul-scope-værdien er stale efter enhver dimensionsændring.
- Snap-punkter skal beregnes ud fra `windowHeight - keyboardHeight`, ikke `windowHeight`.

**Hvilke skærme skal bruge hvad:**

| Komponent | Kaldesteder |
|---|---|
| `ThemedKeyboardProtection` (omskrevet) | `LoginPage`, `RegisterPage`, `ProfilePage`, `OneRepMaxCalculatorPage`, `Resistance`, `Run` (2×) — uændrede kaldesteder. **Nye:** `ExerciseCatalogPage`, `ProgramOverviewPage`, `NotificationSettingsPage`, `SocialUserListPage`, `SocialPostEditPage` (erstat den lokale KAV), `ExerciseSocialPostSettingsPage` |
| `ThemedKeyboardSheet` (via `ThemedModal`) | `CustomExerciseModal`, `AddMesocycleModal`, `AddEstimatedSet`, `EditEstimatedSet`, `AddProgram`, `SicknessPage`, `MicrocycleList`, `WorkoutPage` (label), `PanelSettingsModal`, `WorkoutTypesSettingsPage`, `FeedbackModal` |
| `ThemedKeyboardSheet` (via `ThemedBottomSheet`) | `SetList` (sæt-indstillinger), `RunSetList` (sæt-redigering) |

### 2.4 Globale indstillinger der skal ændres

| Ændring | Fil | Hvad det påvirker |
|---|---|---|
| Tilføj `react-native-keyboard-controller` som dependency og wrap app-roden i `<KeyboardProvider>` | `package.json`, `App.js` (omkring `NavigationContainer` på linje 346 — **uden for**, så bundmenuen også dækkes) | Hele appen. Kræver ny native build (ikke muligt via OTA-update). |
| **Behold** `softwareKeyboardLayoutMode: "resize"` | `app.json:56` | Skift **ikke** til `"pan"`. `pan` er ikke understøttet sammen med edge-to-edge og vil bryde layoutet på alle skærme. `resize` er harmløs (den er blot uden effekt) og er den værdi biblioteket forventer. |
| **Behold** `edgeToEdgeEnabled: true` | `app.json:55` | Kan ikke slås fra på API 35+; forsøg vil kun give inkonsistens mellem enheder. |
| Efterprøv at `android:windowSoftInputMode="adjustResize"` bevares efter prebuild | `android/app/src/main/AndroidManifest.xml:37` | Hvis nogen sætter `adjustNothing`, ændrer RN sin `screenY`-beregning (`ReactRootView.java:909-913`) og alt skal måles om. |
| Ryd op i `android.permissions` (dubletter i `app.json:59-70`) | `app.json` | Ikke tastaturrelateret, men bemærket under gennemgangen. |

### 2.5 Undtagelser hvor det fælles mønster ikke kan bruges

1. **`ThemedEditableCell` i tabelrækker** (fund 31-35, 40-42). Cellerne er små, `flex`-baserede
   celler i en tabel med faste kolonnebredder. De må ikke wrappes individuelt. Løsningen ligger i
   scroll-containeren (`Resistance`/`Run`s wrapper) plus `bottomOffset` stor nok til at hele
   rækken — ikke bare cellen — kommer fri af tastaturet. Sæt desuden
   `keyboardShouldPersistTaps="handled"`, så man kan springe direkte fra en celle til den næste
   uden et ekstra tryk.
2. **`Run.js` under aktiv løbetræning.** Skærmen har en kørende timer og GPS-opdateringer. Undgå
   `LayoutAnimation`-baserede løft (som RN's KAV bruger) — brug bibliotekets Reanimated-baserede
   variant, ellers vil timeren stamme ved hver tastaturåbning.
3. **`autoFocus`-felter** (`CustomExerciseModal.js:158`, `WorkoutPage.js:409`). Tastaturet er
   fremme *før* modalen har målt sig selv. Her skal fokus udskydes til efter modalens
   åbningsanimation (`onShow`-callback) — ellers beregnes løftet ud fra et layout der ikke findes
   endnu.
4. **`SetPage` og `AddExerciseStorageModal`.** Død kode. Skal **slettes**, ikke rettes.

---

## Del 3 — Fund pr. skærm

### TAST-01 — KRITISK: GLOBALT — al tastaturhåndtering er uden effekt på Android
- **Navigationssti:** Alle skærme med inputfelter
- **Fil:** `src/Resources/ThemedComponents/ThemedKeyboardProtection.js:109` (behavior), `:121` (iOS-only prop), `:80-82` + `:53` (død scroll-beregning); `app.json:55-56` (konfigurationskonflikt); `src/Pages/SocialPostEditPage/SocialPostEditPage.js:119` (samme fejl lokalt)
- **Placering på skærmen:** Hele appen
- **Nuværende håndtering:** `behavior={undefined}` på Android ⇒ ren `View`. `automaticallyAdjustKeyboardInsets` er iOS-only. Auto-scroll bygger på `endCoordinates.screenY`, som under edge-to-edge ≈ skærmens bund ⇒ `scrollToInput` finder aldrig overlap.
- **Problem:** På Android sker der ingenting når tastaturet åbner. Skærmen flytter sig ikke, og der scrolles ikke til feltet. Det eneste der virker er `paddingBottom: 24 + keyboardInset` (linje 129), som giver plads til at brugeren kan scrolle **manuelt** — hvis feltet ligger i en scroll-container. Ligger det ikke det (modaler, sidste sektion i en færdigscrollet side), er feltet uopnåeligt.
- **Også skjult:** Alt under feltet — Gem-knapper, fejlbeskeder, tegntællere.
- **Platform:** **Android** (iOS har delvis håndtering, se TAST-23/24)
- **Status:** **Bekræftet i kode.** `KeyboardAvoidingView.js:286-295` returnerer beviseligt en ujusteret `View` ved `behavior === undefined`. `ReactRootView.java:906-913` viser beviseligt at `screenY` kommer fra `getWindowVisibleDisplayFrame()`. At den frame ikke krymper under edge-to-edge er dokumenteret Android-adfærd, men den konkrete talværdi kan kun måles på enhed.
- **Løsning:** Anvend fælles mønster fra Del 2 (afsnit 2.1-2.4). Dette fund er forudsætningen for alle andre — ret det først.
- **Verificeres sådan:** Android-telefon, Login-skærmen. Log `event.endCoordinates` i `keyboardDidShow`. Hvis `screenY` er ≈ skærmhøjden (fx 891 på en 891 dp-skærm) i stedet for ≈ `skærmhøjde − tastaturhøjde` (fx 590), er fundet bekræftet. Gentag på Android 13 og Android 15 — adfærden kan afvige.

### TAST-02 — KRITISK: Send feedback — "Tell us what happened…"
- **Navigationssti:** Bundmenu → Profil → Support → Send feedback
- **Fil:** `src/Resources/Components/FeedbackModal/FeedbackModal.js:88` (felt), `:152-172` (knapper), `FeedbackModalStyle.js:6` (`maxHeight: 520`), `:26` (`minHeight: 154`)
- **Placering på skærmen:** I modal, centreret. Feltet fylder 154 pt, med tegntæller, fejlbanner og "Send Feedback"-knap under sig.
- **Nuværende håndtering:** **Ingen.** `ThemedModal` har ingen tastaturhåndtering. Modalen er renderet på `ProfilePage:911`, dvs. **uden for** `ThemedKeyboardProtection` (som lukker på linje 908) ⇒ context er no-op.
- **Problem:** Modalen er 520 pt høj og centreret i skærmen. Med tastaturet fremme (typisk 300-340 pt) er der ~380 pt tilbage over tastaturet. Modalen flytter sig ikke. Den nederste tredjedel — inklusive de sidste linjer af tekstfeltet, tegntælleren og hele knap-rækken — ligger under tastaturet.
- **Også skjult:** Tegntælleren (`{trimmedLength}/{MAX}`), fejlbeskeden ("Could not send feedback right now") og **"Send Feedback"-knappen**. Brugeren kan ikke indsende.
- **Platform:** **iOS** kritisk. **Android**: Modal-dialogen er `adjustResize` og krymper, men `maxHeight: 520` er fast ⇒ modalen bliver højere end det tilgængelige vindue, og `overflow: "hidden"` klipper indholdet i begge ender.
- **Status:** **Bekræftet i kode** (ingen håndtering findes). Den præcise klipning skal måles.
- **Løsning:** Anvend fælles mønster fra Del 2 — `ThemedKeyboardSheet` via `ThemedModal`, med knap-rækken som `footer`. Gør `maxHeight` dynamisk.
- **Verificeres sådan:** iPhone SE (lille skærm) og iPhone 15. Profil → Send feedback → tryk i feltet → skriv 3 linjer. Man skal kunne se den sidste indtastede linje, tegntælleren og "Send Feedback" samtidig.

### TAST-03 — KRITISK: Sickness log → Register/Edit sickness — "Note"
- **Navigationssti:** Bundmenu → Training → Quick tools → Sickness log → (+) Register / tryk på en registrering
- **Fil:** `src/Pages/SicknessPage/SicknessPage.js:490` (felt), `:501-559` (Delete/Cancel/Save), `:359` (`ThemedModal`), `:371` (indre `ScrollView`)
- **Placering på skærmen:** I modal. Feltet er **sidste element** i modalens `ScrollView`; "Delete sickness", "Cancel" og "Save" ligger uden for scrollen, under den.
- **Nuværende håndtering:** **Ingen.** Den indre `ScrollView` har ikke engang `keyboardShouldPersistTaps`.
- **Problem:** Multiline-note som sidste element i en centreret modal. Feltet kan ikke komme fri af tastaturet, fordi modalen ikke flytter sig og scrollen allerede er i bund.
- **Også skjult:** "Save"-knappen og "Delete sickness". Brugeren kan hverken gemme eller slette mens tastaturet er fremme, og skal gætte at man skal lukke tastaturet først — hvilket kun kan gøres ved at trække i scrollen (der ikke har `keyboardDismissMode`) eller trykke på baggrunden (hvilket lukker hele modalen og kasserer indtastningen).
- **Platform:** **begge**
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 — knapperne (`:501-559`) skal ind som `footer` i `ThemedKeyboardSheet`.
- **Verificeres sådan:** iPhone SE + Android-telefon. Sickness log → Register → udfyld datoer og type → tryk i "Note" → skriv. "Save" skal være synlig og trykbar med tastaturet oppe.

### TAST-04 — KRITISK: Microcycle → Log sickness — "Note"
- **Navigationssti:** Bundmenu → Training → Programs → (program) → (blok) → Microcycle → marker en dag som syg → Log sickness
- **Fil:** `src/Pages/MicrocyclePage/Components/MicrocycleList/MicrocycleList.js:1293` (felt), `:1304-1341` (Cancel/Save), `:1226` (`ThemedModal`, `maxHeight: "86%"`), `:1238` (indre `ScrollView`)
- **Placering på skærmen:** I modal. Feltet er **sidste element** i scrollen; Cancel/Save ligger under scrollen.
- **Nuværende håndtering:** **Ingen**
- **Problem:** Identisk med TAST-03. Modalen er 86 % af skærmhøjden, altså næsten fuld skærm, og feltet ligger i bunden af den.
- **Også skjult:** "Save"-knappen.
- **Platform:** **begge**
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2. Bemærk at TAST-03 og TAST-04 er to næsten identiske kopier af samme UI — overvej at samle dem i én komponent under rettelsen.
- **Verificeres sådan:** Som TAST-03, men via Microcycle-skærmen.

### TAST-05 — KRITISK: Workout (styrke) → sæt-indstillinger — "Add note"
- **Navigationssti:** Bundmenu → (+) / Forside → et styrke-workout → tryk på et sæt-nummer → sæt-indstillinger (bottom sheet)
- **Fil:** `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js:1112`; sheet-primitiv: `src/Resources/ThemedComponents/ThemedBottomSheet.js`
- **Placering på skærmen:** I **bottom sheet** forankret til skærmens bund. Feltet er det **sidste element** i sheetens `ScrollView`.
- **Nuværende håndtering:** Ingen i sheeten. Værre: `SetList` ligger inde i `Resistance.js:630`s `ThemedKeyboardProtection`, så `requestScrollToInput` (`ThemedTextInput.js:32`) **rammer siden bag sheeten**. Siden scroller, sheeten gør ikke.
- **Problem:** En bottom sheet er per definition forankret til skærmens bund — præcis hvor tastaturet kommer op. Feltet er helt dækket. Derudover efterlader den utilsigtede baggrundsscroll skærmen i en forskudt position når sheeten lukkes.
- **Også skjult:** Hele feltet. Der er ingen Gem-knap (noten gemmes i `onEndEditing`/`handleCloseSetOptions`), men brugeren kan ikke se hvad de skriver — og fordi noten committes ved close, risikerer de at gemme blindt indtastet tekst.
- **Platform:** **iOS** kritisk (intet flytter sig). **Android:** Dialog-vinduet krymper, men `SHEET_HEIGHT` er beregnet ud fra `SCREEN_HEIGHT` læst på modul-niveau (`ThemedBottomSheet.js:16,19`), så sheeten er højere end vinduet og `translateY`-snappene er forkerte.
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 — `ThemedBottomSheet` bygges om på `ThemedKeyboardSheet`, `SCREEN_HEIGHT` flyttes til `useWindowDimensions()`, snap-punkter beregnes mod `windowHeight − keyboardHeight`. Fjern desuden `requestScrollToInput`-kaldet når feltet er i en sheet (context-lækagen).
- **Verificeres sådan:** iPhone + Android. Start et styrketræningspas → tryk på sæt-nummer "1" → tryk i "Add note" → skriv. Feltet skal være synligt. Luk sheeten og tjek at siden bagved står i samme scrollposition som før.

### TAST-06 — KRITISK: Workout (styrke) → Exercise Settings — "Add note"
- **Navigationssti:** Bundmenu → (+) → et styrke-workout → tandhjuls-ikonet på en øvelse → Exercise Settings
- **Fil:** `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/PanelSettingsModal.js:118` (felt), `:66` (`maxHeight: 520`), `:71` (indre `ScrollView` uden `keyboardShouldPersistTaps`), `:155-158` (`minHeight: 140`)
- **Placering på skærmen:** I modal, nederste halvdel. Under feltet: "Delete Exercise"-knappen.
- **Nuværende håndtering:** Ingen i modalen. Samme context-lækage som TAST-05 (modalen ligger under `Resistance`s wrapper).
- **Problem:** 520 pt høj centreret modal med et 140 pt multiline-felt i den nederste tredjedel. Feltet dækkes.
- **Også skjult:** "Delete Exercise". Ingen Gem-knap (auto-commit), men se TAST-05 om blind indtastning.
- **Platform:** **iOS** kritisk; **Android** som TAST-02 (fast `maxHeight` vs. krympet vindue).
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2.
- **Verificeres sådan:** Start et styrketræningspas → tandhjul på en øvelse → tryk i "Exercise note" → skriv 3 linjer. Sidste linje skal være synlig.

### TAST-07 — KRITISK: Edit post — "Write a note..."
- **Navigationssti:** Forside → et workout-opslag i feed → Edit post
- **Fil:** `src/Pages/SocialPostEditPage/SocialPostEditPage.js:163` (felt), `:119` (`behavior={Platform.OS === "ios" ? "padding" : undefined}`), `:187-201` (fast footer med Cancel/Save)
- **Placering på skærmen:** Midt på skærmen, med **fast bundlinje** (footer) under sig.
- **Nuværende håndtering:** Egen `KeyboardAvoidingView` med korrekt struktur (footer inde i KAV, header udenfor, `keyboardShouldPersistTaps="handled"`). **Men `behavior` er `undefined` på Android.**
- **Problem:** På iOS fungerer denne skærm: footeren løftes op over tastaturet og feltet er synligt. På Android sker der intet — footeren med "Save" bliver liggende under tastaturet.
- **Også skjult:** **"Save"-knappen** (Android). Brugeren kan ikke gemme sin redigering.
- **Platform:** **Android**
- **Status:** **Bekræftet i kode**
- **Løsning:** Erstat den lokale `KeyboardAvoidingView` med den omskrevne `ThemedKeyboardProtection` (`scroll` + `footer`). Bevar den nuværende struktur — den er rigtig; det er kun `behavior` der er forkert. Denne skærms opbygning er reference for Del 2.
- **Verificeres sådan:** Android-telefon. Forside → et opslag → Edit post → tryk i notefeltet. "Save" skal være synlig og trykbar. Gentag på iOS for at sikre at ombygningen ikke forringer det der virkede.

### TAST-08 — KRITISK: Program overview → Settings — "Program name"
- **Navigationssti:** Bundmenu → Training → Programs → (vælg program) → rul til bunden → Settings
- **Fil:** `src/Pages/ProgramOverviewPage/ProgramOverviewPage.js:754` (`ThemedEditableCell`), `:493-499` (`ScrollView`, `paddingBottom: insets.bottom + 15`)
- **Placering på skærmen:** **Nederst** — i den sidste sektion på en meget lang side. Under feltet er der kun ~200 pt indhold (Period + Export).
- **Nuværende håndtering:** **Ingen.** Ingen `ThemedKeyboardProtection`, ingen `keyboardShouldPersistTaps`, ingen ekstra bund-padding til tastaturet. `ThemedEditableCell:61` kalder `requestScrollToInput`, men uden provider er det en no-op.
- **Problem:** Brugeren skal rulle til bunden af siden for at nå feltet. Der er derfor **ingen scroll-plads tilbage** — selv med korrekt auto-scroll kan feltet ikke løftes, fordi `contentSize` ikke er større end viewporten. Feltet er permanent under tastaturet på enhver skærm hvor tastaturet er højere end ~200 pt, hvilket er alle.
- **Også skjult:** Blyants-ikonet der signalerer at feltet er redigerbart, og hele Export-sektionen.
- **Platform:** **begge**
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2. Kritisk detalje: ud over wrapperen **skal** `contentContainerStyle` have dynamisk bund-padding svarende til tastaturhøjden, ellers findes der ikke scroll-plads at flytte feltet ind i.
- **Verificeres sådan:** iPhone + Android. Training → Programs → et program → rul helt til bunden → tryk på programnavnet. Feltet skal være synligt og markørens position skal kunne ses.

### TAST-09 — KRITISK: Add / Edit 1 RM — "Enter weight"
- **Navigationssti:** Bundmenu → Training → Programs → (program) → Estimated 1RM's → (+) / tryk på en række
- **Fil:** `src/Pages/ProgramOverviewPage/Components/rm_list/Components/AddEstimatedSet/AddEstimatedSet.js:201`; `…/EditEstimatedSet/EditEstimatedSet.js:238`; `AddEstimatedSetStyle.js:4-6` (`maxHeight: 520`)
- **Placering på skærmen:** I modal, nederste tredjedel. Under feltet: "Close" + "Add 1 RM" / "Delete 1 RM".
- **Nuværende håndtering:** **Ingen.** Der er en indre `ScrollView` (`AddEstimatedSet.js:116`) men uden `keyboardShouldPersistTaps` og uden tastatur-padding.
- **Problem:** 520 pt centreret modal; feltet ligger under en "Program best"-sektion, altså i den nederste halvdel. `keyboardType="numeric"` betyder desuden at der ikke findes en returtast at lukke tastaturet med.
- **Også skjult:** **"Add 1 RM" / "Delete 1 RM"-knappen.** Brugeren kan ikke gennemføre.
- **Platform:** **begge**
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 + `toolbar` (Færdig-knap), da feltet er numerisk.
- **Verificeres sådan:** iPhone SE. Programs → et program → Estimated 1RM's → (+) → vælg en øvelse → tryk i "Enter weight". Både feltet og "Add 1 RM" skal være synlige.

### TAST-10 — KRITISK: Workout types → Max heart rate — "Max bpm"
- **Navigationssti:** Bundmenu → Profil → Settings → Workout types → Max heart rate
- **Fil:** `src/Pages/WorkoutTypesSettingsPage/WorkoutTypesSettingsPage.js:773` (felt), `:715` (`ThemedModal` **uden** `style` ⇒ arver `maxHeight: 400` fra `ThemedModal.js:72`), `:809-827` (Cancel/Save)
- **Placering på skærmen:** I modal, nederste tredjedel. Under feltet: fejlbesked, "Clear manual value" og Cancel/Save.
- **Nuværende håndtering:** **Ingen.** Og der er **ingen `ScrollView`** i modalen.
- **Problem:** To lag. (a) Tastaturet dækker feltet og Save. (b) Selv **uden** tastatur er indholdet — 3 kilde-valg à ~64 pt + felt + fejltekst + "Clear manual value" + knap-række + titel + padding — tæt på eller over `maxHeight: 400`, og `ThemedModal` har `overflow: "hidden"` uden scroll. Indhold der ikke passer bliver klippet væk uden mulighed for at nå det.
- **Også skjult:** Fejlbeskeden (`maxHeartRateInputError`, `:785`) — som er hele grunden til at feltet kan afvise en indtastning — og **"Save"**.
- **Platform:** **begge**
- **Status:** **Bekræftet i kode** for den manglende håndtering. Om `maxHeight: 400` faktisk klipper indholdet er en **mistanke** der skal måles.
- **Løsning:** Anvend fælles mønster fra Del 2. Tilføj desuden et scroll-lag og dynamisk `maxHeight`, jf. 2.3.
- **Verificeres sådan:** iPhone SE + lille Android-telefon. Profil → Workout types → Max heart rate. Tæl først om alle 3 kilde-valg, feltet, "Clear manual value" og begge knapper er synlige **uden** tastatur. Tryk derefter i feltet og indtast "999" (skal give fejl) — fejlbeskeden skal være synlig.

### TAST-11 — HØJ: Add custom exercise (step 1) — "Exercise name"
- **Navigationssti:** Bundmenu → Training → Exercise library → Add custom exercise
- **Fil:** `src/Pages/ExerciseCatalogPage/Components/CustomExerciseModal/CustomExerciseModal.js:151` (felt), `:158` (`autoFocus`), `:298-322` (Cancel/Next), `CustomExerciseModalStyle.js:6` (`maxHeight: "90%"`)
- **Placering på skærmen:** I modal, centreret. Step 1 har lidt indhold, så modalen er lav.
- **Nuværende håndtering:** **Ingen.** `keyboardShouldPersistTaps` findes kun på step 2's `ScrollView` (`:171`), ikke på step 1.
- **Problem:** `autoFocus` betyder at tastaturet er fremme fra det øjeblik modalen åbner — før modalen har målt sig selv. Den centrerede modal flytter sig ikke. Feltet ligger nær midten og er formentlig synligt på store skærme, men "Next"-knappen lige under det er i risikozonen. På små skærme dækkes begge.
- **Også skjult:** Fejlbeskeden (`error`-prop, `:163`, rendres af `ThemedTextInput.js:47-51` **under** feltet) og "Next"-knappen.
- **Platform:** **begge**
- **Status:** **Mistanke — skal verificeres.** At der ikke er håndtering er bekræftet; om feltet konkret dækkes afhænger af skærmhøjden.
- **Løsning:** Anvend fælles mønster fra Del 2, plus undtagelse 3 i afsnit 2.5: udskyd `autoFocus` til modalens `onShow`.
- **Verificeres sådan:** iPhone SE **og** en stor Android-telefon. Training → Exercise library → Add custom exercise. Tastaturet skal være oppe med det samme; kontrollér at feltet, en evt. fejlbesked og "Next" alle er synlige. Prøv med og uden Gboards emoji-række slået til.

### TAST-12 — HØJ: New program — "Example: Spring strength block"
- **Navigationssti:** Bundmenu → Training → Programs → (+) New program
- **Fil:** `src/Pages/ProgramPage/Components/AddProgram/AddProgram.js:74` (felt), `:82-112` ("Start now", "Create draft", "Cancel")
- **Placering på skærmen:** I modal, midt. Under feltet: tre handlingsknapper i en kolonne (~150 pt).
- **Nuværende håndtering:** **Ingen**
- **Problem:** Feltet er formentlig synligt, men de tre knapper under det udgør et højt blok som ryger under tastaturet. Der er ingen scroll i modalen.
- **Også skjult:** **"Start now", "Create draft" og "Cancel"** — alle tre veje ud af modalen.
- **Platform:** **begge**
- **Status:** **Mistanke — skal verificeres** (afhænger af skærmhøjde og modalens faktiske højde)
- **Løsning:** Anvend fælles mønster fra Del 2 — knapperne som `footer`.
- **Verificeres sådan:** iPhone SE. Programs → (+) → tryk i navnefeltet → skriv. Alle tre knapper skal kunne ses eller nås ved scroll.

### TAST-13 — HØJ: Add block — "Focus (e.g. Hypertrophy)"
- **Navigationssti:** Bundmenu → Training → Programs → (program) → Blocks → Add block
- **Fil:** `src/Pages/ProgramOverviewPage/Components/MesocycleList/AddMesocycleModal.js:28` (felt), `:34-37` (Cancel/Add). Vist fra `MesocycleList.js:794`.
- **Placering på skærmen:** I modal, midt. Lille modal (titel + felt + 2 knapper).
- **Nuværende håndtering:** **Ingen.** Bemærk desuden at `ThemedModal` kaldes **uden** `onClose` (`:27`) — backdrop-tryk og Android-tilbage lukker derfor ikke modalen.
- **Problem:** Lille centreret modal; feltet er sandsynligvis synligt, knap-rækken i risikozonen. Fordi `onClose` mangler kan brugeren ikke lukke tastaturet ved at trykke uden for modalen (backdrop-`Pressable`'en kalder `undefined`).
- **Også skjult:** "Add"-knappen.
- **Platform:** **begge**
- **Status:** **Mistanke — skal verificeres.** Den manglende `onClose` er **bekræftet i kode**.
- **Løsning:** Anvend fælles mønster fra Del 2. Tilføj desuden `onClose={onClose}` på `ThemedModal` (`:27`) — uafhængigt af tastaturarbejdet.
- **Verificeres sådan:** iPhone SE + Android. Programs → et program → Add block → tryk i feltet. "Add" skal være synlig. Tryk derefter uden for modalen — den skal lukke.

### TAST-14 — HØJ: Workout → Change name — "Workout label"
- **Navigationssti:** Bundmenu → (+) / Forside → et workout → ⋯ (tre punkter) → Change name
- **Fil:** `src/Pages/WorkoutPage/WorkoutPage.js:405` (felt), `:409` (`autoFocus`), `:415-428` (Cancel/Save)
- **Placering på skærmen:** I modal, centreret. Lille modal.
- **Nuværende håndtering:** **Ingen.** Modalen er søskende til `Resistance`/`Run` (`WorkoutPage.js:449`), altså uden for deres wrappere ⇒ context er no-op.
- **Problem:** `autoFocus` + centreret modal der ikke flytter sig. Feltet er formentlig synligt; Save/Cancel i risikozonen.
- **Også skjult:** "Save"-knappen. (`onSubmitEditing={saveWorkoutLabel}` på `:412` giver en vej ud via returtasten — det redder brugeren, men det er tilfældigt, ikke designet.)
- **Platform:** **begge**
- **Status:** **Mistanke — skal verificeres**
- **Løsning:** Anvend fælles mønster fra Del 2.
- **Verificeres sådan:** iPhone SE. Åbn et workout → ⋯ → Change name. Feltet og "Save" skal være synlige samtidig.

### TAST-15 — HØJ: Profile — "Display name" og "Bio"
- **Navigationssti:** Bundmenu → Profil
- **Fil:** `src/Pages/ProfilePage/ProfilePage.js:553` (Display name), `:608` (Bio, multiline), `:383` (wrapper), `:673-689` ("Save profile"); stilarter: `ProfilePageStyle.js:182-196`, `:214-228`
- **Placering på skærmen:** Midt/nederst i et langt kort. Under "Bio": tegntæller, fødselsdatovælger, statusbanner og **"Save profile"**.
- **Nuværende håndtering:** Skærmen har `ThemedKeyboardProtection scroll` (`:383`), men begge felter er **rå `<TextInput>`**, ikke `ThemedTextInput`. De kalder derfor **ikke** `requestScrollToInput`, og auto-scroll udløses aldrig — heller ikke på iOS hvor mekanismen ellers virker.
- **Problem:** Selv den delvist fungerende iOS-håndtering er slået fra for netop disse to felter. `KeyboardAvoidingView`s padding gælder stadig, men uden auto-scroll bliver feltet ikke bragt frem i viewporten — brugeren skal selv scrolle. "Bio" er multiline og vokser, så den glider ned i tastaturet mens man skriver.
- **Også skjult:** Tegntælleren ved "Display name" (`:567-573`) og ved "Bio" (`:624-629`), fejlbeskeden `displayNameError` (`:575-581`), hjælpeteksten "Visible in people search" (`:583-589`) og **"Save profile"**.
- **Platform:** **begge** (Android via TAST-01; iOS pga. de rå `TextInput`)
- **Status:** **Bekræftet i kode**
- **Løsning:** Udskift begge rå `<TextInput>` med `ThemedTextInput` (behold de nuværende stilarter via `inputStyle`), så de tilslutter sig det fælles mønster. Sæt `bottomOffset` højt nok til at tegntæller + fejlbesked kommer med i synsfeltet.
- **Verificeres sådan:** iPhone + Android. Profil → tryk i "Bio" → skriv 6-8 linjer. Tegntælleren under feltet skal blive synlig. Skriv derefter et for langt "Display name" (over `PROFILE_DISPLAY_NAME_MAX_LENGTH`) — fejlbeskeden under feltet skal være synlig, ikke skjult af tastaturet.

### TAST-16 — HØJ: Workout (styrke) → sæt-tabel — "Reps", "RPE", "%", "Weight", hviletid
- **Navigationssti:** Bundmenu → (+) / Forside → et styrke-workout
- **Fil:** `…/ExerciseRow/SetList/SetList.js:589` (`ThemedEditableCell`), kaldt fra `:656` (Reps), `:665` (RPE), `:672` (rm_percentage), `:680` (Weight), `:854` (hviletid). Wrapper: `Resistance.js:630`.
- **Placering på skærmen:** **I liste** — celler i en tabel, én række pr. sæt, mange rækker pr. øvelse, mange øvelser pr. side.
- **Nuværende håndtering:** `ThemedKeyboardProtection scroll` via `Resistance.js:630`. `ThemedEditableCell:61` kalder `requestScrollToInput`. `keyboardShouldPersistTaps="handled"` kommer fra wrapperen (`ThemedKeyboardProtection.js:116`) — dækket.
- **Problem:** Dette er appens mest brugte felter — man taster vægt og reps for hvert sæt under træning. På iOS virker auto-scroll delvist (men under-løfter, se TAST-24). På Android sker der ingenting (TAST-01): tapper man på en vægt-celle i den nederste øvelse, dækker tastaturet cellen. Cellerne er små (14 pt tekst, `minWidth: 20`), så selv en lille fejl i løftet gør indholdet ulæseligt.
- **Også skjult:** Hviletids-cellen og "done"-checkboxen i samme række — som er det næste brugeren skal trykke på. Det tvinger et luk-tastatur-tryk mellem hvert sæt.
- **Platform:** **Android** kritisk; **iOS** delvist (under-løft)
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2, med undtagelse 1 i afsnit 2.5: `bottomOffset` skal være stor nok til at **hele sæt-rækken** (inkl. checkbox) er fri af tastaturet, ikke kun den enkelte celle.
- **Verificeres sådan:** Android-telefon. Start et styrketræningspas med 3+ øvelser à 4 sæt. Rul til den nederste øvelse og tryk på "Weight" i det sidste sæt. Cellen **og** dens checkbox skal være synlige. Gentag på iOS.

### TAST-17 — HØJ: Workout (løb) → interval-tabel — "DIST", "PACE", "TIME"
- **Navigationssti:** Bundmenu → (+) / Forside → et løbe-workout
- **Fil:** `src/Pages/WorkoutPage/WorkoutTypes/Run/RunSetList.js:648`, kaldt fra `:866`, `:879`, `:912` (interval-rækker) og `:1031`, `:1043`, `:1068` (pause-rækker). Wrapper: `Run.js:5008`.
- **Placering på skærmen:** **I liste** — tabelceller, én række pr. interval.
- **Nuværende håndtering:** `ThemedKeyboardProtection scroll` via `Run.js:5008`
- **Problem:** Som TAST-16. Løbeskærmen er derudover meget lang (`Run.js` er ~5.100 linjer render), så de nederste intervaller ligger langt nede.
- **Også skjult:** "Actual pace"-resultatteksten under pace-cellen (`:896-900`), som er den værdi brugeren sammenligner med mens de taster.
- **Platform:** **Android** kritisk; **iOS** delvist
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 + undtagelse 1 og 2 i afsnit 2.5 (Reanimated-baseret løft, så løbetimeren ikke stammer).
- **Verificeres sådan:** Android-telefon. Åbn et interval-løb med 8+ intervaller → rul til det nederste → tryk på "PACE". Cellen og "Actual"-teksten under den skal være synlige. Kontrollér at timeren ikke hakker når tastaturet åbner.

### TAST-18 — HØJ: Workout (løb) → sæt-redigering (bottom sheet) — "DIST", "PACE", "TIME"
- **Navigationssti:** Bundmenu → (+) / Forside → et løbe-workout → tryk på et interval-nummer → sæt-redigering
- **Fil:** `src/Pages/WorkoutPage/WorkoutTypes/Run/RunSetList.js:1414` (DIST), `:1438` (PACE), `:1463` (TIME), i `ThemedBottomSheet` fra `:1299`
- **Placering på skærmen:** **I bottom sheet.** Felterne står i et 3-kolonners grid; under dem: zone-chips og handlingsknapper (`:1479-1558`).
- **Nuværende håndtering:** Ingen i sheeten. Samme context-lækage som TAST-05 (sheeten ligger under `Run`s wrapper) ⇒ siden bagved scroller.
- **Problem:** Som TAST-05. Bottom sheet forankret til bunden; felterne dækkes.
- **Også skjult:** Zone-chips og knapperne under gridet.
- **Platform:** **iOS** kritisk; **Android** delvist (stale `SCREEN_HEIGHT`)
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 (ombygget `ThemedBottomSheet`).
- **Verificeres sådan:** iPhone + Android. Åbn et interval-løb → tryk på interval-nummer "3" → tryk i "PACE" i sheeten. Feltet skal være synligt over tastaturet.

### TAST-19 — HØJ: Workout (løb) → endurance-plan — "DURATION", "DISTANCE", "PACE"
- **Navigationssti:** Bundmenu → (+) / Forside → et endurance-løb (ikke interval)
- **Fil:** `src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js:3778` (DURATION), `:3846` (DISTANCE), `:3917` (PACE). Wrapper: `Run.js:5008`.
- **Placering på skærmen:** Midt på skærmen i et stat-kort.
- **Nuværende håndtering:** `ThemedKeyboardProtection scroll`
- **Problem:** Samme som TAST-16/17, men felterne ligger højere på skærmen, så risikoen er lavere. Derudover: `keyboardType="normal"` (`:3782`, `:3921`) er **ikke en gyldig RN-værdi** (gyldige er bl.a. `default`, `numeric`, `decimal-pad`, `number-pad`). Værdien ignoreres, og brugeren får det almindelige tekst-tastatur til et felt der forventer tid/tempo. Samme fejl findes på `RunSetList.js:884`, `:917`, `:1048`, `:1073`, `:1444`, `:1469`.
- **Også skjult:** Kun feltet.
- **Platform:** **Android** (dækning); **begge** (forkert tastaturtype)
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2. Ret desuden `keyboardType="normal"` til `"numbers-and-punctuation"` (iOS) / `"numeric"` (Android) eller `"default"` — vælg bevidst, da felterne accepterer `mm:ss`-format.
- **Verificeres sådan:** Åbn et endurance-løb → tryk i "PACE". Kontrollér både at feltet er synligt, og hvilket tastatur der vises (skal have kolon/tal, ikke fuldt QWERTY).

### TAST-20 — HØJ: Exercise library / Add exercise — "Search exercises..."
- **Navigationssti:** (a) Bundmenu → Training → Exercise library. (b) Bundmenu → (+) → et workout → Add exercise
- **Fil:** `…/ExerciseLibraryList.js:1034` (katalog-tilstand), `:394` (picker-tilstand). Container: `src/Pages/ExerciseCatalogPage/ExerciseCatalogPage.js:82-95`
- **Placering på skærmen:** Øverst, under headeren.
- **Nuværende håndtering:** **Ingen.** `ExerciseCatalogPage`s `ScrollView` (`:82`) har **hverken** `keyboardShouldPersistTaps` **eller** `keyboardDismissMode`.
- **Problem:** Feltet ligger øverst og bliver ikke dækket — men følgeproblemet er alvorligt: fordi `keyboardShouldPersistTaps` mangler (default er `"never"`), bliver det **første** tryk på en øvelse i listen opslugt af tastatur-lukningen. Brugeren skal trykke **to gange** på hver øvelse mens søgefeltet har fokus. Der er heller ingen `keyboardDismissMode`, så tastaturet lukker ikke ved at trække i listen.
- **Også skjult:** Ikke feltet, men resultatlisten skrumper til øverste halvdel af skærmen mens man søger.
- **Platform:** **begge**
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 (`ThemedKeyboardProtection` om `ExerciseCatalogPage`s indhold). Minimumsrettelse hvis man vil holde det lille: tilføj `keyboardShouldPersistTaps="handled"` og `keyboardDismissMode="on-drag"` til `ExerciseCatalogPage.js:82`. Bemærk også at listen i picker-tilstand (`ExerciseLibraryList.js:324` — `pickerShell` er en `View` uden egen scroll) og i katalog-tilstand (`:1146` — indre `ScrollView` med `nestedScrollEnabled`) er indlejrede scroll-områder; den ydre skal have `keyboardShouldPersistTaps` for at trykkene når igennem.
- **Verificeres sådan:** iPhone + Android. Training → Exercise library → tryk i søgefeltet → skriv "bench" → tryk **én gang** på et resultat. Øvelsen skal åbne ved første tryk.

### TAST-21 — HØJ: Notification settings → Custom — "Search people you follow"
- **Navigationssti:** Bundmenu → Profil → Settings → Notifications → vælg "Custom"
- **Fil:** `src/Pages/NotificationSettingsPage/NotificationSettingsPage.js:355` (felt), `:240-245` (`ScrollView` med `keyboardShouldPersistTaps="handled"`), `:366+` (resultatliste under feltet)
- **Placering på skærmen:** Midt/nederst — feltet vises kun i "Custom"-tilstand, altså efter tre radio-valg à ~70 pt plus et kort-hoved. På en telefon lander det i nederste halvdel.
- **Nuværende håndtering:** Kun `keyboardShouldPersistTaps="handled"`. Ingen `KeyboardAvoidingView`, ingen auto-scroll, ingen tastatur-padding.
- **Problem:** Søgefeltet og — vigtigere — personlisten under det bliver dækket. Brugeren søger for at finde en person, men kan ikke se resultaterne.
- **Også skjult:** **Hele resultatlisten** (`filteredProfiles`, `:366-...`). Det er det brugeren søger efter.
- **Platform:** **begge**
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2. `bottomOffset` skal være stor nok til at mindst 2-3 personrækker under feltet er synlige.
- **Verificeres sådan:** iPhone SE + Android. Profil → Notifications → vælg "Custom" → tryk i søgefeltet → skriv et bogstav. Både feltet og minimum to personrækker under det skal være synlige.

### TAST-22 — MIDDEL: 1RM Calculator — "Weight" og "Reps"
- **Navigationssti:** Bundmenu → Training → Quick tools → 1RM Calculator
- **Fil:** `src/Pages/OneRepMaxCalculatorPage/OneRepMaxCalculatorPage.js:160` (Weight), `:188` (Reps), `:116` (wrapper), `:214-219` ("Calculate estimated 1RM")
- **Placering på skærmen:** Midt — to felter side om side i et kort, med Calculate-knappen under.
- **Nuværende håndtering:** `ThemedKeyboardProtection scroll` (`:116`)
- **Problem:** Feltdækningen er dækket af TAST-01 (Android) og TAST-24 (iOS under-løft). Det specifikke problem her er **lukning af tastaturet**: begge felter er `decimal-pad` / `number-pad`, som på iOS **ikke har nogen returtast**. Der er intet tryk-udenfor-lukker og ingen "Færdig"-knap. Den eneste vej ud er `keyboardDismissMode` (`ThemedKeyboardProtection.js:117-119`), altså at trække i scrollen — hvilket ikke er en åbenlys gestus, og som ikke virker hvis indholdet er kortere end viewporten.
- **Også skjult:** Fejlbeskederne `errors.weight` / `errors.reps` (rendret under felterne af `ThemedTextInput.js:47`), enhedsteksterne "kg" / "completed" og Calculate-knappen.
- **Platform:** **iOS** (manglende returtast); **begge** (dækning)
- **Status:** **Bekræftet i kode**
- **Løsning:** Anvend fælles mønster fra Del 2 med `toolbar={true}`. Samme rettelse gælder alle numeriske felter: fund 14, 15, 46 og alle `ThemedEditableCell` (som har `keyboardType = "numeric"` som default, `ThemedEditableCell.js:11`).
- **Verificeres sådan:** iPhone. Training → 1RM Calculator → tryk i "Weight" → forsøg at lukke tastaturet uden at trykke på Calculate. Der skal findes en synlig "Færdig"-knap.

### TAST-23 — MIDDEL: iOS — tredobbelt tastaturkompensation giver layout-hop
- **Navigationssti:** Login, Register, Profil, 1RM Calculator, styrke-workout, løbe-workout
- **Fil:** `src/Resources/ThemedComponents/ThemedKeyboardProtection.js:109` (KAV padding), `:121` (`automaticallyAdjustKeyboardInsets`), `:129` (`paddingBottom: 24 + keyboardInset`)
- **Placering på skærmen:** Hele scroll-området
- **Nuværende håndtering:** Tre uafhængige mekanismer der hver kompenserer for **hele** tastaturhøjden samtidig.
- **Problem:** Indholdet løftes/pades op til tre gange så meget som nødvendigt. Symptomer: stort tomrum under indholdet, at scrollen "springer" når tastaturet åbner og lukker, og at siden ender i en forskudt position når tastaturet lukkes. På `LoginPage` forstærkes det af `scrollContent: { flexGrow: 1, justifyContent: "center" }` (`LoginPageStyle.js:35-38`) — indholdet er centreret, så al ekstra padding flytter *hele* formularen synligt op og ned.
- **Også skjult:** Intet skjules; det er et layout-hop.
- **Platform:** **iOS**
- **Status:** **Bekræftet i kode.** Alle tre mekanismer er aktive samtidigt og iOS-only.
- **Løsning:** Anvend fælles mønster fra Del 2 — kompensér **én gang, ét sted**. Fjern `automaticallyAdjustKeyboardInsets` og `contentInsetAdjustmentBehavior` (`:120-121`) og fjern `keyboardInset` fra `paddingBottom` (`:129`).
- **Verificeres sådan:** iPhone. Login-skærmen → tryk i "Email" → tryk i "Password" → luk tastaturet. Formularen må ikke hoppe, og der må ikke være et stort tomt område under "Create account". Optag skærmen i slowmotion hvis hoppet er svært at se.

### TAST-24 — MIDDEL: iOS — indholdet løftes for lidt på skærme med header
- **Navigationssti:** Profil, 1RM Calculator, styrke-workout, løbe-workout
- **Fil:** `src/Resources/ThemedComponents/ThemedKeyboardProtection.js:110` (`keyboardVerticalOffset` videreføres, men er 0 på alle 7 kaldesteder: `ProfilePage.js:383`, `OneRepMaxCalculatorPage.js:116`, `Resistance.js:630`, `Run.js:4926`, `Run.js:5008`, `LoginPage.js:95`, `RegisterPage.js:152`)
- **Placering på skærmen:** Nederste del af scroll-området
- **Nuværende håndtering:** RN's `KeyboardAvoidingView` måler sin ramme med `onLayout` (`KeyboardAvoidingView.js:125-143`), som giver koordinater **relativt til forælderen**. Padding beregnes som `frame.y + frame.height − keyboardY` (`:110`).
- **Problem:** På skærme hvor wrapperen ligger under en `ThemedHeader` bliver `frame.y ≈ 0` i stedet for header-højden. Den beregnede padding er derfor for lille med ca. header-højde + top-inset (typisk 90-130 pt). De nederste felter løftes ikke helt fri af tastaturet — de er delvist synlige, men markøren og den nyeste tekst kan ligge lige under kanten.
- **Også skjult:** Fejlbeskeder og tegntællere under de nederste felter.
- **Platform:** **iOS**
- **Status:** **Bekræftet i kode** for mekanismen. Den præcise afvigelse i punkter skal måles.
- **Løsning:** Anvend fælles mønster fra Del 2 — bibliotekets `KeyboardAvoidingView` måler mod vinduet. Hvis man vælger at beholde RN's egen: sæt `keyboardVerticalOffset` til den faktiske header-højde + `insets.top` på hvert af de 5 kaldesteder med header.
- **Verificeres sådan:** iPhone. Profil → rul ned → tryk i "Bio" → skriv til feltet er fyldt. Mål (skærmbillede + lineal) om den nederste tekstlinje er mindst 8 pt over tastaturkanten. Sammenlign med Login-skærmen, som ikke har header — der bør afvigelsen ikke findes.

### TAST-25 — MIDDEL: `ThemedBottomSheet` — hardcodet skærmhøjde
- **Navigationssti:** Alle bottom sheets: Program overview → ⋯, Workout → ⋯, sæt-indstillinger, løb-sæt-redigering, Start workout
- **Fil:** `src/Resources/ThemedComponents/ThemedBottomSheet.js:16` (`SCREEN_HEIGHT` på modul-niveau), `:19` (`SHEET_HEIGHT = SCREEN_HEIGHT * 0.95`), `:22-23` (snap-punkter)
- **Placering på skærmen:** Fast bundlinje
- **Nuværende håndtering:** Ingen. Højden er en konstant beregnet én gang da modulet blev indlæst.
- **Problem:** Sheeten kan ikke tilpasse sig et krympet vindue. På Android (hvor Modal-dialogen faktisk krymper) bliver sheeten højere end vinduet, og `SNAP_COLLAPSED = SCREEN_HEIGHT * 0.4` peger på en position der ikke længere svarer til 40 % af det synlige område. Ved enhver dimensionsændring (foldbare telefoner, ændret display-zoom, split screen) er værdien forældet indtil appen genstartes.
- **Også skjult:** Sheetens nederste indhold, inkl. felterne i TAST-05 og TAST-18.
- **Platform:** **Android** primært; **begge** ved dimensionsændringer
- **Status:** **Bekræftet i kode**
- **Løsning:** Erstat modul-konstanten med `useWindowDimensions()` inde i komponenten, og beregn `SHEET_HEIGHT` og snap-punkter mod `windowHeight − keyboardHeight`. Del af ombygningen i afsnit 2.3.
- **Verificeres sådan:** Android-telefon. Åbn sæt-indstillinger-sheeten, åbn tastaturet og luk det igen. Sheeten skal have samme højde og position før og efter. Gentag efter at have ændret systemets skriftstørrelse/display-zoom (som ændrer dp-højden).

### TAST-26 — MIDDEL: Der findes intet tryk-udenfor-lukker tastaturet
- **Navigationssti:** Alle skærme
- **Fil:** Ingen `Keyboard.dismiss()` findes i hele `src/` eller `App.js` (verificeret med udtømmende søgning). `keyboardShouldPersistTaps` mangler på: `ExerciseCatalogPage.js:82`, `ProgramOverviewPage.js:493`, `SetPage.js:135`, `ThemedBottomSheet.js:95`, `SicknessPage.js:371`, `MicrocycleList.js:1238`, `AddEstimatedSet.js:116`, `EditEstimatedSet.js` (tilsvarende linje), `PanelSettingsModal.js:71`, `ExerciseLibraryList.js:436` og `:1146`
- **Placering på skærmen:** Overalt
- **Nuværende håndtering:** Ingen global. `keyboardDismissMode` findes kun i `ThemedKeyboardProtection.js:117-119`, altså kun på 6 skærme.
- **Problem:** To symptomer. (a) Brugeren har ingen forudsigelig måde at lukke tastaturet — ingen "Færdig", intet tryk-udenfor. (b) På de 11 scroll-områder uden `keyboardShouldPersistTaps` kræver det **to tryk** at aktivere en knap mens tastaturet er fremme: det første tryk lukker kun tastaturet.
- **Også skjult:** Ikke relevant.
- **Platform:** **begge** (værst på iOS, hvor der ikke findes en systemtilbage-gestus)
- **Status:** **Bekræftet i kode**
- **Løsning:** To greb. (1) Sæt `keyboardShouldPersistTaps="handled"` på alle 11 nævnte scroll-områder. (2) Tilføj `KeyboardToolbar` fra biblioteket globalt (i `App.js` under `KeyboardProvider`), så alle felter — også de numeriske — får en "Færdig"-knap. Undgå at wrappe hele skærme i `TouchableWithoutFeedback onPress={Keyboard.dismiss}`: det bryder tilgængelighed og kolliderer med `PanResponder` i `ThemedBottomSheet`.
- **Verificeres sådan:** iPhone. På hver af de 11 skærme: åbn tastaturet fra et felt og tryk **én gang** på en knap i nærheden. Knappen skal reagere ved første tryk.

### TAST-27 — LAV: Død kode med uhåndterede felter
- **Navigationssti:** Ikke tilgængelig for brugeren
- **Fil:** `src/Pages/SetPage/SetPage.js:140,147,155,163,171` (5 felter, registreret i `App.js:376` men ingen `navigate("SetPage")` findes); `src/Pages/ExerciseLibraryPage/Components/AddExerciseStorage/AddExerciseStorageModal.js:30` (importeres ikke nogen steder)
- **Placering på skærmen:** —
- **Nuværende håndtering:** Ingen
- **Problem:** Ingen brugerpåvirkning. Men felterne dukker op i enhver fremtidig søgning efter `TextInput` og vil koste tid ved næste gennemgang. `SetPage` er desuden den eneste skærm i navigatoren med `headerShown: true` (`App.js:376`), hvilket kan forvirre.
- **Også skjult:** —
- **Platform:** —
- **Status:** **Bekræftet i kode**
- **Løsning:** Slet begge filer og fjern `SetPage`-registreringen i `App.js:376` samt importen. Ret **ikke** tastaturhåndteringen i dem.
- **Verificeres sådan:** Efter sletning: appen skal bygge, og en søgning på `SetPage` i kodebasen skal give nul resultater.

---

## Del 4 — Felter uden problemer

Disse er gennemgået og skal **ikke** røres ud over den globale rettelse.

| Felt | Fil:linje | Hvorfor det er i orden |
|---|---|---|
| Login → "Email" | `LoginPage.js:128` | Øverst i formularen, langt over tastaturkanten. `ThemedKeyboardProtection` + `ThemedTextInput` er koblet korrekt. Ingen header over wrapperen og ingen bundmenu (uautentificeret), så TAST-24 rammer ikke. Dækket af TAST-01 på Android og TAST-23 (kosmetisk hop) på iOS. |
| Login → "Password" | `LoginPage.js:143` | Samme. Andet af kun to felter i en kort formular; `secureTextEntry`-tastaturet har en returtast. |
| Register → "Username" | `RegisterPage.js:189` | Øverst i formularen. Korrekt koblet. Har `error`-prop + hjælpetekst under sig, men ligger så højt at de forbliver synlige. |
| Register → "Email" | `RegisterPage.js:211` | Midt i en kort formular, korrekt koblet. |
| Register → "Password" / "Retype password" | `RegisterPage.js:226`, `:242` | Korrekt koblet, og formularen er kort nok til at auto-scroll (iOS) rækker. På Android dækket af TAST-01. Verificér alligevel række 2 i testmatrixen, da fejlbeskeder ligger under felterne. |
| Find Friends → søgefelt | `SocialUserListPage.js:177` | **Øverst** på skærmen, direkte under headeren. `keyboardShouldPersistTaps="handled"` er sat på scrollen (`:174`), så resultatlisten reagerer ved første tryk. Resultaterne under feltet skrumper, men feltet selv dækkes ikke. |
| Social post exercises → søgefelt | `ExerciseSocialPostSettingsPage.js:209` | I `ListHeaderComponent` på en `FlatList`, altså **øverst**. `keyboardShouldPersistTaps="handled"` er sat (`:332`). Korrekt løst — dette er faktisk det bedste søgefelt i appen. |
| Note-visning (læsetilstand) | `SetList.js:1125-1131` | `ThemedModal` der kun viser tekst (`<ThemedText>{noteModalText}</ThemedText>`), intet inputfelt. Ingen tastaturrisiko. |
| Alle pickers og toggles | `ThemedDateWheelPicker`, `ThemedPicker`, `ThemedSwitch`, `ThemedSegmentedToggle`, `ThemedBouncyCheckbox`, `expo-checkbox`, `@react-native-picker/picker`, `@react-native-community/datetimepicker` | Åbner ikke softwaretastatur. Verificeret: ingen af dem indeholder `TextInput`. |
| `RunHeartRateChartPage` | `Run/RunHeartRateChartPage.js` | Ingen inputfelter. Er den eneste skærm i landskab (`App.js:324-325`) — derfor er landskab ikke et tastaturemne nogen steder. |
| `SearchPage` | `SearchPage.js` | Har `keyboardShouldPersistTaps="handled"` (`:241`) men **ingen inputfelt** — søgning ligger på `SocialUserListPage`. Prop'en er overflødig men harmløs. |
| `HomePage`, `WeekPage`, `MicrocyclePage` (selve siden), `ProgramPage`, `WorkoutLibraryPage`, `WorkoutCalendarPage`, `PersonalRecordsPage`, `NotificationHistoryPage`, `SocialPostSettingsPage`, `Walk`, `ExerciseLibraryPage` | — | Ingen inputfelter. Verificeret ved udtømmende søgning. |

---

## Afslutning

### Anbefalet rækkefølge

1. **Global konfiguration og fundament.** Tilføj `react-native-keyboard-controller`, wrap
   `App.js` i `<KeyboardProvider>`. Behold `softwareKeyboardLayoutMode: "resize"` og
   `edgeToEdgeEnabled: true` uændret. Byg en ny native binær (kan ikke leveres via OTA).
2. **Omskriv `ThemedKeyboardProtection`** (afsnit 2.3 A). Løser TAST-01, TAST-23, TAST-24 for de
   6 eksisterende skærme på én gang. Test her, før du går videre.
3. **Byg `ThemedKeyboardSheet`** og lad `ThemedModal` + `ThemedBottomSheet` bruge den
   (afsnit 2.3 B og C). Løser TAST-02 til TAST-06, TAST-09 til TAST-14, TAST-18 og TAST-25 —
   14 felter uden at ændre et enkelt kaldested.
4. **Punktrettelser i felt-komponenterne.** TAST-15 (rå `TextInput` → `ThemedTextInput` i
   `ProfilePage`), TAST-19 (`keyboardType="normal"` × 8 steder), TAST-26
   (`keyboardShouldPersistTaps` på 11 scroll-områder), TAST-22 (`toolbar` på numeriske felter).
5. **Nye wrappere på uwrappede skærme.** TAST-08 (`ProgramOverviewPage` — husk dynamisk
   bund-padding), TAST-20 (`ExerciseCatalogPage`), TAST-21 (`NotificationSettingsPage`),
   TAST-07 (`SocialPostEditPage` — erstat lokal KAV).
6. **Tabel-/listefelterne til sidst.** TAST-16, TAST-17. De er de mest brugte, men også de mest
   følsomme over for regressioner, og de afhænger af at trin 2 er stabilt.
7. **Oprydning.** TAST-27 (slet `SetPage` og `AddExerciseStorageModal`).

### Testmatrix

Enheder: **lille iOS** (iPhone SE 3. gen, 667 pt), **stor iOS** (iPhone 15 Pro Max),
**lille Android** (≤ 5,5", Android 13), **stor Android** (Android 15, edge-to-edge håndhævet),
**iPad** (`requireFullScreen: true`, floating keyboard). Alt i portræt — appen låser orientering.

Tastaturvarianter pr. enhed: (a) standard, (b) med autocomplete/QuickType-linje slået **til**,
(c) med emoji-/clipboard-række synlig, (d) tredjepartstastatur (Gboard på iOS / SwiftKey på
Android).

| # | Skærm | Felt | Skal kunne ses samtidig med feltet |
|---|---|---|---|
| 1 | Login | Email, Password | Login-knappen |
| 2 | Register | Alle 4 | Fejlbesked under det aktive felt + Register-knappen |
| 3 | Profil | Display name | Tegntæller + fejlbesked |
| 4 | Profil | Bio (skriv 8 linjer) | Tegntæller + "Save profile" |
| 5 | Profil → Send feedback | Feedback-tekst | Tegntæller + "Send Feedback" |
| 6 | Profil → Workout types → Max heart rate | Max bpm | Fejlbesked + "Save" |
| 7 | Profil → Notifications → Custom | Søgefelt | Mindst 2 personrækker |
| 8 | Training → Exercise library | Søgefelt | Resultatliste; **ét** tryk skal åbne en øvelse |
| 9 | Training → Exercise library → Add custom | Exercise name | "Next" + evt. fejlbesked |
| 10 | Training → 1RM Calculator | Weight, Reps | "Færdig"-knap; Calculate-knappen |
| 11 | Training → Sickness log → Register | Note | "Save" + "Delete sickness" |
| 12 | Training → Programs → (+) | Program name | Alle tre knapper |
| 13 | Programs → program → bunden af Settings | Program name | Blyants-ikon; feltet skal kunne løftes |
| 14 | Programs → program → Add block | Focus | "Add"; backdrop-tryk skal lukke modalen |
| 15 | Programs → program → Estimated 1RM's → (+) | Enter weight | "Add 1 RM" |
| 16 | Microcycle → marker dag syg | Note | "Save" |
| 17 | Styrke-workout | Weight i sidste sæt af nederste øvelse | Hele rækken inkl. checkbox |
| 18 | Styrke-workout → sæt-nummer | Add note (bottom sheet) | Feltet; siden bagved må ikke være forskubbet efter luk |
| 19 | Styrke-workout → tandhjul | Exercise note | "Delete Exercise" |
| 20 | Workout → ⋯ → Change name | Workout label | "Save" |
| 21 | Interval-løb | PACE i nederste interval | "Actual"-tekst; timeren må ikke hakke |
| 22 | Interval-løb → interval-nummer | PACE (bottom sheet) | Feltet + knapperne under gridet |
| 23 | Endurance-løb | PACE | Korrekt tastaturtype (tal + kolon) |
| 24 | Forside → opslag → Edit post | Note | "Save" i footeren |
| 25 | Find Friends | Søgefelt | Resultatliste; ét tryk skal virke |

For hver række: åbn tastaturet, skriv nok til at feltet er fyldt, og kontrollér at hele kolonnen
"Skal kunne ses samtidig" er synlig. Luk derefter tastaturet og bekræft at layoutet vender tilbage
til udgangspunktet uden hop og uden forskudt scrollposition.

### Risiko for følgefejl

**Ændringer i det globale fundament rammer alle 27 skærme.** Konkret:

1. **`<KeyboardProvider>` i `App.js`** ændrer inset-håndteringen for hele appen. Fordi appen er
   edge-to-edge og bruger `useSafeAreaInsets()` i `ThemedView.js:12`, `ThemedModal.js:18`,
   `ThemedBottomSheet.js:28` og `ThemedBottomNavigation.js:701`, skal **alle** skærme
   kontrolleres for dobbelt bund-padding og for at bundmenuen ikke pludselig ligger under
   navigationsbjælken. Providerens placering (uden for eller inden for `NavigationContainer`) er
   afgørende og skal testes begge veje.
2. **Bundmenuen** (`App.js:413-418`) er søskende til `NavigationContainer` i en kolonne. Hvis den
   nye keyboard-håndtering får app-roden til at krympe, ryger bundmenuen op over tastaturet og
   spiser 64 pt + inset. Tjek dette på alle skærme med felter.
3. **`ThemedModal`-ombygningen** rammer **alle** modaler — også de ~10 der ikke har inputfelter
   (bl.a. `WorkoutCopyTargetModal`, `StartProgramModal`, `PickWorkoutModal`,
   `HeartRateDeviceModal`, `CalenderPasteModal`, `RepeatWorkoutSheet`, note-visningen i
   `SetList.js:1125`). At skifte `justifyContent: "center"` → `"flex-end"` og gøre `maxHeight`
   dynamisk vil ændre deres udseende. De skal alle øjentestes.
4. **`ThemedBottomSheet`-ombygningen** rammer `PanResponder`-logikken (`:39-68`). Snap-punkterne
   beregnes i dag ud fra en konstant; gør man dem dynamiske, skal træk-gestus testes igen på alle
   5 sheets — også de to uden inputfelter.
5. **`Run.js`** er ~5.100 render-linjer med kørende timer, GPS-abonnement og BLE-pulsmåler. Enhver
   ændring i den omgivende scroll-container kan udløse re-renders der påvirker timerpræcisionen.
   Kør et fuldt interval-løb igennem efter ændringen.
6. **`automaticallyAdjustKeyboardInsets`-fjernelsen** (TAST-23) vil gøre iOS-scroll *mindre*
   polstret. Hvis nogen har tunet en `paddingBottom` visuelt oven på den nuværende
   overkompensation, vil det blive synligt som manglende luft. Gennemgå
   `scrollContent`-stilarterne på de 6 wrapper-skærme.
7. **Ny native dependency ⇒ ny binær.** Rettelsen kan ikke leveres som OTA-update. `eas.json` og
   versionsflowet (`scripts/version.js`) skal med i planlægningen.

### Kan ikke afgøres statisk

Følgende kræver at appen kører på en fysisk enhed:

1. **Om `adjustResize` faktisk er sat ud af kraft af edge-to-edge på de enheder brugerne har.**
   Mekanismen er dokumenteret Android-adfærd og koden peger entydigt på den, men den faktiske
   `getWindowVisibleDisplayFrame()`-værdi kan kun måles. Dette er den vigtigste enkeltmåling i
   hele rapporten — alt i Del 2 hænger på den. Mål ved at logge `event.endCoordinates` i
   `keyboardDidShow` og sammenligne `screenY` med `Dimensions.get("window").height`.
2. **Tastaturhøjder.** Ingen fast højde er antaget i koden (godt), men de reelle højder med og
   uden QuickType/emoji-række, og på tredjepartstastaturer, kan ikke udledes.
3. **Faktiske feltpositioner.** Alle vurderinger af "nederste halvdel" bygger på at læse
   layout-koden. Om et felt konkret ligger under tastaturkanten på en given enhed kan kun måles.
   Det gælder især TAST-11, TAST-12, TAST-13, TAST-14 og TAST-10, som er markeret som mistanke.
4. **Om `ThemedModal`s `maxHeight: 400` klipper indhold** (TAST-10, punkt b). Kræver at man tæller
   pixels på en rigtig skærm.
5. **Hvor meget for lidt iOS løfter** (TAST-24). Mekanismen er sikker; afvigelsen i punkter skal
   måles pr. skærm, da header-højderne varierer.
6. **Om `Run`-timeren stammer** ved tastaturåbning. Kun målbart under en rigtig træning.
7. **iPad-adfærd.** `requireFullScreen: true` udelukker Split View, men floating keyboard på iPad
   giver `endCoordinates.screenY === 0`, som RN's `KeyboardAvoidingView` kun håndterer når
   "Prefer Cross-Fade Transitions" er slået til (`KeyboardAvoidingView.js:88-96`). Skal testes
   eksplicit på iPad.
8. **Android-versionsforskelle.** Adfærden kan afvige mellem Android 13 (før håndhævet
   edge-to-edge) og Android 15+. Begge skal med i testen.
