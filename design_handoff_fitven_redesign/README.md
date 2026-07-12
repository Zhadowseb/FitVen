# Handoff: FitVen — visuelt redesign + light theme

## Overview
Dette er et redesign af FitVen-appen: et strammere, mere gennemgående visuelt system anvendt på tværs af skærmene, plus en ny **light mode**. Formålet er at løfte den nuværende skabelon til et ensartet, poleret look — samme layout-struktur og features som i dag, men ny visuel behandling af kort, knapper, timer, billeder, programmer og blokke/mesocykler.

## About the Design Files
Filerne i denne pakke er **design-referencer lavet i HTML** — en prototype der viser det tilsigtede look og adfærd, ikke produktionskode der skal kopieres direkte. Opgaven er at **genskabe designet i FitVens eksisterende React Native-kodebase** med de mønstre og biblioteker der allerede er i brug (theme-farver via `Colors`/`useColorScheme`, `react-native-svg`-ikoner i `UI-icons/`, eksisterende side- og komponentstruktur under `src/Pages/`).

Hver skærm i prototypen er mærket med den kildefil den svarer til (vist som lille monospace-label over hver telefon, fx `src/Pages/HomePage/HomePage.js`). Brug det som mapping til hvor ændringen hører hjemme.

## Fidelity
**High-fidelity.** Farver, typografi, spacing, radier og interaktioner er endelige. Genskab UI pixel-tæt med kodebasens egne komponenter og theme-system. Alle værdier i "Design Tokens" nedenfor er de faktiske værdier brugt i prototypen.

## ⚠️ Hvad der IKKE skal ændres (vigtigt)
Enkelte områder er med i prototypen udelukkende som **kontekst** — de skal IKKE ændres i den live app. De er nedtonet og bærer et rødt badge **"UÆNDRET — SKAL IKKE MED"** i design-filen:

1. **Home → "Latest from friends"-feed** (`HomePage.js`): feed-kortene (Mikkel/Laura-opslag med stats og top-sets) beholdes præcis som de er i dag. Rør dem ikke.
2. **Workout (Resistance) → hele øvelseslisten** (`Resistance.js`): sektionen "Exercises" med alle øvelseskort, sæt-chips, den udfoldede sæt-tabel og reorder/collapse/add-knapperne beholdes som i dag. **Kun timer-heroen øverst og bund-navigationens live-timer skal ændres på denne skærm.**

Alt andet der er med i pakken skal implementeres.

## Screens / Views
Hver skærm findes i både **dark** og **light**. Dark er standard; light er den nye variant (samme layout, oversat palette — se Design Tokens → Theme-mapping).

### 1. Home — `src/Pages/HomePage/HomePage.js`
Ny forside-hierarki (alt herunder er nyt og skal implementeres, undtagen feed'et jf. ovenfor):
- **Greeting-række**: dato-eyebrow (uppercase, `#676B76`, letter-spacing 1.8px) + "Welcome back!" (28px/800, `#F2F3F5`). Notifikations-bell i cirkel 42px med orange badge-tal.
- **Uge-strip**: 7 dags-celler i en flex-row (`gap:6px`). Hver celle: ugedag (8.5px/800), dato-tal (13px/800), status-markør nederst (grønt check for gennemført, dæmpet prik for hviledag). Dagens celle har orange fyld (`#F7742E`) med mørk tekst (`#14100C`) + skygge `0 8px 18px rgba(247,116,46,0.25)`.
- **Dagens træning som billed-hero**: kort (radius 20, `#14161C`) med et 158px højt cover-billede øverst, gradient-overlay der fader til kortfarven (`linear-gradient(180deg, rgba(20,22,28,0.1) 0%, rgba(20,22,28,0.4) 45%, #14161C 100%)`). Oven på billedet: "Today's workout"-chip (mørk pill, top-left) + type-chip "Resistance" (orange pill, top-right). Nederst i billedet: titel "Upperbody" (26px/800) + meta-række (øvelser · sæt · varighed, prikseparatorer). Under billedet: **Start workout**-knap (50px høj, orange fyld, mørk tekst, play-trekant, skygge `0 10px 24px rgba(247,116,46,0.25)`), divider, og "Up next"-række (dato-badge + "Legs" + chevron).
- **Friends activity** (flyttet OP, lige under dagens træning): sektions-header med "3 LIVE"-badge (grøn pill, blinkende prik). Vandret scroll-row af avatar-kolonner, avatar 68px med farvet ring (orange = træner nu, grøn = færdig, gul = anden aktivitet, grå = ingen, stiplet = "Add"). "You / Training now" har en **puls-ring** (se Interactions). Navn (12px/700) + status med lille prik/label under.
- **Active program snapshot**: kort med program(dumbbell-ikon i orange-tonet firkant), "Active program"-eyebrow + "Powerlifting Peak", uge-chip "Week 4 / 12", chevron, samt fremdriftsbar (orange fyld på `rgba(255,255,255,0.07)`-track) + "14 of 48 workouts completed" / "29%".
- **Latest from friends** (feed): ⚠️ UÆNDRET — kun kontekst.
- **Bund-nav**: se "Bottom navigation" nedenfor.

### 2. Profile — `src/Pages/ProfilePage/ProfilePage.js`
- Header (eyebrow "FitVen" + "Profile", overflow-menu).
- Public profile-kort: avatar 64px, "Change photo", felt-rækker (Username m. #-tag, Email, Birth date m. alders-chip), Display name-input m. tælling, Bio-textarea m. tælling, **Save profile**-knap (orange).
- Settings-kort: rækker med ikon-firkant (orange-tonet) + label + chevron: "Workout types", "Notifications", "Social posts", og **NY: "Appearance"** — se nedenfor.
- Feedback-kort, Account-kort (Log out i rød-tonet outline, App/Version-rækker).
- **NY — Appearance-række (theme switch):** måne-ikon i orange-tonet firkant (36px, radius 10), label "Appearance", og en **segmented control** til højre: `Dark / Light / Auto`. Container `#0F1116` (dark) / `#F1F2F5` (light), radius 10, padding 3px. Aktivt segment = orange fyld (`#F7742E`) + mørk tekst (`#14100C`); inaktive = `#676B76`. Bind til appens theme-state (`useColorScheme` + persistent override). "Auto" = følg system.

### 3. Programs — `src/Pages/ProgramPage/Components/ProgramList/ProgramList.js`
- Header med back-cirkel + centreret titel + orange add-cirkel (FAB-agtig, 38px).
- Sektion "Your programs" med tæller-badge.
- **Program-kort** (ny): cover-billede 140px m. gradient til kortfarve, status-pill top-left (ACTIVE = orange fyld; COMPLETE = grøn fyld m. check), type-pill top-right (mørk glas m. ikon). Under billedet: dato-range (10.5px/700, `#676B76`), titel (20px/800), meta-række (blocks · weeks · workouts m. prik-separatorer), og fremdrift ("Progress" + %/track). Aktiv = orange fyld; complete = grøn 100%.

### 4. Program Overview — `src/Pages/ProgramOverviewPage/ProgramOverviewPage.js`
- Hero-kort: titel + dato-range m. kalender-ikon + Active-pill; "Week 4 of 12" + 33% + track; to stat-felter (Total volume, Avg session) i indfældede felter (`#0F1116`).
- **Blocks som tidslinje** (mesocykler — ny): lodret timeline. Hver blok = nummer-node (28px cirkel) forbundet med lodret linje, ved siden af et blok-kort. Aktiv blok: orange node (`rgba(247,116,46,0.14)` fyld + `#F7742E` ring) og kort med orange kant (`rgba(247,116,46,0.35)`), "Active"-pill, uge-segment-indikator (4 små bars, udfyldte = orange), fremdrift. Ikke-startede blokke: neutral node/kort, "Not started"-pill, tomme uge-bars, dato-range + workouts/uge. Til sidst en **"Add block"**-node (stiplet) → "Plan the next mesocycle".
- Program bests-kort (stjerne-ikoner, est. 1RM), Estimated 1RM's-liste (redigerbare rækker + "Add 1RM"), Settings-kort (status-radios Draft/Active/Complete, Program name-input).

### 5. Workout — `src/Pages/WorkoutPage/WorkoutTypes/`
**5a. Resistance — `Resistance/Resistance.js`:**
- **Timer-hero (ny — skal implementeres):** kort m. "In progress"-pill (grøn, prik) og "Started 16:42" i toprækken. **Total elapsed er hovedtallet**, stort og centreret (56px, weight 200, `#F2F3F5`, tabular-nums) med "Elapsed time"-label. Under: sæt-linje ("6 of 22 sets" + "Upperbody") og en **segmenteret sæt-bar** — 22 lige brede segmenter (flex, gap 3px, height 6px, radius 999): grøn = færdigt sæt, orange m. glød (`box-shadow:0 0 8px rgba(247,116,46,0.6)`) = igangværende, dæmpet = resterende. Nedenunder Pause/Finish-knapper.
- **Øvelsesliste:** ⚠️ UÆNDRET — kun kontekst.
- **Pause-nedtælling hører til i bund-navigationens runde knap** (se Bottom navigation).

**5b. Run — choose focus — `Run/Run.js`:**
- "Choose your run focus" + 2×2 gitter af fokus-kort (Endurance & Base, Speed & Structure, Performance, Custom). Hvert kort: kvadratisk billede (radius 13) + titel + undertekst med varianter. Billeder fra `run-assets/`.

> Bemærk: de fire aktive run-flow-skærme (endurance/speed/performance/custom med timere og tabeller) er IKKE i denne pakke — de skal ikke ændres i den live app.

### 6. Train hub — `src/Pages/ExerciseLibraryPage/ExerciseLibraryPage.js`
- Header ("Training" + søge-cirkel).
- Quick tools: 2 billed-kort (Sickness log, Calendar) + 1RM Calculator-række.
- "Your training": stort Programs-kort (cover + "Manage your programs" + tæller-chips), Personal records-kort (stjerne, chips), Exercise library-kort (chips).

## Bottom navigation (fælles komponent — gælder alle skærme)
Fem punkter: **Profile, Social, [center-FAB], Train, Home** (aktivt punkt = orange ikon + orange label; inaktiv = `#676B76`). Over baren en 1px top-border; under en home-indicator-pille (134×5, `rgba(255,255,255,0.22)`). Center-punktet er en **hævet rund knap** (56px, orange, `margin-top:-26px`, 5px border i baggrundsfarven, skygge `0 12px 26px rgba(247,116,46,0.35)`).

### Live-timer i center-knappen (ny — nøglefeature)
Når en træning er i gang, bliver center-FAB'en til en **live-timer** (66px):
- **Puls-glød** bag knappen (ekspanderende orange cirkel, se keyframes).
- Tal + label inde i knappen (mørk tekst `#14100C`) med **blinkende prik** ved labelen.
- En **SVG fremdriftsring** rundt om knappen (r=30, stroke 3, `#F7742E` på `rgba(247,116,46,0.25)`-spor).
- Kontekst-afhængigt indhold:
  - **Styrke (Resistance):** ringen og tallet viser **hvile-nedtællingen** ("2:30 → 0:00", label "REST"); ringen tømmes i takt med pausen. (Total elapsed vises stort i hero'en, ikke her.)
  - **Interval-løb:** nedtælling til næste hvil ("REST IN"), ring tømmes.
  - **Distance/tempo-løb:** elapsed tid, ring roterer kontinuerligt som "aktiv"-indikator.

## Interactions & Behavior
- **Puls-glød** (`fvPulse`): `@keyframes` scale 1 → 1.45, opacity 0.5 → 0, 2.4s ease-out infinite. Bruges bag live-timer-FAB og bag "Training now"-avataren på Home.
- **Blink** (`fvBlink`): opacity 1 ↔ 0.2, 1s steps(1) infinite. Live-prikker og LIVE/REST-labels.
- **Spin** (`fvSpin`): 0 → 360°, lineær, bruges til den roterende timer-ring ved distance-løb.
- **Fremdriftsringe**: SVG-cirkel med `stroke-dasharray = 2πr` og `stroke-dashoffset` sat efter fraktion; `transition: stroke-dashoffset 1s linear`. I RN: brug `react-native-svg` `<Circle>` med samme dasharray/offset, animeret via `Animated`/`reanimated`.
- **Timere tikker pr. sekund** (`setInterval` 1s) — elapsed tæller op, rest/nedtælling tæller ned.
- **Segmenteret sæt-bar** opdaterer live når et sæt logges (færdig-tæller → antal grønne segmenter, næste = orange glød).
- **Theme switch** skifter hele paletten (se mapping); persistér valget, "Auto" følger `useColorScheme()`.

## State Management
- `elapsedSeconds` (tæller op mens træning kører), `restRemaining` (nedtælling, nulstilles pr. sæt/interval), `setsDone` / `totalSets`.
- `activeWorkoutType` ('resistance' | 'interval' | 'distance') → styrer hvad FAB-timeren viser (nedtælling/ring-adfærd).
- `themeMode` ('dark' | 'light' | 'auto') → persistent; opløst tema via `useColorScheme()` når 'auto'.
- Home: aktivt program + fremdrift, ugens dage m. status, venners live-status.

## Design Tokens

### Farver — Dark (standard)
- Baggrund (telefon): `#0A0B0F` · Nav-baggrund: `#0D0E13`
- Kort: `#14161C` · Indfældet felt: `#0F1116`
- Primær tekst: `#F2F3F5` · Stærk tekst: `#ECEDF1` · Sekundær: `#A4A8B3` · Dæmpet/eyebrow: `#676B76` · Deaktiveret: `#3A3D46`
- Kant/hairline: `rgba(255,255,255,0.06–0.10)` · Chip-fyld neutral: `rgba(255,255,255,0.06)`
- **Brand-orange (accent/handling): `#F7742E`** · Ink på orange: `#14100C`
- Grøn (succes/færdig): `#4ED39A` · Gul (PR/Z4): `#F2C14E` · Rød (fare/Z5): `#E85C4A` · Blå (Z2): `#4BA3DB`

### Farver — Light (theme-mapping)
Samme layout, oversat palette. Faktiske erstatninger brugt:
- `#0A0B0F → #F4F5F7` (telefon-bg) · `#0D0E13 → #F7F8FA` (nav) · `#14161C → #FFFFFF` (kort) · `#0F1116 → #F1F2F5` (felt)
- Tekst: `#F2F3F5 → #16191F`, `#ECEDF1 → #22252C`, `#A4A8B3 → #5C6270`, `#3A3D46 → #C9CDD5`
- Hairlines: `rgba(255,255,255,x) → rgba(15,17,22,x)`
- Accenter tonet mørkere for læsbarhed på hvid: grøn `#4ED39A → #1E9E6A`, gul `#F2C14E → #C08A12`, rød `#E85C4A → #D64533`, blå `#4BA3DB → #2C7FBF`
- **Orange `#F7742E` og ink `#14100C` er identiske i begge temaer.**
- Telefon-skygge: `rgba(0,0,0,0.55) → rgba(15,23,42,0.16)`

### Typografi
System-font-stack (`-apple-system, SF Pro Text, …`). Vægte primært 700/800; store timer-tal weight 200. Tal der tæller: `font-variant-numeric: tabular-nums`. Eyebrows: 9–10px, weight 800, uppercase, letter-spacing 1.4–2.2px.

### Radier
Telefon-ramme 36 · kort 20 · indfældet felt 12–14 · pills 999 · ikon-firkant 10–12 · knapper 14.

### Spacing
Skærm-padding 20px horisontalt. Sektioner adskilt 18–24px. Kort-indhold 14–18px. Gaps oftest 6/10/12px.

### Skygger
Kort/telefon: `0 32px 80px rgba(0,0,0,0.55)` (dark). Orange knapper: `0 10px 24px rgba(247,116,46,0.25)`. FAB: `0 12px 26px rgba(247,116,46,0.35)`.

## Assets
Alle billeder findes allerede i repoet under `src/Resources/Images/` og `run-assets/`; ikoner ligger i `UI-icons/` (react-native-svg). Prototypen refererer bl.a.:
- `src/Resources/Images/WorkoutTypes/ResistanceTraining/…png` (program/workout covers)
- `src/Resources/Images/WorkoutTypes/Run/program-cover-run.jpg`
- `src/Resources/Images/DarkVersion/…` (Search_people, sickness, calendar, Calculator)
- `run-assets/Endurance-base.png`, `Speed-structure.png`, `Performance-threshold.png`, `Custom.png`
Ikoner i prototypen er tegnet som inline-SVG for reference — brug de tilsvarende ikoner fra `UI-icons/` i implementeringen.

## Files
- `FitVen Handoff.dc.html` — den redigerede design-reference (kun det der skal med; UÆNDRET-områder er nedtonet og badge-markeret). Åbn i browser for at se dark+light side om side pr. skærm.
- `support.js` — runtime for at kunne åbne .dc.html-filen lokalt.
- Kildefil-stier står som label over hver skærm i prototypen.
