# FitVen — Performance-gennemgang

**Dato:** 2026-08-31
**Revideret tilstand:** working tree i `C:\Users\sebas\Desktop\FitVen\FitVen`
**Omfang:** 296 kildefiler / 88.035 linjer i `src/` + `App.js`
**Rolle:** ekstern gennemgang. Der er ikke ændret én linje kode.

Rapporten er skrevet til at kunne bruges af en kode-agent uden adgang til den samtale den blev
lavet i. Alle fund har fil:linje, hyppighed, og er mærket **Målt** eller **Formodet**.

---

## Executive summary

Den dyreste kodesti er ikke en enkelt langsom forespørgsel — det er tre 1-sekunds-loops der
genindlæser og gentegner alt, mens brugeren træner.

1. **Under en styrketræning kaldes `supabase.auth.getUser()` én gang pr. sekund.** Det er et
   rigtigt HTTP-kald til Supabase Auth (verificeret i biblioteket), ikke et lokalt opslag.
   ~3.600 auth-kald pr. times træning. Største enkeltfund.
2. **Samme 1 Hz-loop genindlæser hele øvelses- og sætlisten fra SQLite og udskifter alle
   objekt-identiteter** → hele `ExerciseList` + alle `ExerciseRow` + alle `SetList` gentegnes
   hvert sekund i hele træningen.
3. **Løbeskærmen laver O(42·N) JS-arbejde over alle GPS-punkter i render-scope**, umemoiseret.
   Efter 60 min. tracking er det ~330.000 operationer pr. sekund, voksende med turens længde.
4. **Manglende indeks på `Exercise_Instance(exercise_name)`** gør PR-opdateringen ved hvert
   "sæt udført"-tryk til en fuld scanning. **Målt: 22,9 ms pr. kald ved 50.000 sæt (desktop);
   indekset gør den 23× hurtigere.**
5. **Cloud-upload bruger 3–5 sekventielle HTTP-rundture pr. række.** 25 sæt ≈ 75–125 rundture.

Størst gevinst for mindst arbejde: PERF-1 (fjern auth-kaldet fra hot path), PERF-5 (ét indeks),
PERF-8 punkt 1 (én betingelse), PERF-3 punkt 1 (fire `useMemo`). Tilsammen få timers arbejde.

---

# Del 1 — Baseline

Reference for agenten. Ingen opgaver i dette afsnit.

## 1.1 Hvad appen er

Expo/React Native (`expo ~54`, RN 0.81.5, React 19.1). Offline-first: al data ligger i **lokal
SQLite** (`expo-sqlite`, én database pr. bruger via `getDatabaseNameForUserId`) og synkroniseres
to-vejs mod **Supabase** (Postgres + Auth).

Ingen state-manager (Redux/Zustand/React Query). Ingen data-cache-lag. Skærme kalder services
direkte og holder resultatet i `useState`, typisk genindlæst i `useFocusEffect`.

## 1.2 De vigtigste brugerflows

| # | Flow | Hvad der sker | Hvorfor det er kritisk |
|---|------|---------------|------------------------|
| **F1** | App-start → HomePage | `initializeDatabase` (migrering + repair) → 5 sync-komponenter monteres → HomePage henter 5 datasæt (2 lokale grupper, 3 netværk) | Første indtryk; hver kold start |
| **F2** | Logning af styrketræning | `WorkoutPage` → `Resistance` → `ExerciseList` → `ExerciseRow` → `SetList`. 1 Hz timer-loop. Tryk pr. sæt | **Appens kerneformål.** Længste sammenhængende skærmtid (30–90 min) |
| **F3** | Løbetræning med GPS | `Run.js` (5.169 linjer) + baggrunds-location-task ~1 Hz + BLE-pulsbælte ~1 Hz + MapView-polyline | Batteri-kritisk; arbejdet vokser med turens længde |
| **F4** | Kalender / program-navigation | `WorkoutCalendarPage` (måneds-pager), `ProgramOverviewPage`, `MicrocyclePage` | Hyppig navigation; N+1-mønstre |
| **F5** | Retur til HomePage | `useFocusEffect` genindlæser alt ved hvert fokus | Rammes mange gange pr. session |

## 1.3 Hvad jeg kunne måle her — og hvad ejeren skal måle

### Målt i dette miljø

| Måling | Metode | Resultat |
|--------|--------|----------|
| SQL-forespørgselsplaner | `sqlite3` + skema udtrukket fra `src/Database/schema/*.js` + indekser fra `db.js:41-73`, seedet 3/12/60/420/500/2.500/10.000 rækker, `ANALYZE` | Se PERF-5 og Del 3 |
| SQL-udførelsestid | samme probe, `.timer on`, 50–1.000 gentagelser | PR-forespørgsel 3,2 ms → 0,14 ms med indeks |
| Skalering | anden probe: 50.000 sæt / 2.500 øvelses-instanser / 2.100 dage / 2.500 workouts | PR-forespørgsel 22,9 ms pr. kald |
| Billeddimensioner + filstørrelser | PNG-header-læsning (`node`) | 1254×1254 / 1,28 MB vist i 48×48 |
| Assets samlet | `du -sh` | `src/Resources/Images` = 13 MB, `BodyMap` = 6,5 MB |
| Afhængighedsbrug | `grep` over `src/` + `App.js` | `@expo/ui`, `eas-cli`, `supabase` importeres 0 steder |
| Død kode | reference-scanning pr. fil | ~25 filer / ~1.000 linjer uden referencer |
| `auth.getUser()`-semantik | læst `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:1438-1460` | `_request(fetch, 'GET', ${url}/user')` — **netværkskald**, ikke cache |

Probe-databaserne blev bygget i sessionens scratchpad (`schema.sql`, `indexes.sql`, `seed.sql`,
`probe.db`, `big.db`). De er sessions-lokale og forsvinder — genopbyg med samme opskrift hvis
planerne skal verificeres igen.

**Vigtigt forbehold:** desktop-SQLite over NVMe er 5–10× hurtigere end SQLite på en
mellemklasse-Android. Gang alle SQL-tal med 5–10 for et telefon-estimat.

### Kræver at ejeren kører appen

Jeg kan ikke bygge, køre eller profilere appen her. Følgende **skal** ejeren måle:

| Skal måles | Sådan |
|-----------|-------|
| Kold-start-tid til interaktiv HomePage | `console.time` i `index.js` → `performance.now()` i HomePages første `useFocusEffect`-callback. 5 kolde starter, median |
| JS-bundle-størrelse og hvad der fylder | `npx expo export --platform android --dump-sourcemap`, derefter `npx source-map-explorer dist/_expo/static/js/android/*.hbc.map` |
| Faktisk render-frekvens i F2/F3 | React DevTools Profiler (Expo dev-client) → "Record why each component rendered". Tæl commits pr. 10 s med kørende timer |
| Netværkskald pr. minut i F2 | Expo dev-client Network-inspector, eller en `global.fetch`-wrapper der tæller pr. host+path i 60 s |
| JS-thread-frame-drops | `PerformanceOverlay` / `systrace` omkring polyline-render |
| Batteri/CPU i F3 | Android Battery Historian over en 45-min. tracket tur |
| `initializeDatabase`-varighed | `Date.now()`-delta omkring `handleInitializeDatabase` i `App.js:426-437`, på en database med realistisk historik |
| Reelle rækketal | `SELECT COUNT(*)` pr. tabel på en ægte brugerdatabase — se 1.4 |

## 1.4 Dataskala — mine antagelser

Der findes ingen produktionstal i repoet. Antagelserne nedenfor er begrundet i domænet
(program → mesocyklus → mikrocyklus → dag → workout → øvelse → sæt) og i den vedlagte
engangs-import (`zhadowsebProgramImportPayload.js:8-16`: 3 programmer, 4 mesocykler,
16 mikrocykler, 203 dage, 51 workouts, 17 øvelser, 54 sæt — én bruger, tidlig brug).

| Tabel | Ny bruger | Efter 1 år | Efter 3–5 år (tung bruger) |
|-------|-----------|------------|----------------------------|
| `Program` | 1–2 | 3–6 | 10–20 |
| `Mesocycle` | 4 | 15 | 60 |
| `Microcycle` | 16 | 60 | 300 |
| `Day` | 100 | 400 | 2.000 |
| `Workout_Type_Instance` | 50 | 250 | 1.500 |
| `Exercise_Instance` | 200 | 1.200 | 8.000 |
| `Set` | 800 | 6.000 | 40.000 |
| `LocationLog` (pr. tur) | — | 1.800–5.400 | 1.800–5.400 |
| `LocationLog` (samlet) | 0 | 150.000 | 700.000 |
| `Exercise` (delt cloud-katalog) | 7 → katalog | 200–2.000 | 200–2.000 |

**Konsekvenser for prioritering:**
- `LocationLog` pr. tur (1.800–5.400 punkter) er den tabel der bliver stor **inden for én
  session** → alt der læser hele turen gentagne gange er kritisk (PERF-3, PERF-4).
- `Set` er den tabel der vokser over år → alt der fuldscanner `Set`/`Exercise_Instance` bliver
  gradvist værre (PERF-5).
- Alle andre tabeller er små nok til at fuld scanning er gratis. **Optimér dem ikke** (Del 3).

## 1.5 Hvad der ALLEREDE er optimeret

Flere af de oplagte optimeringer er lavet. Rør dem ikke, og brug dem som mønster:

- **SQLite WAL + `busy_timeout`** sat både i appen (`db.js:1444-1447`) og i baggrunds-location-tasken
  (`App.js:80-90`), med en cachet forbindelse pr. database så GPS-batches ikke kæmper om
  skrivelåsen (`App.js:66-118`, med forklarende kommentar).
- **`recordTrackedLocations` er allerede stram** (`locationService.js:149-189`): én transaktion
  pr. GPS-batch, læser kun det seneste punkt (indekseret), springer duplikater over.
- **Kalender-indekser findes og bruges.** Målt: `SEARCH w USING INDEX
  workout_type_instance_calendar_date_idx` — udtryks-indekset på det danske datoformat matcher.
- **`ensureExerciseOrderColumn`** (`weightliftingRepository.js:30-58`) er cachet pr. database,
  så PRAGMA-tjekket kører én gang, ikke pr. forespørgsel.
- **Tekstfelter i sætlisten committer på blur, ikke pr. tastetryk** (`ThemedEditableCell.js:64-70`),
  og kun hvis værdien faktisk ændrede sig.
- **Begge contexts er korrekt memoiserede** (`ThemeContext.js:100-103`,
  `ExerciseViewSettingsContext.js:70-84`) — `useMemo` med præcise deps, settere i `useCallback`.
- **Socialt feed er pagineret** (6 pr. side, `HomePage.js:49`) med batchet like-hentning via
  `.in("post_id", postIds)` — ingen N+1 (`socialPostService.js:829-882`).
- **`getCirclePreview`** batcher aktivitets-opslag via `.in("user_id", ...)` (`socialService.js:330-333`).
- **HomePages hovedliste er en `FlatList`** med stabil `keyExtractor`, memoiseret `renderItem`
  og memoiseret header — korrekt virtualiseret.
- **Baggrunds-sync er serialiseret** med en promise-kø (`syncScheduler.js`) og en
  coalescing-guard (`weightliftingService.js:26-47`), så hurtige redigeringer ikke starter
  parallelle sync-kørsler.
- **Optimistiske UI-opdateringer** findes ved like (`HomePage.js:322-338`) og ved
  sætfelt-redigering (`SetList.js:415-421`).
- **`getRouteRegion`** bruger løkker frem for `Math.min(...array)` med en kommentar om
  argument-grænsen (`Run.js:568-577`) — nogen har allerede tænkt over store punktmængder her.

Der findes **ingen** response-cache, ingen `React.memo` på liste-rækker, ingen delta-baseret
sync (`updated_at > sidste_sync`), og ingen lazy loading af skærme.

---

# Del 2 — Fund

Sorteret efter forventet effekt, ikke efter hvor de ligger i koden.

**Effektskala:** KRITISK = brugeren venter mærkbart, eller appen bliver ustabil ved realistisk
datamængde. HØJ = tydelig forsinkelse i et af de vigtigste flows. MIDDEL = målbart, men ikke
tydeligt mærkbart i dag — bliver værre med mere data. LAV = hærdning og god praksis.

---

## PERF-1: `supabase.auth.getUser()` kaldes over netværket én gang pr. sekund under styrketræning

**Effekt: KRITISK**

- **Kategori:** netværk
- **Hvor:** `src/Services/weightliftingService.js:2909-2923` (`getAuthenticatedUserId`) ←
  `:2929-2936` (`getCurrentExerciseColumnPreferenceUserId`) ← `:3168-3181`
  (`loadWorkoutExercisesFromLocal`) ← `:3600-3624` (`getWorkoutExercises`) ←
  `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/ExerciseList.js:117`
  ← `ExerciseList.js:389-391` (`useEffect [loadExercises, refreshing]`) ←
  `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js:210-218` (`setInterval(refresh, 1000)`)
- **Hyppighed:** **interval — hvert sekund**, hele den tid en styrketrænings-timer kører
- **Problem:** `getAuthenticatedUserId` bruger `supabase.auth.getUser()`. Det er ikke et lokalt
  session-opslag: `auth-js` sender `GET {supabaseUrl}/auth/v1/user` og tager en process-lås
  undervejs. Kaldet ligger i `loadWorkoutExercisesFromLocal`, som kører på hvert 1 Hz-tick.
  Ved en 60-minutters træning bliver det ~3.600 HTTP-kald til Supabase Auth.
  Oveni: `supaBaseClient.js:35-53` wrapper `fetch` i 3 forsøg med 400/800 ms backoff — på et
  dårligt net kan hvert sekunds kald leve i op til ~1,2 s og hobe sig op mod næste tick, mens
  det konkurrerer om `processLock` med `autoRefreshToken`.
- **Målt eller formodet:** **Målt** (statisk). Kaldekæden er verificeret linje for linje.
  Netværkssemantikken er verificeret i biblioteket:
  `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:1438-1460` →
  `_request(this.fetch, 'GET', ${this.url}/user', ...)`.
  **Frekvensen i praksis er formodet indtil ejeren tæller:** sæt en tæller på `global.fetch`
  og log kald pr. minut med en kørende timer på `WorkoutPage`. Forventning: ~60/min.
- **Forventet gevinst:** fra ~3.600 auth-HTTP-kald til 0–1 pr. træning. Fjerner den største
  batteri- og dataforbrugspost i appens kerneflow, og fjerner en netværks-afhængighed fra en
  kodesti der ellers er ren offline.
- **Anbefaling:** to uafhængige rettelser, gør begge.
  1. Byt `getAuthenticatedUserId` i `weightliftingService.js` til `supabase.auth.getSession()`
     og læs `data.session?.user?.id`. Det er et rent lokalt opslag, og det er præcis hvad
     `programService.js:1336` allerede gør — de to filer er uenige om samme opgave.
     `getSession()` server-validerer ikke tokenet; det er acceptabelt her, fordi bruger-id'et
     kun bruges til at slå lokale kolonne-præferencer op.
  2. Uafhængigt: send bruger-id'et ind i `loadWorkoutExercisesFromLocal` frem for at slå det
     op indefra, eller cache det i modulet indtil auth-tilstanden skifter. Så er kaldet ude af
     hot path uanset auth-metode.
  Tjek også `socialPostService.js:354`, der bruger samme `getUser()`-mønster. Den ligger ikke
  i et interval, så den er mindre presserende, men det er samme uoverensstemmelse.
- **Risiko:** Lav. `getSession()` returnerer `null` hvis sessionen mangler — den eksisterende
  `try/catch` i `:2930-2935` falder allerede tilbage til
  `LOCAL_EXERCISE_COLUMN_PREFERENCE_USER_ID`, så fallback-stien findes.
  **Verificér:** kolonne-præferencer gemmes og indlæses stadig korrekt pr. bruger. Test:
  log ind som A, ændr synlige kolonner, log ud, log ind som B, åbn samme øvelse — B må ikke
  se A's præferencer.
- **Indsats:** Lille

---

## PERF-2: Hele øvelses- og sætlisten genindlæses og gentegnes hvert sekund under træning

**Effekt: KRITISK**

- **Kategori:** rendering
- **Hvor:**
  - `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js:100-102` (`refresh` bumper `refreshing`)
  - `Resistance.js:210-218` (`setInterval(() => refresh(), 1000)` mens `isRunning`)
  - `Resistance.js:204-207` (`useEffect [refreshing]` → `loadCompletedSets()` **og** `loadTotalSets()`)
  - `src/Pages/.../ExerciseList/ExerciseList.js:389-391` (`useEffect [loadExercises, refreshing]`)
  - `ExerciseList.js:110-130` (`loadExercises` → `getWorkoutExercises`)
  - `ExerciseList.js:83-96` (`applyLoadedExercises` → `setExercises` + `setExpandedExercises`)
- **Hyppighed:** **interval — hvert sekund**, hele træningen igennem
- **Problem:** Timeren bumper en tæller hvert sekund. Tælleren er dependency i to effects.
  1. I `Resistance` kaldes `loadCompletedSets()` og `loadTotalSets()`. **Begge** kalder
     `weightliftingService.getStrengthWorkoutSummary` (`:2861-2875`), som kører de samme to
     COUNT-forespørgsler. Samme data hentes dobbelt hvert sekund for at sætte to felter der
     kommer fra det samme svar.
  2. I `ExerciseList` genindlæses **alle** øvelser og **alle** sæt for workouten
     (`loadWorkoutExercisesFromLocal`: 3 forespørgsler + kortlægning), og resultatet lægges i
     `setExercises()` som **helt nye objekter**. Ingen `ExerciseRow` eller `SetList` er
     `React.memo`, og alle props er nye identiteter → hele undertræet rekoncilieres.
     `setExpandedExercises` bygger også et nyt objekt hvert sekund (`:85-95`).

  Med 6 øvelser × 4 sæt betyder det, at ~30 komponenter med talfelter, ikoner og SVG'er
  gentegnes 1× pr. sekund i 45+ minutter — mens brugeren skal kunne trykke og skrive i dem.
  Et sekundtal på skærmen kræver at ét tekstelement opdateres, ikke at hele datamodellen
  genindlæses.
- **Målt eller formodet:** **Delvist målt.** Kaldekæden og dependency-arrays er læst og
  bekræftet. **Databasedelen er målt til at være gratis:** 60 gentagelser af
  `getExercisesByWorkout` + `getSetsByWorkout` mod en 50.000-sæt-probe tog under 2 ms i alt.
  **SQL er altså ikke problemet — render-arbejdet er.**
  **Det skal ejeren måle:** React DevTools Profiler på `WorkoutPage` med kørende timer,
  10 s optagelse. Bekræft at `ExerciseList` og hver `SetList` får ~10 commits, og læs
  "why did this render".
- **Forventet gevinst:** fra ~60 fulde liste-genindlæsninger + træ-gentegninger pr. minut til 0.
  Fjerner 5 SQLite-forespørgsler pr. sekund (3 i `ExerciseList` + 2×2 i `Resistance`, hvoraf
  halvdelen er duplikater) og fjerner PERF-1's auth-kald i samme greb. Bør give mærkbart mere
  responsive tryk og lavere batteriforbrug i appens længste flow.
- **Anbefaling:**
  1. Skil "urets tick" fra "datas tick". Lad intervallet kun opdatere en tid-state der bruges
     af tidsvisningen, og lad `refreshing` udelukkende bumpes af faktiske datamutationer
     (sæt udført, sæt tilføjet/slettet, felt redigeret) — det sker allerede via `updateUI`,
     som `SetList` kalder efter hver ændring.
  2. Slå `loadCompletedSets` og `loadTotalSets` sammen til ét kald der sætter begge felter fra
     ét `getStrengthWorkoutSummary`-svar.
  3. Pak `ExerciseRow` og `SetList` i `React.memo` og giv dem stabile callbacks (`useCallback`)
     og stabile style-objekter. Dette er en forudsætning for at punkt 1 giver fuld effekt.
  4. Overvej at lade `applyLoadedExercises` bevare objekt-identitet for uændrede rækker
     (sammenlign pr. `exercise_id` + `sync_version` og genbrug det gamle objekt) — så bliver
     selv en genindlæsning billig.
- **Risiko:** Middel — det er appens vigtigste skærm. Den reelle fare er at en datamutation
  der i dag "tilfældigvis" blev opdaget af 1 Hz-pollingen holder op med at blive vist.
  Kortlæg derfor alt der i dag afhænger af pollingen: sæt-tællere i headeren, øvelsers
  done-flag, og PR-markeringer sat af `refreshPersonalRecordsForSet`. Hvile-timeren har sin
  egen tick (`Resistance.js:227-237`) og er uberørt.
  **Verificér:** (a) marker et sæt udført → tæller og done-flag opdateres straks,
  (b) tilføj/slet et sæt → listen opdateres, (c) rediger vægt så en PR opstår → PR-badge vises,
  (d) baggrund/forgrund midt i træning → tid og data er korrekte, (e) hvile-timeren tæller ned.
- **Indsats:** Middel

---

## PERF-3: Løbeskærmen laver O(42·N) arbejde over alle GPS-punkter i render-scope

**Effekt: KRITISK**

- **Kategori:** rendering
- **Hvor:** `src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js:1914-1917`:
  ```
  const routeSegments    = splitLocationRouteSegments(locationLogs);  // def. :481-516
  const routeRegion      = getRouteRegion(routeSegments);             // def. :568-608
  const routeCoordinates = routeSegments.flat();
  const paceHistory      = buildPaceHistory(locationLogs);            // def. :521-566
  ```
  Ingen af de fire er i `useMemo`. Forbrugt af `<MapView>`/`<Polyline>` på `:3303-3339`.
- **Hyppighed:** **hver render** af `Run` — og `Run` gentegnes mindst 1×/sek. via `set_timerTick`
  (`:1619-1623`), plus én gang pr. pulsmåling fra BLE-bæltet (`setCurrentHeartRate`, ~1 Hz),
  plus hver gang `set_locationLogs` kaldes (hver 2. sek., PERF-4). Realistisk 2–3 fulde
  renders pr. sekund.
- **Problem:** `buildPaceHistory` er den værste. Den kopierer og sorterer hele arrayet, og
  kører derefter en løkke med 42 iterationer, hvor **hver** iteration laver
  `orderedLogs.filter(...)` over hele arrayet (`:543-549`) plus et fuldt
  `calculateTrackedDistanceSummary` på vinduet. Det er ~42·N operationer.
  `splitLocationRouteSegments` kopierer og sorterer arrayet igen. `getRouteRegion` og `.flat()`
  går hver igennem alle punkter.

  Med et 1 Hz-GPS-log er N ≈ 1.800 efter 30 min. og ≈ 3.600 efter 60 min.:

  | Turlængde | N | Arbejde pr. render | Ved 2 renders/sek. |
  |-----------|---|--------------------|--------------------|
  | 10 min | 600 | ~28.000 ops | ~56.000 ops/sek. |
  | 30 min | 1.800 | ~83.000 ops | ~166.000 ops/sek. |
  | 60 min | 3.600 | ~166.000 ops | **~330.000 ops/sek.** |

  Arbejdet vokser lineært med turens længde, så skærmen bliver gradvist mere hakkende jo
  længere brugeren løber — værst til sidst. Dertil får `<Polyline coordinates>` en ny
  array-identitet ved hver render, så kortlaget re-differ alle koordinater over broen.
- **Målt eller formodet:** **Målt** (algoritmisk, ved læsning). Den indlejrede `filter`-i-løkke
  på `:543-549` og de to `[...logs].sort()` på `:484` og `:522` er utvetydige. Tabellens
  ops-tal er beregnede, ikke tidsmålte.
  **Sådan verificeres den faktiske tid:** gennemfør en tracket tur på 30+ min. (eller seed
  `LocationLog` med 3.600 rækker for en workout og åbn skærmen), læg `performance.now()`
  omkring de fire kald på `:1914-1917` og log deltaet. Sammenlign med 16,7 ms — budgettet for
  60 fps.
- **Forventet gevinst:** De fire værdier ændrer sig kun når `locationLogs` ændrer sig
  (hver 2. sek.), aldrig når `timerTick` eller pulsen ændrer sig. Memoisering alene fjerner
  50–70 % af kaldene. Omskrivning af `buildPaceHistory` fra 42 fulde `filter`-gennemløb til
  ét glidende vindue reducerer resten fra ~42·N til ~N — altså ~40× på selve funktionen.
- **Anbefaling:**
  1. Pak alle fire i `useMemo` med `[locationLogs]` som eneste dependency. Billigste halvdel
     af gevinsten; lav den først.
  2. Skriv `buildPaceHistory` om til et glidende vindue (to indeks der rykker frem) i stedet
     for `filter` pr. sample. Undgå også `Math.max(...timestamps)`-spread i
     `calculatePaceForLogWindow` (`:451-453`) — både langsomt og en risiko for
     argument-grænsen på store vinduer.
  3. Sortér ikke i render. Punkterne kommer allerede sorteret ud af `getLocationLogsByWorkout`
     (`ORDER BY timestamp ASC, id ASC`), så begge `[...logs].sort()` er overflødigt arbejde
     over en kopi af hele arrayet.
  4. Overvej at decimere polylinjen til kortet (Douglas-Peucker eller "hvert n'te punkt"
     afhængigt af zoom). Et kort på 400 px kan ikke vise 3.600 punkter.
- **Risiko:** Lav for punkt 1 og 3. Middel for punkt 2 — tempohistorikken er en synlig graf,
  så sammenlign output før og efter på det samme datasæt og bekræft at kurven er identisk
  (samme antal punkter, samme x/y inden for afrundingsfejl). Punkt 4 ændrer kortets udseende
  bevidst; verificér at ruten stadig følger vejen ved fuld zoom.
- **Indsats:** Lille (punkt 1+3) / Middel (punkt 2+4)

---

## PERF-4: Alle GPS-punkter læses fra databasen og distancen genberegnes hver 2. sekund

**Effekt: HØJ**

- **Kategori:** netværk (lokal I/O) + rendering
- **Hvor:** `src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js:1639-1648`
  (`setInterval(loadTrackedRunSummary, 2000)`) → `:1181-1211` →
  `src/Services/locationService.js:125-127` → `src/Repository/locationRepository.js:1-9`
  (`SELECT * FROM LocationLog WHERE workout_id = ?`)
- **Hyppighed:** **interval — hver 2. sekund** under en aktiv tur
- **Problem:** Hvert tick:
  1. Læser **alle** rækker for turen med `SELECT *` (ikke kun de nye).
  2. Kører `calculateTrackedDistanceSummary` over hele arrayet (`:1190`).
  3. Kører `getLogsFromTimestamp` (fuldt `filter`) + endnu et `calculateTrackedDistanceSummary`
     for det aktive segment (`:1193-1198`).
  4. Kører `getRecentPaceMinutes` (`:1204`), som selv laver op til to `filter` + to
     distance-beregninger (`:467-478`).
  5. Kalder `set_locationLogs(logs)` med et nyt array → udløser PERF-3's render-arbejde.

  Distancen er per konstruktion additiv: nye punkter ændrer ikke afstanden mellem gamle
  punkter. Alligevel genberegnes hele turen fra punkt 0 hver 2. sekund. Over en
  60-minutters tur bliver det ~1.800 ticks × gennemsnitligt ~1.800 punkter ≈ **3,2 millioner
  haversine-beregninger og ~1.800 fulde tabellæsninger** for information der kunne være
  vedligeholdt inkrementelt. Kompleksiteten er kvadratisk i turens længde.
- **Målt eller formodet:** **Målt** (algoritmisk). Intervallet, forespørgslen og de fire
  gennemløb pr. tick er læst direkte.
  **Den absolutte tid pr. tick er formodet — verificér** med `performance.now()` omkring
  `loadTrackedRunSummary` under en 45-min. tur, og log tiden hvert 5. minut sammen med
  `logs.length`. Forventning: tiden vokser lineært gennem turen.
- **Forventet gevinst:** fra O(N) pr. tick til O(nye punkter) pr. tick. På en 60-min. tur går
  det samlede arbejde fra ~3,2 mio. til ~3.600 segmentberegninger — tre størrelsesordener.
  Fjerner også ~1.800 fulde tabellæsninger, og skærmen bliver ikke langsommere jo længere
  man løber.
- **Anbefaling:**
  1. Gør distance-akkumuleringen inkrementel: hold `lastProcessedTimestamp` og hent kun
     `WHERE workout_id = ? AND timestamp > ?`. Læg de nye segmenters distance til en akkumuleret
     total. Filtreringslogikken i `analyzeTrackedDistance` (`src/Utils/locationUtils.js`) er
     allerede sekventiel og bruger kun forrige ankerpunkt, så den kan videreføres med bevaret
     tilstand i stedet for at starte forfra. Brug `timestamp` (ikke `id`) som inkrement, så det
     eksisterende `location_log_workout_timestamp_idx` (`schema/location.js:27-28`) kan bruges.
  2. Hold ikke hele `locationLogs`-arrayet i React-state udelukkende for kortets skyld —
     append til en ref, og lad kun kortets koordinat-array være state (gerne decimeret,
     PERF-3 punkt 4).
  3. Erstat `SELECT *` med de kolonner der faktisk bruges (`id`, `latitude`, `longitude`,
     `accuracy`, `timestamp`). Lille gevinst, men gratis at rette.
- **Risiko:** Middel — distancen er turens vigtigste tal og må ikke drifte. Fælder der skal
  håndteres: sporings-pauser (null-koordinater indsat af
  `locationRepository.createLocationTrackingBreak`), genstart af sporing efter et provider-drop
  (`locationService.js:216-235`), og at appen kan være dræbt og genstartet midt i turen (så
  skal totalen kunne rekonstrueres fra databasen ved mount).
  **Verificér:** kør den nye inkrementelle beregning og den nuværende fulde beregning parallelt
  bag et flag i et par testture og assert at totalerne er identiske inden for 1 m — inklusive
  en tur med en bevidst pause og en tur hvor appen killes og genåbnes.
- **Indsats:** Middel

---

## PERF-5: Manglende indeks på `Exercise_Instance(exercise_name)` gør hvert "sæt udført"-tryk til en fuld scanning

**Effekt: HØJ** (KRITISK ved >20.000 sæt)

- **Kategori:** database
- **Hvor:**
  - `src/Repository/weightliftingRepository.js:92-140` (`getCompletedStrengthSetsForPersonalRecords`)
  - `src/Repository/weightliftingRepository.js:1888-1898` (`getPersonalRecordFlagsByExerciseName`)
  - Kaldt fra `src/Services/weightliftingService.js:767-806`
    (`refreshPersonalRecordsForExerciseName`) ← `:808-815` (`refreshPersonalRecordsForSet`) ←
    `:3963-3979` (`updateStrengthSetDone`) og `:4045-4058` (`updateSetField`)
  - Tabel/kolonne: `Exercise_Instance(exercise_name)`, defineret
    `src/Database/schema/weightlifting.js:34`, uden indeks
- **Hyppighed:** **pr. brugerhandling i det vigtigste flow** — hvert tryk på "sæt udført", og
  hver commit af `weight` eller `reps`. En træning med 6 øvelser × 4 sæt = ~24 done-tryk +
  op til ~48 feltredigeringer ≈ **50–70 kald pr. træning.** Kaldet ligger inde i transaktionen
  (`:3966-3972`), så brugeren venter på det.
- **Problem:** Begge forespørgsler filtrerer på `e.exercise_name = ?`. Der er intet indeks på
  kolonnen, så SQLite kan ikke søge — den scanner hele `Exercise_Instance` og laver derefter
  et indeks-opslag i `Set` pr. række. PR-opdateringen kører altså to fulde scanninger af
  brugerens komplette øvelseshistorik ved hvert tryk, og prisen vokser hele appens levetid.
- **Målt eller formodet:** **Målt.** Probe-database bygget fra det faktiske skema + de
  faktiske indekser fra `db.js:41-73`, seedet og `ANALYZE`'et.

  Plan uden indeks (begge forespørgsler):
  ```
  |--SCAN e
  `--SEARCH s USING COVERING INDEX set_calendar_exercise_record_idx (exercise_instance_id=?)
  ```
  Plan med `CREATE INDEX ON Exercise_Instance(exercise_name)`:
  ```
  |--SEARCH e USING COVERING INDEX <nyt indeks> (exercise_name=?)
  `--SEARCH s USING COVERING INDEX set_calendar_exercise_record_idx (exercise_instance_id=?)
  ```
  Tider (50 gentagelser, desktop, `sqlite3` CLI):

  | Datasæt | Uden indeks | Med indeks | Faktor |
  |---------|-------------|------------|--------|
  | 10.000 sæt / 2.500 øvelses-instanser | 161 ms (3,2 ms/kald) | 7 ms (0,14 ms/kald) | **23×** |
  | 50.000 sæt / 2.500 øvelses-instanser | 1.143 ms (**22,9 ms/kald**) | ikke målt | — |

  På en mellemklasse-Android (gang med 5–10) svarer 22,9 ms til **~110–230 ms pr. tryk**, ×2
  fordi der er to forespørgsler. Det er en tydeligt mærkbar forsinkelse.
  **Ejeren skal bekræfte skalaen:** kør `SELECT COUNT(*) FROM "Set"` på en rigtig
  brugerdatabase. Under ~5.000 sæt er dette MIDDEL, ikke HØJ.
- **Forventet gevinst:** ~23× på to forespørgsler der kører 50–70 gange pr. træning.
  Fjerner en omkostning der ellers vokser lineært for evigt.
- **Anbefaling:** Tilføj et indeks på `Exercise_Instance(exercise_name)` i
  `ensureCalendarPerformanceIndexes` i `db.js:41-73` — funktionen er allerede idempotent og
  `IF NOT EXISTS`-baseret, så det er det rette sted. Overvej
  `(exercise_name, exercise_instance_id)` så opslaget bliver dækkende for join-nøglen.
  `getProgramExerciseNames` og PR-siden bruger samme filter og får gevinsten gratis.
- **Risiko:** Meget lav. Et indeks ændrer ikke resultater. Prisen er skriveomkostning ved
  insert/update af `Exercise_Instance` og lidt diskplads — begge ubetydelige, fordi tabellen
  er lille (tusinder af rækker) og `exercise_name` sjældent ændres.
  **Verificér:** kør `EXPLAIN QUERY PLAN` på de to forespørgsler på en rigtig database og
  bekræft `SEARCH e USING ... INDEX`. Bekræft at PR-badges stadig sættes korrekt (log et sæt
  der slår en tidligere PR, og et der ikke gør).
- **Indsats:** Lille

---

## PERF-6: Cloud-upload bruger 3–5 sekventielle HTTP-rundture pr. række

**Effekt: HØJ**

- **Kategori:** netværk
- **Hvor:**
  - `src/Services/programService.js:5500-5563` (`findCloudRecordByIdentity` — op til 3 opslag)
  - `programService.js:5570-5662` (`syncDirtyLocalRowToCloud` — + 1 mutation + 1 watcher-upsert)
  - `programService.js:4517-4600` (`uploadDirtySets` — sekventiel `for`-løkke)
  - `programService.js:762-825` (`ensureExerciseInstanceCloudIdentity` — endnu et opslag,
    kaldt **pr. sæt** på `:4538-4542`)
  - Samme mønster i `uploadDirtyPrograms`, `uploadDirtyMesocycles`, `uploadDirtyMicrocycles`,
    `uploadDirtyDays`, `uploadDirtyWorkoutTypeInstances`, `uploadDirtyExerciseInstances`
  - Orkestrering: `programService.js:1655-1701` (`pushDirtyProgramHierarchyWithCloudInternal`)
- **Hyppighed:** **i loop** — én iteration pr. ændret række. Udløses efter hver datamutation
  via `pushDirtyStrengthHierarchyInBackground` (`weightliftingService.js:26-47`), og ved hver
  `AppState → active` via `SetSync.js:59-71`
- **Problem:** For hvert ændret sæt:
  1. `ensureExerciseInstanceCloudIdentity` → 1 opslag (forælderens cloud-id)
  2. `findCloudRecordByIdentity` → 1–3 opslag (efter `id`, så `sync_id`, så legacy-lokal-id)
  3. `insert` eller `update` → 1 kald
  4. `claimCloudWatcher` → 1 upsert

  = **4–6 rundture pr. sæt**, kørt sekventielt med `await` i en `for`-løkke. Ved 100 ms latens
  og 25 nye sæt: **10–15 sekunder.** Alle 7 tabeller i hierarkiet gør det samme.

  To specifikke spild oveni:
  - `ensureExerciseInstanceCloudIdentity` kaldes pr. **sæt**, ikke pr. **øvelse**. 25 sæt
    fordelt på 5 øvelser giver 25 identitets-opslag hvor 5 var nok. Kan caches i et `Map`
    pr. kørsel.
  - `getSetsForCloudSync` (`weightliftingRepository.js:1304-1331`) hentes **uden**
    `WHERE needs_sync = 1` og filtreres derefter i JS (`programService.js:4531-4533`).
    Hele `Set`-tabellen læses fra disk for at finde de få dirty rækker. Samme mønster i
    `getExercisesForCloudSync` og de øvrige.
- **Målt eller formodet:** **Målt** (statisk, ved læsning af kaldegrafen). Rundture pr. række
  er talt direkte i koden.
  **Latenskonsekvensen er formodet og skal måles:** log antal `fetch`-kald og samlet varighed
  for én `pushDirtyStrengthHierarchyWithCloud` efter en afsluttet træning med kendt antal nye
  sæt. Beregn rundture/række og sammenlign med 4–6.
- **Forventet gevinst:** En batch-upsert med `onConflict: sync_id` erstatter 4–6 rundture pr.
  række med **1–2 rundture for hele batchen.** Ved 25 sæt: fra 100–150 kald til 2.
  `claimCloudWatchers` (flertal, `:1378-1441`) er allerede batchet og viser at mønsteret virker
  i denne kodebase — det er kun `syncDirtyLocalRowToCloud`-stien der er pr. række.
- **Anbefaling:**
  1. Filtrér i SQL: tilføj `WHERE needs_sync = 1` til `get*ForCloudSync`-forespørgslerne
     (og et indeks på `needs_sync` hvis en måling viser at scanningen koster).
     Nem, isoleret rettelse.
  2. Cache forældre-identiteter pr. kørsel i et `Map` i `uploadDirtySets`, så
     `ensureExerciseInstanceCloudIdentity` kaldes én gang pr. øvelses-instans.
  3. Erstat "slå op, så indsæt/opdatér" pr. række med en batch-`upsert` på `sync_id`
     (`sync_id` er allerede en global identitet — se `backfillSyncStateColumns`,
     `db.js:104-134`). Kræver en unik constraint på `(user_id, sync_id)` i Supabase.
     Behold den nuværende pr.-række-sti som fallback for konflikter. Chunk batchen (fx 200
     rækker) så en enkelt request ikke bliver for stor.
- **Risiko:** **Høj for punkt 3.** Dette er kernen i to-vejs-synkroniseringen, og der ligger
  reel konfliktlogik i den nuværende sti (`compareEntitySyncVersions` på `:5591-5607` lader
  cloud vinde ved højere `sync_version`). En naiv batch-upsert vil overskrive nyere cloud-data.
  **Lav punkt 1 og 2 først** — de er lavrisiko og giver måske nok.
  Punkt 3 kræver: test af to-enheds-scenarie (samme bruger, to enheder, samtidige ændringer af
  samme sæt), test af sletning under upload, test af delvist mislykket batch, og verifikation
  af at `Sync_Watchers` stadig får sine rækker. Overvej implementering bag et flag med parallel
  skyggekørsel før udrulning.
- **Indsats:** Lille (punkt 1+2) / Stor (punkt 3)

---

## PERF-7: HomePage beregner dagens snapshot to gange og kører ~28 forespørgsler ved hver visning

**Effekt: HØJ**

- **Kategori:** netværk
- **Hvor:**
  - `src/Pages/HomePage/HomePage.js:491-497` (`useFocusEffect` → tre loaders, ingen guard)
  - `HomePage.js:159-201` (`loadCirclePreview`) → `programService.getTodayActivitySummary`
    (`programService.js:5450-5451`) → **`getTodayWorkoutSnapshots`**
  - `HomePage.js:210-231` (`loadHomeSnapshot`) → **`programService.getTodayWorkoutSnapshots`**
    direkte (`:220`)
  - `programService.js:5783-5806` (`getTodayProgramSnapshots` — N+1 over programmer)
  - `programService.js:5418-5447` (`getTodayProgramSnapshot`)
  - `programService.js:5185-5224` (`buildWorkoutPreview` — 2 forespørgsler pr. workout)
  - `HomePage.js:224-227` (180-dages hentning for at finde **én** kommende workout, brugt på `:305-306`)
- **Hyppighed:** **pr. skærmvisning** — `useFocusEffect` uden tids- eller dirty-guard, så det
  kører hver gang brugeren vender tilbage til Home fra en vilkårlig anden skærm. Hyppigst
  ramte kodesti udenfor selve træningen.
- **Problem:** Tre ting på én gang.

  **(a) Dobbelt beregning.** `getTodayActivitySummary` kalder internt `getTodayWorkoutSnapshots`
  (`:5451`), og `loadHomeSnapshot` kalder samme funktion direkte (`:220`). Begge affyres i samme
  `useFocusEffect`, uden delt resultat. Hele dagens snapshot bygges to gange.

  **(b) N+1 inde i snapshottet.** `getTodayWorkoutSnapshots` → `getProgramsOverview` (1 tung
  aggregering), derefter **pr. program**: `getProgramStatus` + `getDayByProgramAndDate` +
  `getWorkoutsByDayId` + `getSetDoneStatesByDayId`, og derefter **pr. workout**:
  `buildWorkoutPreview` = 2 forespørgsler. Med 2 aktive programmer × 1 workout ≈ 13
  forespørgsler, plus dagens kalender-hentning og dens previews. **×2 for dobbeltberegningen
  ≈ 28 SQLite-forespørgsler.** Dertil `getProgramsOverview` en tredje gang fra
  `loadHomeSnapshot` (`:228`).

  **(c) 180 dage hentet for at bruge 1 række.** `HomePage.js:224-227` henter alle workouts fra
  i morgen til +180 dage og gør derefter `upcomingWorkouts.find(w => w.done !== 1)`.
  Hver returneret række kører desuden `workoutHasPersonalRecordSql`-underforespørgslen
  (`programRepository.js:60-72`).

  Oveni kører 4 netværkskald i samme greb (`getCirclePreview`, `getUnreadNotificationCount`,
  `getWorkoutSummaryFeed`, plus auth). Ingen af dem caches.
- **Målt eller formodet:** **Dobbeltberegningen og N+1'et er målt** (statisk — kaldegrafen er
  læst linje for linje, og de to indgange til `getTodayWorkoutSnapshots` er bekræftet).
  **Den absolutte tid er formodet, og delen om 180 dage viste sig billig:** en probe med
  2.100 dage / 2.500 workouts kørte 180-dages-forespørgslen inkl. PR-underforespørgslen 20
  gange i under måletærsklen (<0,5 ms/kald). Det samme gælder `getProgramsOverview` (se D2).
  **SQL-tiden er altså ikke problemet — antallet af tur-retur mod databasen, netværkskaldene
  og den dobbelte JS-behandling er.**
  **Sådan måles det rigtigt:** wrap `db.getAllAsync`/`getFirstAsync` midlertidigt i en tæller,
  naviger Home → Kalender → Home, og log antal forespørgsler og samlet tid pr. fokus.
  Log samtidig antal `fetch`-kald.
- **Forventet gevinst:** Halvering af det lokale arbejde ved at dele ét snapshot (fra ~28 til
  ~14 forespørgsler). Yderligere reduktion til ~5–6 ved at samle N+1'et. `LIMIT 1` på "næste
  workout" fjerner op til ~180 rækker og lige så mange PR-underforespørgsler. En focus-guard
  fjerner størstedelen af gentagelserne ved hurtig frem-og-tilbage-navigation.
- **Anbefaling:**
  1. Beregn dagens snapshot **én gang** i `loadHomeSnapshot` og send det ind i
     aktivitets-opsummeringen. Giv `getTodayActivitySummary` en valgfri `snapshots`-parameter,
     så den kan genbruge et eksisterende resultat. Største gevinst for mindst arbejde her.
  2. Erstat 180-dages-hentningen med en dedikeret repository-funktion
     `getNextUnfinishedWorkoutAfter(date)`: `WHERE done = 0 AND date > ? ORDER BY date_iso ASC
     LIMIT 1`. Udelad `has_personal_record` — feltet bruges ikke i "up next"-kortet.
  3. Skriv `getTodayProgramSnapshots` om til at hente dagens rækker for alle programmer i én
     forespørgsel (join `Program` → `Day` → `Workout_Type_Instance` filtreret på dato) og
     gruppere i JS, i stedet for at løkke pr. program.
  4. Læg en guard på `useFocusEffect`: spring genindlæsning over hvis der er gået under fx
     30 sekunder, med mindre en mutation har markeret data som dirty. Behold en
     pull-to-refresh så brugeren altid kan tvinge en opdatering.
  5. `buildWorkoutPreview` (`:5185-5224`) henter både øvelser **og** alle sæt for at bygge en
     tekst-opsummering. Hvis kun antal og navne vises, kan sætdelen erstattes af en aggregeret
     COUNT i samme forespørgsel.
- **Risiko:** Lav til middel. Punkt 1 og 2 er isolerede. Punkt 4 er den risikable: hvis guarden
  er for aggressiv, viser Home forældede data efter en ændring lavet på en anden skærm.
  Bind derfor invalidering til de faktiske mutationspunkter (`updateStrengthSetDone`,
  `createWorkoutForDay`, `copyWorkoutToDate`, sygdomsregistrering) frem for kun til tid.
  **Verificér:** afslut en træning → gå til Home → hero-kortet viser "gennemført"; opret en
  workout i kalenderen → Home viser den under "up next"; registrér sygdom → uge-stripen
  opdateres.
- **Indsats:** Middel

---

## PERF-8: Hele cloud-tabeller hentes ved hver forgrundsaktivering, og reconcile kaldes to gange pr. kørsel

**Effekt: HØJ**

- **Kategori:** netværk
- **Hvor:**
  - `src/Services/programService.js:3886-3917` (`syncWorkoutTypeInstancesWithCloudInternal` —
    `reconcileWorkoutTypeInstancesFromCloud` kaldt på **både** `:3901` og `:3906`)
  - `programService.js:3539-3545` (reconcile henter hele brugerens tabel, intet `updated_at`-filter)
  - Samme mønster: `:1794` (programmer), `:2168` (mesocykler), `:2599` (mikrocykler),
    `:3052` (dage), `:4062` (øvelses-instanser), `:4601` (sæt)
  - `src/Services/weightliftingService.js:2667-2703` (`syncExerciseLibraryFromCloud` — hele
    øvelseskataloget uden paginering)
  - Udløsere: `src/Sync/ExerciseLibrarySync.js:32-46`, `SetSync.js:57-71`,
    `WorkoutTypeInstanceSync.js:32-46`, `WorkoutTypeCatalogSync.js`,
    `PushNotificationRegistrationSync.js` — alle med `useEffect` ved mount **og** `AppState → "active"`
- **Hyppighed:** **app-start + hver gang appen kommer i forgrunden.** Under en træning hvor
  brugeren skifter væk og tilbage nogle gange, altså flere gange pr. session
- **Problem:** Tre lag af unødig netværkstrafik.
  1. **Ingen delta.** Hver reconcile gør `.select(...).eq("user_id", userId)` uden
     `updated_at > sidste_sync`. Hele brugerens tabel downloades for at finde de 0–3 rækker der
     ændrede sig. Ved 40.000 sæt er det hele sætmængden, hver gang.
  2. **Dobbelt reconcile.** `syncWorkoutTypeInstancesWithCloudInternal` downloader tabellen,
     uploader, og **downloader hele tabellen igen** (`:3906`) — selv hvis `uploadedCount` er 0.
     Samme mønster i de andre `sync*WithCloudInternal`.
  3. **Kaskade.** `syncWorkoutTypeInstances` → `syncDays` → `syncMicrocycles` →
     `syncMesocycles` → `syncPrograms`, hver med sin dobbelte reconcile. Én sync-kørsel bliver
     ~14 fulde tabel-downloads.

  Dertil: `claimCloudWatchers` (`:1378-1441`) upserter **én række pr. downloadet cloud-record**
  i `Sync_Watchers`, hver gang (se PERF-17).

  `syncExerciseLibraryFromCloud` downloader desuden hele det delte øvelseskatalog og
  sammenligner det i JS (`areExerciseCatalogEntriesEqual`, `:2684`) — kun for at konstatere at
  intet har ændret sig, hvad der er det normale udfald.
- **Målt eller formodet:** **Målt** (statisk). Manglende `updated_at`-filter, de to
  reconcile-kald, kaskaden og pr.-record-upserten er alle læst direkte i koden.
  **Datamængden er formodet og skal måles:** Expo dev-clientens Network-inspector, eller en
  tæller på `global.fetch` der summerer `Content-Length` pr. path. Send appen i baggrunden og
  frem igen, og log samlet downloadet volumen. Sammenlign med rækketallene fra 1.4.
- **Forventet gevinst:** Fjernelse af det andet reconcile-kald halverer downloadet med det
  samme og er en to-linjers ændring. Et `updated_at`-delta gør et typisk foreground-sync til
  nogle få kB i stedet for hele datasættet. Tilsammen realistisk 90 %+ reduktion i det normale
  tilfælde (intet har ændret sig).
- **Anbefaling:**
  1. **Gør det andet reconcile-kald betinget:** kør kun `finalDownloadedCount`-reconcile hvis
     `uploadedCount > 0` eller `deletedCount > 0`. Formålet er at hente cloud-tildelte id'er
     tilbage efter en upload; sker der ingen upload, er der intet at hente.
     **Billigste rettelse i hele rapporten.** Gør den overalt hvor mønsteret findes.
  2. Gem `last_synced_at` pr. tabel i `App_Metadata` (tabellen findes allerede,
     `schema/program.js:3-6`) og tilføj `.gt("updated_at", lastSyncedAt)` til reconcile-kaldene.
     Kræver at cloud-tabellerne har et pålideligt `updated_at`. Håndtér sletninger separat —
     `deleted_at`-rækker skal stadig kunne opdages, så filtrér på et `updated_at` der også
     bumpes ved soft-delete.
  3. Claim kun watchers for de records reconcile faktisk behandlede, ikke for hele
     download-mængden (se PERF-17).
  4. Sæt en debounce på `AppState → active`-triggerne (fx spring over hvis sidste sync er under
     60 s gammel). Fem sync-komponenter reagerer i dag uafhængigt på samme event.
  5. `syncExerciseLibraryFromCloud`: hent en billig version-/checksum-værdi først (fx
     `MAX(updated_at)`) og spring hele downloaden over hvis den er uændret.
- **Risiko:** Lav for punkt 1, 3 og 4. **Middel til høj for punkt 2** — et delta-filter der
  misser en ændring giver stille datatab mellem enheder, og det er svært at opdage.
  Krav før udrulning af punkt 2: verificér at `updated_at` sættes af en database-trigger (ikke
  af klienten), test at en sletning på enhed A propagerer til enhed B, test at en enhed der har
  været offline længe får alt med, og behold en "fuld resync"-sti (ved app-opdatering eller
  manuelt) som sikkerhedsnet.
- **Indsats:** Lille (punkt 1) / Middel (punkt 3+4) / Stor (punkt 2)

---

## PERF-9: 13 MB PNG'er, hvoraf flere vises i 48×48

**Effekt: MIDDEL** (HØJ på enheder med lidt RAM)

- **Kategori:** assets
- **Hvor:**
  - `src/Resources/Images/DarkVersion/Calculator.png` — **1254×1254, 1,28 MB** — vist i
    `src/Pages/ExerciseLibraryPage/ExerciseLibraryPage.js:218-222` i en container på
    **48×48 pt** (`ExerciseLibraryPageStyle.js:100-105`)
  - `src/Resources/Images/DarkVersion/Injury.png` — 1254×1254, **1,44 MB**
  - `src/Resources/Images/DarkVersion/Mental.png` — 1254×1254, 1,34 MB
  - `src/Resources/Images/DarkVersion/Search_people.png` — 1254×1254, 1,28 MB —
    `src/Pages/SearchPage/SearchPage.js:31`
  - `src/Resources/Images/DarkVersion/workout calender dark.png` — 1254×1254, 1,19 MB
  - `src/Resources/Images/DarkVersion/Fatigue.png` — 1,27 MB
  - `src/Resources/Images/WorkoutTypes/ResistanceTraining/52c5c0a6-….png` — **864×1821, 1,57 MB**
  - `src/Pages/WorkoutPage/WorkoutTypes/Run/Assets/{Endurance&base, Performance&threshold,
    Speed&structure, Custom}.png` — 1254×1254, 1,19–1,31 MB hver
  - Samlet: `src/Resources/Images` = **13 MB**, `src/Resources/BodyMap` = **6,5 MB**
- **Hyppighed:** **pr. skærmvisning** for hver skærm der viser dem; dekodning ved hver første
  visning efter cache-eviction
- **Problem:** En 1254×1254 PNG dekodes til ~6,3 MB ukomprimeret bitmap i hukommelsen
  (1254 × 1254 × 4 bytes), uanset at den vises i 48×48. `ExerciseLibraryPage` indlæser tre af
  dem plus et 1,57 MB cover — over 4 MB filer og ~20 MB dekodet bitmap for én skærm.
  Løbeskærmens fire flow-billeder er 5 MB tilsammen. På en enhed med lidt RAM presser det
  billed-cachen og kan udløse dekodnings-hak ved scroll. Alle billeder er statiske `require`,
  så de ligger også i APK'en og tæller med i download-størrelsen.
- **Målt eller formodet:** **Målt.** Dimensioner læst direkte ud af PNG-headerne, filstørrelser
  fra filsystemet, visningsstørrelsen læst i stylesheetet. Ingen antagelser.
  **Ejeren bør supplere med:** faktisk hukommelsesforbrug pr. skærm (Android Studio Memory
  Profiler, "Graphics"-kategorien) før/efter, og APK-størrelse før/efter.
- **Forventet gevinst:** Konservativt: 13 MB → under 2 MB. Et 48×48-thumbnail behøver 144×144
  (3× for @3x-skærme) ≈ 10–20 kB som WebP — en reduktion på **~99 %** for de billeder.
  Fuldskærms-illustrationer i 800×800 WebP lander typisk på 60–150 kB, mod 1,3 MB i dag.
  Tilsvarende fald i dekodet bitmap-hukommelse.
- **Anbefaling:**
  1. Skalér hvert billede ned til faktisk visningsstørrelse × 3 (for @3x). Konkret:
     thumbnail-billederne til 144×144, kort-/hero-billeder til maks. skærmbredde × 3.
  2. Konvertér til WebP (Android understøtter det fuldt; iOS fra 14). Behold PNG kun hvor der
     er brug for skarp alfa-kant i stor størrelse.
  3. Levér flere tætheder (`@2x`/`@3x`) så Metro kan vælge, i stedet for én stor fil til alle.
  4. `BodyMap`-mapperne er 6,5 MB fordelt på 73 filer. `BodyMapPreview.js:8-12` bruger kun
     `Back_body_compressed.png` (230 kB), `Front_body_compressed.png` (206 kB) og
     `Front_muscle_masks.svg`. Undersøg om de resterende ~70 muskel-maske-filer refereres
     nogen steder — hvis ikke, er der ~6 MB død vægt.
  5. Kør en `expo-optimize`-lignende pass som engangs-oprydning, og læg en størrelsesgrænse ind
     i CI (fx afvis assets over 200 kB uden begrundelse).
- **Risiko:** Lav, men **visuel** — det er den slags ændring hvor en for aggressiv nedskalering
  ses som uskarphed. Verificér hver ændret asset på en @3x-enhed (fx Pixel 7 / iPhone 15 Pro)
  side om side med originalen, især illustrationerne der vises stort. Verificér at
  alfa/gennemsigtighed er bevaret i WebP-konverteringen. Tjek også om et billede bruges i to
  størrelser på forskellige skærme, før du vælger målopløsningen.
- **Indsats:** Lille (mekanisk arbejde, men mange filer)

---

## PERF-10: 150 kB engangs-import-payload ligger i hovedbundlen og evalueres ved app-start

**Effekt: MIDDEL**

- **Kategori:** bundle
- **Hvor:**
  - `src/Services/zhadowsebProgramImportPayload.js` — **153.551 bytes, 4.987 linjer**, ét stort
    objekt-literal. Filens egen kommentar (`:1-2`): *"Generated by
    scripts/generate-local-program-import.js. Temporary one-time local import payload for
    zhadowseb@gmail.com."*
  - Importeret statisk af `src/Services/localProgramImportService.js:4`
  - Som re-eksporteres af `src/Services/index.js:4` (`export * as localProgramImportService`)
  - Som importeres af **53 filer** i `src/` samt `App.js:57`
- **Hyppighed:** **app-start** (modul-evaluering), plus bundle-størrelse permanent
- **Problem:** Metro tree-shaker ikke `export * as`-barrels som standard. Fordi `App.js` og ~53
  skærme importerer fra `../Services`, trækkes hele barrel-modulet — og dermed
  `localProgramImportService` og dets 150 kB payload — ind i hovedbundlen. Hermes parser og
  instantierer hele objekt-literalet ved modul-evaluering, altså under app-start, før første frame.

  Payloadet indeholder én specifik brugers data (3 programmer, 203 dage, 51 workouts, `:8-16`).
  Jeg kan ikke finde et eneste kald til `localProgramImportService.*` nogen steder i `src/` —
  den eneste reference er barrel-eksporten. Funktionaliteten er altså sandsynligvis død, men
  omkostningen er levende.

  Sideordnet bemærkning, ikke performance: filen indeholder en anden persons e-mail og
  bruger-UUID i versionsstyret kode.
- **Målt eller formodet:** **Filstørrelse, linjetal og importgraf er målt.**
  **Andelen af bundlen er formodet** — jeg kan ikke bygge her, og `dist/` er tom.
  **Sådan verificeres det:** `npx expo export --platform android --dump-sourcemap`, derefter
  `npx source-map-explorer` på den genererede `.hbc.map`. Slå `zhadowsebProgramImportPayload`
  op i outputtet og læs dens andel. Mål samtidig start-tid før/efter fjernelse.
- **Forventet gevinst:** ~150 kB kildekode ud af bundlen og dermed ud af Hermes'
  parse/instantierings-arbejde ved hver kold start. Hvor meget det betyder i millisekunder
  afhænger af bundlens samlede størrelse — derfor skal det måles før man konkluderer.
  Fjernelse koster ~10 minutter, så forholdet gevinst/indsats er godt uanset udfaldet.
- **Anbefaling:**
  1. Bekræft at engangs-importen er kørt og ikke skal køres igen (spørg ejeren — det er en
     produktbeslutning, ikke en teknisk). Hvis ja: slet både
     `zhadowsebProgramImportPayload.js` og `localProgramImportService.js`, og fjern linjen fra
     `src/Services/index.js`.
  2. Hvis funktionaliteten skal beholdes: flyt payloadet til en JSON-fil der hentes dynamisk
     (`await import(...)`) først når importen faktisk startes, og fjern
     `localProgramImportService` fra barrel-eksporten.
  3. Uafhængigt: overvej om `src/Services/index.js`-barrelen er en god idé. 53 filer importerer
     den, så hver skærm trækker alle 12 services ind, inklusive `programService.js`
     (7.427 linjer) og `weightliftingService.js` (4.272 linjer). Direkte imports giver Metro en
     chance for at holde grafen mindre. Stor mekanisk ændring — mål først om det betyder noget.
- **Risiko:** Lav for punkt 1 og 2 — men **bekræft med ejeren** at importen er gennemført, før
  noget slettes. Der er ingen kaldere i koden, så der er intet at bryde teknisk.
  Punkt 3 er bredt og bør kun laves hvis en bundle-måling retfærdiggør det.
- **Indsats:** Lille (punkt 1+2) / Stor (punkt 3)

---

## PERF-11: `initializeDatabase` kører ubetingede fuldtabel-opdateringer ved hver app-start

**Effekt: ukendt indtil målt — potentielt KRITISK, potentielt LAV**

- **Kategori:** database
- **Hvor:** `src/Database/db.js:1433-1533` (`initializeDatabase`, **62 `await`-trin**), kaldt
  fra `App.js:426-437` via `SQLiteProvider onInit`. De ubetingede tunge trin:
  - `db.js:1487-1495` — `UPDATE Exercise_Instance SET sets = (SELECT COUNT(*) FROM "Set" WHERE …)`
    — skriver **hver** række i `Exercise_Instance`, hver gang, med en korreleret underforespørgsel
    pr. række
  - `db.js:1113-1148` (`repairResistanceTrainingState`) — tre ubetingede `UPDATE`'er over hele
    `Exercise_Instance` og `Workout_Type_Instance` med `EXISTS`-underforespørgsler
  - `db.js:1153-1170` (`repairRunSetState`) — ubetinget `UPDATE Run SET type = CASE …` over hele
    tabellen
  - `db.js:1181-1230` (`repairExerciseOrders`) — `SELECT` **alle** `Exercise_Instance`-rækker ind
    i JS-hukommelsen, løkker igennem dem, og opdaterer afvigelser én ad gangen
  - `db.js:1458-1519` — 8× `backfillSyncStateColumns`, hver med to `UPDATE`'er
  - ~30× `ensureTableColumns` → én `PRAGMA table_info` pr. tabel
- **Hyppighed:** **app-start** (hver kold start), og igen ved login/logout fordi
  `SQLiteProvider key={databaseName}` (`App.js:456-459`) remonterer provideren når databasenavnet
  skifter
- **Problem:** Migrerings- og repair-suiten er skrevet til at være idempotent, hvilket er rigtigt
  tænkt — men den er også *ubetinget*. Der er intet skema-versionsnummer, så alle historiske
  migreringer og alle repair-pass kører ved hver enkelt start, uanset at de intet har at lave.

  Det dyre er ikke `PRAGMA`-kaldene (billige), men de ubetingede fuldtabel-`UPDATE`'er: hver af
  dem skriver hver række i tabellen til WAL-loggen, selv når værdien er uændret (SQLite
  optimerer ikke no-op-updates væk). Ved 8.000 øvelses-instanser og 40.000 sæt betyder det
  titusinder af rækkeskrivninger og en voksende WAL-fil — før første frame vises.
  `repairExerciseOrders` læser desuden hele tabellen ind i JS.

  Alt dette ligger foran brugeren: `UserScopedDatabaseApp` viser "Restoring session…" indtil
  `onInit` er færdig.
- **Målt eller formodet:** **Kodestien og de ubetingede skrivninger er målt** (læst direkte;
  62 `await`-trin optalt). **Varigheden er formodet og er det vigtigste ubekendte i hele
  rapporten.** Uden et tal kan man ikke vide om dette er KRITISK eller irrelevant.
  **Sådan måles det:**
  ```
  const t0 = Date.now();
  await initializeDatabase(db);
  console.log("initializeDatabase ms:", Date.now() - t0);
  ```
  i `App.js:427-437`. Kør på en **rigtig brugerdatabase med historik** (ikke en frisk), på en
  fysisk mellemklasse-Android, 5 kolde starter, median. Log desuden WAL-filstørrelsen før/efter.
  **Beslutningsregel:** under ~150 ms → nedgradér til LAV og lad ligge. Over ~500 ms → appens
  dyreste startomkostning.
- **Forventet gevinst:** Ved at gate migreringerne bag en skemaversion falder de 62 trin til 1
  (versionslæsning) på alle starter efter den første. Hele start-omkostningen forsvinder,
  uanset hvor stor den viser sig at være.
- **Anbefaling:**
  1. Indfør en skemaversion. `App_Metadata` findes allerede (`schema/program.js:3-6`) — eller
     brug SQLites indbyggede `PRAGMA user_version`. Gem det højeste anvendte migrerings-trin, og
     spring alt under det over ved næste start.
  2. Adskil **migreringer** (kør én gang, versionsgated) fra **repairs** (defensive, kan
     genkøres). Kør kun repairs når der er grund til det: efter en fejlet sync, efter en
     app-opdatering, eller manuelt fra en debug-skærm — ikke ved hver start.
  3. Gør de tilbageværende fuldtabel-`UPDATE`'er betingede med et `WHERE` der udelukker rækker
     der allerede har den rigtige værdi. `UPDATE Exercise_Instance SET sets = (…)` kan få
     `WHERE sets != (…)`. `repairRunSetState`'s `UPDATE Run SET type = CASE …` kan få
     `WHERE type IS NULL OR type NOT IN ('WARMUP','WORKING_SET','COOLDOWN')`. Det gør dem gratis
     når der intet er at rette, uden at ændre deres virkning.
  4. Fjern de udkommenterede `DROP TABLE`-blokke i `db.js:1536-1568`. De er inaktive, men de er
     en fælde for den næste der redigerer filen.
- **Risiko:** **Høj, hvis det gøres forkert.** Denne kode er formentlig vokset som svar på
  rigtige datakorruptioner i felten, og at springe et repair-pass over kan lade en gammel fejl
  blive permanent. Fremgangsmåde:
  - **Mål først** (se ovenfor). Rør ikke noget hvis tallet er lavt.
  - Lav punkt 3 før punkt 1 og 2 — det er semantisk neutralt (samme slutresultat, færre
    skrivninger) og giver måske hele gevinsten alene.
  - Hvis punkt 1 laves: test opgradering fra flere gamle databasetilstande. Tag en kopi af en
    rigtig brugerdatabase fra før migreringerne og kør både den gamle og den nye vej;
    sammenlign skema (`PRAGMA table_info` pr. tabel) og rækkeindhold.
  - Behold en "kør alle repairs"-sti tilgængelig, så en supportsag kan løses uden ny release.
- **Indsats:** Lille (punkt 3+4) / Stor (punkt 1+2)

---

## PERF-12: MicrocyclePage laver ~135 sekventielle forespørgsler pr. visning

**Effekt: MIDDEL**

- **Kategori:** netværk (lokal I/O)
- **Hvor:**
  - `src/Pages/MicrocyclePage/Components/MicrocycleList/MicrocycleList.js:195-215` —
    `for (const mc of microcycles)` × `for (let i = 0; i < 7; i++)` →
    `await programRepository.getDayDetails(...)`
  - `MicrocycleList.js:331-338` (`loadCounts`) — `for (const mc of microcycles)` →
    `await getMicrocycleWorkoutCounts` pr. mikrocyklus
  - `MicrocycleList.js:347-354` — begge kaldes fra `useEffect [microcycles]`, og `loadCounts`
    kaldes desuden fra `useEffect [refreshKey]` (`:347-349`) → dobbelt kald ved mount
  - `src/Services/programService.js:6612-6644` (`getDayDetails`) — 2 forespørgsler + 1 pr.
    workout på dagen
  - Samme mønster: `src/Pages/WeekPage/Components/Day/Day.js:80`
- **Hyppighed:** **pr. skærmvisning**, i indlejret loop (mikrocykler × 7 dage)
- **Problem:** `getDayDetails` er selv et lille N+1 (henter dag, henter dagens workouts, og
  derefter øvelses-opsummeringer **pr. workout**). Den kaldes 7 gange pr. mikrocyklus, i en
  sekventiel `for`-løkke med `await`, uden `Promise.all`.

  For en mesocyklus med 6 mikrocykler: `6 × 7 × (2 + ~1,2 workouts) ≈ 135 sekventielle
  SQLite-rundture`, plus 6 fra `loadCounts` (×2 pga. dobbeltkaldet). Hver rundtur er billig, men
  latensen lægger sig oveni hinanden, fordi intet kører parallelt.
- **Målt eller formodet:** **N+1-strukturen er målt** (loops og kaldegraf læst direkte; antal
  forespørgsler beregnet ud fra strukturen). **Den samlede tid er formodet** — og formentlig
  domineret af tur-retur-overhead frem for SQL-arbejde, eftersom de tilsvarende
  enkeltforespørgsler målte under 0,05 ms i proben.
  **Sådan verificeres det:** wrap `db.getAllAsync`/`getFirstAsync` i en tæller + timer, åbn
  `MicrocyclePage` for en mesocyklus med 6 mikrocykler, og log antal kald og samlet tid.
  Sammenlign med de beregnede ~135.
- **Forventet gevinst:** Én forespørgsel der henter alle dage for alle mikrocykler i mesocyklussen
  erstatter ~135 kald med 1–2. Fjernelse af det dobbelte `loadCounts`-kald sparer yderligere 6.
- **Anbefaling:**
  1. Tilføj `getDaysWithWorkoutsByMesocycle(mesocycleId)` der henter alle dage og deres workouts
     i én forespørgsel, og gruppér i JS. Mønsteret findes allerede i `getWorkoutsBetweenDates`
     (`programRepository.js:1070-1106`) — samme form for join.
  2. Hvis punkt 1 er for stort et skridt: pak i det mindste de 7 dagskald pr. mikrocyklus i
     `Promise.all`, så latensen ikke serialiseres. Få-linjers ændring med umiddelbar effekt.
  3. Fjern det dobbelte `loadCounts`-kald: `useEffect [refreshKey]` (`:347-349`) og
     `useEffect [microcycles]` (`:351-354`) kalder begge `loadCounts` ved mount.
  4. Læg `getMicrocycleWorkoutCounts` ind i samme forespørgsel som punkt 1 (en
     `GROUP BY microcycle_id`-aggregering).
  5. Samme behandling til `WeekPage/Components/Day/Day.js:80` — der kaldes `getDayDetails` pr.
     dag-komponent, altså 7 gange for en uge.
- **Risiko:** Lav. Ren datahentning uden sideeffekter. Verificér at uge-oversigten viser identiske
  workout-ikoner, done-markeringer, sygdomsmarkeringer og PR-badges før og efter — tag et
  skærmbillede før ændringen og sammenlign. Vær særligt opmærksom på dage **uden** en
  `Day`-række: den nuværende kode falder tilbage til `buildMicrocycleDate` (`:216-217`) når
  `getDayDetails` returnerer `null`, og den fallback skal bevares.
- **Indsats:** Middel

---

## PERF-13: Øvelsesbiblioteket rendres uden virtualisering, med en kropskort-SVG pr. række

**Effekt: MIDDEL** (HØJ hvis kataloget er >200 øvelser — skal måles)

- **Kategori:** rendering
- **Hvor:**
  - `src/Pages/ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList.js:1146-1152`
    — `<ScrollView>` med `{filteredExercises.map(...)}`
  - Samme mønster i vælger-varianten: `:532` (inde i `pickerExerciseCard`)
  - `:1183` og `:569` — `<BodyMapPreview>` pr. række
  - `src/Resources/Components/BodyMapPreview/BodyMapPreview.js:33-75` — pr. instans: én
    `<Image>` (206–230 kB PNG) + én `<Svg>` med muskel-paths
  - `:544-546` og `:1153-1156` — `getExerciseMuscleSummary(exercise, "primary")` og
    `"secondary"` kaldes i render pr. række
- **Hyppighed:** **pr. listeelement**, ved hver render af listen (inkl. hvert tegn i søgefeltet
  og hvert filterskift)
- **Problem:** `ScrollView` monterer **alle** børn med det samme — der er ingen vinduesbaseret
  rendering. Øvelseskataloget kommer fra det delte cloud-bibliotek
  (`weightliftingService.js:2667-2703` henter hele `Exercise`-tabellen), så antallet er ikke
  brugerens eget og kan realistisk være 200–2.000.

  Hver række koster en `<Image>` med et 200 kB+ kropsbillede og en `<Svg>` med muskel-paths,
  altså to native views med dekodnings- og layoutarbejde. Ingen af komponenterne er
  `React.memo`, så hvert tastetryk i søgefeltet re-rendrer alle monterede rækker.
  `getExerciseMuscleSummary` kaldes to gange pr. række pr. render, umemoiseret.

  Ved 500 øvelser er det 1.000 native views monteret på én gang — den slags der giver flere
  sekunders blank skærm ved åbning og hakkende søgning, eller hukommelsesnedbrud på svage enheder.
- **Målt eller formodet:** **Strukturen er målt** (`ScrollView` + `.map`, `BodyMapPreview` pr.
  række, manglende `memo`, dobbelt `getExerciseMuscleSummary` — alt læst direkte).
  **Antallet af øvelser i praksis er formodet og afgør fundets alvor.**
  **Sådan verificeres det:** kør `SELECT COUNT(*) FROM Exercise` mod en rigtig brugerdatabase
  efter en gennemført `syncExerciseLibraryFromCloud` — eller kig direkte i Supabase-tabellen
  `Exercise`. Mål samtidig tiden fra tryk på "øvelsesbibliotek" til listen er interaktiv, og
  skriv et tegn i søgefeltet og mål forsinkelsen.
  **Beslutningsregel:** under ~60 øvelser → LAV, lad ligge. Over ~200 → HØJ.
- **Forventet gevinst:** Med virtualisering monteres ~10–15 rækker ad gangen i stedet for alle.
  Ved 500 øvelser: fra 1.000 native views til ~30 — over 30× mindre monteringsarbejde, og en
  åbningstid der ikke afhænger af katalogets størrelse.
- **Anbefaling:**
  1. Erstat `ScrollView` + `.map` med `FlatList` (`keyExtractor={e => e.exercise_name}` — nøglen
     er allerede stabil og unik, `Exercise.name` er `UNIQUE`). Sæt `initialNumToRender`,
     `windowSize` og `removeClippedSubviews` bevidst. Bemærk at der er **to** lister i filen
     (vælger-varianten `:532` og hovedvarianten `:1152`) — begge skal om.
  2. Træk rækken ud i sin egen komponent og pak den i `React.memo`. Forudsætning for at
     søgefeltet bliver responsivt.
  3. Beregn `getExerciseMuscleSummary`-resultaterne én gang når data indlæses, og gem dem på
     øvelses-objektet — i stedet for to kald pr. række pr. render.
  4. Overvej om hver række har brug for et fuldt kropskort. Et lille statisk ikon plus
     muskelnavne ville fjerne både `<Image>` og `<Svg>` fra rækken, og lade kropskortet være
     forbeholdt detaljevisningen. Designbeslutning, ikke kun teknisk — afklar med ejeren.
  5. Debounce søgefeltet (150–250 ms), så filtreringen ikke kører pr. tastetryk.
- **Risiko:** Middel. `FlatList` inde i den eksisterende layout-struktur kan give
  nestede-scroll-problemer — filen bruger allerede `nestedScrollEnabled` (`:1151`), hvad der
  antyder at listen ligger inde i en anden scroll-container. Det skal løses, ikke ignoreres
  (typisk ved at gøre `FlatList` til den ydre scroller med `ListHeaderComponent`).
  **Verificér:** scroll gennem hele listen (ingen blanke rækker, ingen hoppende scroll-position),
  søgning filtrerer korrekt, valg af en øvelse fra vælgeren tilføjer den rigtige øvelse, og
  listen bevarer position når man vender tilbage til skærmen.
- **Indsats:** Middel

---

## PERF-14: Bundnavigationen har et 1-sekunds-interval der kører på hver skærm, altid

**Effekt: MIDDEL**

- **Kategori:** hukommelse / opfattet hastighed
- **Hvor:** `src/Resources/ThemedComponents/ThemedBottomNavigation.js:447-467` —
  `setInterval(() => { setTimerTick(...); loadActiveWorkoutTimer(); }, 1000)`.
  Komponenten monteres i `App.js:470-475` og er monteret så længe brugeren er logget ind og ikke
  på pulsgraf-skærmen. `loadActiveWorkoutTimer` (`:428-445`) →
  `workoutRepository.getActiveWorkoutTimer` (`workoutRepository.js:107-128`)
- **Hyppighed:** **interval — hvert sekund, hele app-sessionen**, uafhængigt af om der findes en
  aktiv træning
- **Problem:** Intervallet er ubetinget. Der er ingen aktiv træning i den store del af tiden,
  men loopet kører alligevel: hvert sekund sætter det `timerTick`-state — hvad der re-rendrer en
  komponent på 1.024 linjer og dens undertræ — og laver en SQLite-forespørgsel.

  For brugeren betyder det, at appen aldrig går helt i tomgang. JS-tråden vækkes 60 gange i
  minuttet uanset hvad skærmen viser, hvilket koster batteri og forhindrer at enheden parkerer
  processen.
- **Målt eller formodet:** **Intervallet og dets ubetingede natur er målt** (læst direkte).
  **Databasedelen er målt til at være ubetydelig** — og det er værd at fremhæve, fordi det
  ændrer anbefalingen: `getActiveWorkoutTimer` kørt 1.000 gange mod proben tog under
  måletærsklen, selv om planen er `SCAN w` + `USE TEMP B-TREE FOR ORDER BY` (fuld scanning og
  temp-sortering). Ved 2.500 workouts er tabellen simpelthen for lille til at det betyder noget.
  **Der er derfor ingen grund til at tilføje et indeks her** (se D5). Omkostningen er
  re-render + wakeups, ikke SQL.
  **Sådan måles den reelle omkostning:** React DevTools Profiler, 30 s optagelse på en vilkårlig
  skærm uden aktiv træning. Tæl commits af `ThemedBottomNavigation` og se hvor meget af
  undertræet der faktisk gentegnes. Suppler med Android Battery Historian over en time med
  appen åben i tomgang.
- **Forventet gevinst:** ~3.600 unødige re-renders og forespørgsler pr. time med appen åben → 0
  når der ikke er en aktiv træning. Målbart batteri-udslag, og en JS-tråd der er fri når
  brugeren scroller.
- **Anbefaling:**
  1. Gør intervallet betinget: start det kun når `activeWorkoutTimer !== null`. Find ud af om
     der er en aktiv træning via de events der i forvejen findes — `AppState → active`
     (allerede lyttet på, `:455-462`), navigation-fokus, og de eksisterende
     `subscribeRestTimer`/`subscribeQuickWorkoutMenu`-kanaler (`:420-426`). Tilføj en
     tilsvarende kanal som `persistWorkoutTimerState` publicerer på, så navigationen får besked
     når en træning starter eller stopper, i stedet for at polle efter det.
  2. Adskil "tick" fra "poll". Uret behøver `setTimerTick`; det behøver ikke en
     databaseforespørgsel. Hent `activeWorkoutTimer` ved fokus og ved AppState-skift, og lad kun
     tid-state ticke.
  3. Isolér tidsvisningen i en lille memoiseret underkomponent, så et tick ikke rekoncilierer
     hele bundnavigationen.
- **Risiko:** Middel — bundnavigationens træningsindikator er brugerens vej tilbage til en
  igangværende træning, og hvis event-kanalen misser en overgang, forsvinder indikatoren.
  Kortlæg alle steder der ændrer `is_active`/`timer_start`
  (`workoutRepository.persistWorkoutTimerState`, `repairWorkoutTrackingState` ved start,
  workout-afslutning) og sørg for at hver af dem publicerer.
  **Verificér:** start en træning → indikatoren vises straks og tæller; naviger til flere skærme
  → indikatoren følger med og tæller korrekt; afslut træningen → indikatoren forsvinder;
  baggrund/forgrund midt i træning → tiden er korrekt; kill og genåbn appen med en igangværende
  træning → indikatoren kommer tilbage.
- **Indsats:** Middel

---

## PERF-15: Kalenderen henter data to gange for hver månedsvisning

**Effekt: LAV**

- **Kategori:** netværk (lokal I/O)
- **Hvor:** `src/Pages/WorkoutCalendarPage/WorkoutCalendarPage.js:484-550`
  (`loadCalendarWorkouts`): første `loadCalendarRows(visibleMonthRange)` på `:502`, derefter —
  hvis intervallet afviger — `loadCalendarRows(calendarRange)` på `:534`, som **overskriver**
  den samme state (`:540-542`). `loadCalendarRows` (`:457-482`) laver 3 forespørgsler.
  `useFocusEffect` (`:554-558`) afhænger af `loadCalendarWorkouts`, som ændrer identitet når
  `calendarRange` eller `visibleMonthRange` ændrer sig.
- **Hyppighed:** **pr. skærmvisning og pr. månedsswipe**
- **Problem:** Hver visning kører 3 forespørgsler for den synlige måned, sætter state, og kører
  derefter straks 3 forespørgsler for hele 3-måneders-intervallet og overskriver samme state.
  Den første hentning bliver kastet væk i det øjeblik den anden lander. Da `useFocusEffect`
  afhænger af den callback der genskabes ved intervalændring, gentages begge runder ved hver
  månedsswipe: **6 forespørgsler pr. swipe**, hvoraf 3 er spildt. `getSicknessPeriods` hentes
  desuden begge gange, selv om den ikke er interval-afhængig.
- **Målt eller formodet:** **Målt** (statisk — den dobbelte hentning og state-overskrivningen er
  læst direkte). **Kalender-SQL'en er målt til at være hurtig:** udtryks-indekset bruges
  (`SEARCH w USING INDEX workout_type_instance_calendar_date_idx`) og 20 kørsler af
  180-dages-varianten lå under måletærsklen. Fundet er derfor et spild-fund, ikke et
  langsom-SQL-fund.
  **Verificér med en forespørgselstæller:** åbn kalenderen, swipe tre måneder frem, log antal
  kald. Forventning: 6 pr. swipe.
- **Forventet gevinst:** Halvering af kalenderens datahentning (fra 6 til 3 forespørgsler pr.
  swipe). Beskeden absolut gevinst, men trivielt at rette.
- **Anbefaling:**
  1. Hent kun én gang. Enten det synlige interval (og hent naboer i baggrunden **uden** at
     overskrive før de er hentet), eller hele 3-måneders-intervallet direkte og filtrér i JS —
     `visibleMonthWorkouts` (`:400-402`) filtrerer allerede i JS, så data til hele intervallet
     er tilstrækkeligt.
  2. Træk `getSicknessPeriods` ud af den interval-afhængige hentning; den afhænger ikke af måneden.
  3. Lad `useFocusEffect` afhænge af en stabil ref frem for af `loadCalendarWorkouts` (mønsteret
     findes allerede: `loadCalendarWorkoutsRef`, `:550-552`) så swipes ikke udløser
     fokus-genindlæsning oveni.
- **Risiko:** Lav. Verificér at markeringerne (workouts, programdage, sygdomsdage) stadig vises
  korrekt i den viste måned **og** i de tilstødende måneder når man swiper — det er præcis det
  prefetch-forsøget skulle sikre, så pas på ikke at introducere en blank måned ved swipe.
- **Indsats:** Lille

---

## PERF-16: Hele navigatoren remonteres muligvis ved app-start når det gemte accent-tema indlæses

**Effekt: ukendt indtil målt — HØJ hvis bekræftet, ellers ugyldigt**

- **Kategori:** opfattet hastighed
- **Hvor:** `App.js:464` — `<RootNavigator key={"accent-" + accentTheme} />`.
  `accentTheme` kommer fra `useThemeMode()` og starter som `DEFAULT_ACCENT_THEME`
  (`ThemeContext.js:42`); den rigtige værdi læses asynkront fra AsyncStorage
  (`ThemeContext.js:45-73`) og sættes med `setAccentThemeState(accent)` (`:65`).
- **Hyppighed:** **app-start**, hver kold start hvor brugerens gemte accent ≠ standard
- **Problem:** `key` på en komponent tvinger fuld unmount + remount ved ændring. Kommentaren i
  `App.js:170-176` forklarer hvorfor det er sådan (paletterne muteres, så friske mounts skal
  læse dem igen), og der er lavet en navigation-state-bevarelse for at kompensere.
  Men konsekvensen er, at hvis AsyncStorage-læsningen lander efter at navigatoren er monteret,
  bliver hele skærmtræet smidt væk og bygget op igen: `HomePage` monteres, dens `useFocusEffect`
  affyrer alle loaders (PERF-7's ~28 forespørgsler + 4 netværkskald), og så sker det hele forfra.

  Om det faktisk indtræffer afhænger af, om `ThemeModeProvider`'s AsyncStorage-læsning fuldføres
  før eller efter `AuthProvider` har afgjort auth-tilstanden (`isAuthLoading` gater
  `SQLiteProvider`, `App.js:440-452`). Det er en race, så adfærden kan variere mellem enheder og
  starter.
- **Målt eller formodet:** **Formodet — skal måles.** Kodestien er entydig, men om racen falder
  ud til en remount er ikke afgjort ved læsning.
  **Sådan måles det:** læg `useEffect(() => console.log("RootNavigator mount"), [])` i
  `RootNavigator`, og tilsvarende i `HomePage`. Sæt et gemt accent-tema forskelligt fra
  standard. Kør 10 kolde starter og tæl mounts. **1 mount → fundet er ugyldigt, luk det.
  2 mounts → bekræftet.** Log samtidig antal HomePage-loader-kørsler.
- **Forventet gevinst:** Hvis bekræftet: fjerner en fuld dobbelt-mount af hele skærmtræet ved
  hver kold start, inklusive HomePages ~28 forespørgsler og 4 netværkskald. En af de mest
  direkte forbedringer af *opfattet* starttid.
- **Anbefaling:** to muligheder, vælg efter hvad målingen viser.
  1. **Vent med at rendere.** Lad `ThemeModeProvider` eksponere et `isThemeLoading`-flag og hold
     `UserScopedDatabaseApp` på "Restoring session…"-skærmen indtil både auth og tema er afgjort.
     Der findes allerede en loading-gate for auth (`App.js:440-452`), så det er samme mønster.
     Enkelt og sikkert.
  2. **Fjern behovet for `key`.** Årsagen til remounten er, at `applyAccentTheme` *muterer*
     `Colors`-paletterne, så komponenter ikke re-rendrer ved ændring. Læg farverne i context i
     stedet for i et muteret modul-objekt, så bliver `key` overflødigt og accent-skift bliver en
     almindelig re-render. Den rigtige løsning, men den berører alle komponenter der importerer
     `Colors` (mange).
- **Risiko:** Lav for punkt 1 (den forlænger splash en smule — mål at det ikke er værre end den
  dobbelte mount den erstatter). Stor for punkt 2.
  **Verificér i begge tilfælde:** skift accent-tema i indstillinger → hele appen skifter farve,
  og brugeren bliver på den skærm de stod på (det er hvad `preservedNavigationState`,
  `App.js:178-182`, sikrer i dag — den mekanisme må ikke gå i stykker); genstart appen → det
  valgte tema er aktivt fra første frame.
- **Indsats:** Lille (punkt 1) / Stor (punkt 2)

---

## PERF-17: `Sync_Watchers` får én upsert-række pr. downloadet cloud-record, hver gang

**Effekt: MIDDEL** (HØJ ved >10.000 records — skal måles)

- **Kategori:** netværk
- **Hvor:** `src/Services/programService.js:1378-1441` (`claimCloudWatchers`), kaldt fra hver
  reconcile: `:1806`, `:2181`, `:2612`, `:3065`, `:3551`, `:4075`, `:4615`
- **Hyppighed:** **pr. sync-kørsel pr. tabel** — altså ved app-start og hver
  forgrundsaktivering, og to gange pr. tabel pga. PERF-8's dobbelte reconcile
- **Problem:** Funktionen er korrekt batchet (én HTTP-request, ikke én pr. række — det er gjort
  rigtigt). Men den upserter en `last_seen_at`-række for **hver** record i download-mængden.
  Ved 40.000 sæt er request-body'en 40.000 objekter, og Postgres skal lave 40.000 upserts — for
  at opdatere et tidsstempel der i praksis er det samme for alle. Med PERF-8's dobbelte
  reconcile sker det to gange pr. tabel pr. sync.
- **Målt eller formodet:** **Kodestien er målt.** **Volumen er formodet** og afhænger helt af
  rækketallene i 1.4.
  **Sådan verificeres det:** log `claimableRecords.length` pr. kald og request-body-størrelsen.
  Kør på en konto med realistisk historik.
  **Beslutningsregel:** under ~1.000 records → LAV. Over ~10.000 → HØJ.
- **Forventet gevinst:** Hvis watcher-formålet er "denne enhed har set denne entitet", kan det
  udtrykkes som én række pr. (bruger, tabel, enhed) med et tidsstempel, frem for én pr. entitet.
  Det ville reducere volumen med faktor lig med antallet af records. Alternativt: claim kun de
  records reconcile faktisk ændrede — typisk 0–3 i stedet for alle.
- **Anbefaling:**
  1. **Nemmeste og sikreste:** flyt `claimCloudWatchers` til efter reconcile-løkken og send kun
     de records ind der faktisk blev behandlet (oprettet/opdateret/slettet). Det bevarer
     semantikken for alt der ændrede sig og fjerner ~100 % af volumen i det normale tilfælde.
  2. Afklar med ejeren hvad `Sync_Watchers` bruges til på serversiden. Tabellen bruges af
     `hardDeleteCloudRecordIfReady` (`:1431-1470`) og `ackCloudWatcher` (`:1550-1575`) til at
     afgøre om alle enheder har set en sletning. Hvis den granularitet er nødvendig pr. entitet,
     kan punkt 1 ikke laves uden videre — og så bør designet i stedet vendes om, så enheden
     rapporterer et "set indtil"-tidsstempel pr. tabel.
  3. Ret PERF-8 punkt 1 først; det halverer dette fund gratis.
- **Risiko:** **Middel til høj.** Watcher-tabellen styrer hvornår cloud-rækker må hard-deletes.
  Hvis en enhed holder op med at claime en entitet den faktisk har, kan en sletning blive udført
  for tidligt, eller omvendt aldrig. Rør ikke dette uden at forstå
  `hardDeleteCloudRecordIfReady`-logikken fuldt ud.
  **Verificér:** slet en workout på enhed A → den forsvinder på enhed B → cloud-rækken
  hard-deletes først når begge enheder har acket. Test også en enhed der har været offline under
  sletningen.
- **Indsats:** Middel

---

## PERF-18: Ubrugte afhængigheder og død kode

**Effekt: LAV** (ingen målbar runtime-effekt — hygiejne)

- **Kategori:** bundle
- **Hvor:**
  - `package.json` — `eas-cli` (**26 MB** i `node_modules`) og `supabase` (CLI-pakken) står
    under `dependencies` i stedet for `devDependencies`. Ingen imports i `src/` eller `App.js`
  - `package.json` — `@expo/ui` (~1,5 MB): **0 imports** nogen steder
  - ~25 filer uden referencer, ca. **1.000 linjer**, bl.a.:
    `src/Resources/Components/StopWatch.js` (184 linjer — indeholder også en
    interval-overskrivning på `:64` og `:107` der ville have været en lækage hvis filen var i
    brug), `src/Resources/Components/CircularProgression.js` (139),
    `src/Sync/{DaySync,ExerciseInstanceSync,MesocycleSync,MicrocycleSync,ProgramSync}.js`
    (5 filer, ~237 linjer — de tilsvarende sync-komponenter monteres ikke i `App.js`),
    `src/Resources/GlobalStyling/{theme,spacing}.js`, 7 ubrugte ikon-komponenter
  - Repo-rod: `fitven-run-walk-fix.patch` (20 kB) og
    `detailed new FitVen ER diagram.drawio.png` (200 kB) — versionsstyrede, ikke bundlet
- **Hyppighed:** app-start (modul-evaluering af død kode der nås via barrels) + permanent
  bundle-størrelse + installations-/CI-tid
- **Problem:** `eas-cli` og `supabase` er byggeværktøjer. De havner ikke i JS-bundlen — Metro
  bundler kun det der importeres — så **de påvirker ikke app-performance.** De koster
  `npm install`-tid, CI-tid og diskplads (26 MB alene for `eas-cli`). Hygiejne, ikke runtime.

  `@expo/ui` importeres ingen steder og kan fjernes helt.

  Den døde kode koster kun noget for de filer der faktisk nås via en importkæde. De fem ubrugte
  `Sync`-komponenter importeres ikke af `App.js` og trækkes derfor sandsynligvis ikke ind — men
  det bør bekræftes med en bundle-analyse, ikke antages.
- **Målt eller formodet:** **Målt.** Import-tælling via `grep` over `src/` + `App.js`;
  reference-scanning pr. fil; pakkestørrelser fra `du -sh node_modules/*`.
  **Bundle-effekten er formodet** — se PERF-10 for målemetoden; brug samme
  `source-map-explorer`-output til at afgøre om noget af den døde kode faktisk er med.
- **Forventet gevinst:** Runtime: sandsynligvis nul til meget lille. Udvikleroplevelse: ~27 MB
  mindre `node_modules`, hurtigere `npm install` og CI. Vedligeholdelse: ~1.000 linjer mindre
  kode at læse forkert.
- **Anbefaling:**
  1. Flyt `eas-cli` og `supabase` til `devDependencies`. Bekræft først at intet
     `package.json`-script eller CI-trin afhænger af dem som runtime-dependencies —
     `build-aab:android` bruger `npx eas`, hvad der virker fra `devDependencies`.
  2. Fjern `@expo/ui`.
  3. Slet den døde kode. Behandl `StopWatch.js` og de fem ubrugte `Sync`-komponenter først — de
     er de største og mest forvirrende, fordi de ligner aktiv infrastruktur.
     **Bekræft først med ejeren** at de fem sync-komponenter ikke er "endnu ikke tilkoblet"
     snarere end "opgivet".
  4. Overvej at fjerne `fitven-run-walk-fix.patch` fra repoet (git har historikken).
- **Risiko:** Lav, men ikke nul: de fem `Sync`-komponenter kan være halvfærdig funktionalitet
  frem for død kode. Spørg før du sletter. Efter fjernelse: kør en fuld build
  (`npx expo export --platform android`) og et smoke-test af login, træningslogning og sync.
- **Indsats:** Lille

---

# Del 3 — Undersøgt, men ingen ændring anbefalet

Dette afsnit findes for at forhindre at der bliver "optimeret" på noget der ikke er i stykker.
Flere af punkterne herunder ser ineffektive ud ved læsning, og et par af dem havde jeg selv
markeret som fund indtil jeg målte dem.

### D1 — Kalenderens udtryks-indeks virker. Rør det ikke.
`getWorkoutsBetweenDates` (`programRepository.js:1070-1106`) filtrerer på
`date(CASE WHEN … substr(…) … END)` — et beregnet udtryk over det danske `DD.MM.YYYY`-format.
Det ser ud som noget der umuligt kan bruge et indeks.
**Målt:** det gør det. Planen er
`SEARCH w USING INDEX workout_type_instance_calendar_date_idx (<expr>>? AND <expr><?)`.
Det partielle udtryks-indeks i `db.js:48-51` matcher forespørgslens udtryk, selv om indekset
skriver `"date"` og forespørgslen skriver `w.date`.
**Ingen ændring.** Hvis datoformatet eller udtrykket nogensinde omskrives, skal indekset
omskrives med det — ellers falder man tilbage til fuld scanning uden varsel.

### D2 — `getProgramsOverview`s fire aggregeringer er gratis ved realistisk skala.
`programRepository.js:771-823` laver fire ufiltrerede `GROUP BY`-underforespørgsler over
`Mesocycle`, `Microcycle`+`Mesocycle`, `Day`, og `Day`+`Workout_Type_Instance`. Ligner en
klassisk "tung aggregering på hver skærmvisning".
**Målt:** 20 kørsler mod en probe med 2.100 dage og 2.500 workouts lå under måletærsklen
(<0,5 ms pr. kald). Tabellerne er for små til at det betyder noget.
**Ingen ændring.** Det reelle problem er at funktionen kaldes 3 gange pr. HomePage-fokus — det
er dækket af PERF-7 og løses ved at kalde den færre gange, ikke ved at optimere SQL'en.
Genovervej hvis `Day` nogensinde overstiger ~50.000 rækker.

### D3 — 180-dages-hentningen er billig i SQL. Problemet er JS-siden.
Jeg forventede at `HomePage.js:224-227` (hent 180 dage for at bruge 1 række) ville være dyr,
især med `workoutHasPersonalRecordSql`-underforespørgslen pr. række.
**Målt:** 20 kørsler af intervalforespørgslen inkl. PR-underforespørgsel lå under måletærsklen.
Underforespørgslen bruger dækkende indekser
(`SEARCH pr_e USING COVERING INDEX exercise_instance_calendar_workout_idx`,
`SEARCH pr_s USING COVERING INDEX set_calendar_exercise_record_idx`).
**Anbefalingen står stadig** (PERF-7 punkt 2: brug `LIMIT 1`), men **forvent ikke en mærkbar
gevinst** — begrundelsen er ryddelighed og fremtidssikring, ikke målt langsomhed.
Prioritér den lavt.

### D4 — `COLLATE NOCASE`-joinet slår indekset ud, men det er uden betydning.
`getExercisesByWorkout` (`weightliftingRepository.js:661-683`) joiner
`Exercise e ON e.name = ei.exercise_name COLLATE NOCASE`. Fordi `UNIQUE`-indekset på
`Exercise.name` er `BINARY`, kan det ikke bruges.
**Målt:** planen er `SCAN e LEFT-JOIN` — fuld scanning af `Exercise` pr. øvelses-instans.
Men `Exercise` er et katalog på 7–2.000 rækker, og der er ~5 øvelser pr. workout. Selv ved
2.000 katalogrækker er det ~10.000 sammenligninger — under et millisekund.
**Ingen ændring.** Hvis det delte katalog nogensinde vokser til titusinder af rækker, tilføj et
`COLLATE NOCASE`-indeks på `Exercise(name)`. Ikke nu.

### D5 — Et indeks til det 1-sekunds-timer-opslag er ikke løsningen.
`getActiveWorkoutTimer` (`workoutRepository.js:107-128`) filtrerer på `is_active`, `done` og
`timer_start`, hvoraf ingen er indekseret. Planen er `SCAN w` + `USE TEMP B-TREE FOR ORDER BY`
— fuld scanning og temp-sortering, hvert sekund. Det inviterer til et partielt indeks.
**Målt:** 1.000 kørsler lå under måletærsklen. `Workout_Type_Instance` er for lille
(hundreder til få tusinde rækker) til at scanningen koster noget.
**Ingen ændring i databasen.** Et indeks her ville være ren støj — det ville koste ved skrivning
(og `persistWorkoutTimerState` skriver til tabellen hvert par sekunder under en træning) uden
målbar læsegevinst. Det rigtige greb er at fjerne pollingen (PERF-14).

### D6 — Den per-sekund-database-belastning under træning er ikke SQL-problemet.
`ExerciseList`s 1 Hz-genindlæsning ser ud som en databasehammer.
**Målt:** 60 gentagelser (= ét minuts polling) af `getExercisesByWorkout` + `getSetsByWorkout`
mod en 50.000-sæt-probe tog under 2 ms i alt.
**Optimér ikke disse forespørgsler.** Problemet er render-arbejdet og auth-netværkskaldet i
samme kodesti — PERF-1 og PERF-2. Denne måling er grunden til at PERF-2's anbefaling handler om
`React.memo` og dependency-arrays, ikke om SQL.

### D7 — `ensureExerciseOrderColumn` er allerede cachet.
`weightliftingRepository.js:30-58` kaldes i toppen af 14 repository-funktioner og laver et
`PRAGMA table_info` + en `UPDATE`. Det ligner et per-forespørgsel-overhead. Den er gated af
`exerciseOrderColumnReadyByDatabase`-mappet (`:33-35`), så den kører **én gang pr. database pr.
app-session.**
**Ingen ændring.** Mønsteret er allerede korrekt.

### D8 — Begge contexts er korrekt memoiserede.
`ThemeContext.js:100-103` og `ExerciseViewSettingsContext.js:70-84` bruger `useMemo` med præcise
deps og `useCallback` på alle settere. Ingen "context der opdaterer for bredt".
**Ingen ændring.** (Accent-temaets remount-problem, PERF-16, ligger i `App.js`'s `key`-prop,
ikke i contexten.)

### D9 — Tekstfelter i sætlisten committer korrekt.
`ThemedEditableCell.js:64-70` committer på `onBlur`, og kun hvis `localValue !== value`. Der er
altså ingen skrivning eller PR-genberegning pr. tastetryk.
**Ingen ændring.** Dette er allerede den rigtige løsning, og det er grunden til at PERF-5's
frekvens er "pr. felt-commit", ikke "pr. tastetryk".

### D10 — Det sociale feed og vennernes aktivitet er korrekt bygget.
`socialPostService.js:829-882` er pagineret (6 pr. side) og batcher likes med
`.in("post_id", postIds)`. `socialService.js:330-333` batcher aktivitets-opslag med
`.in("user_id", uniqueUserIds)`. Ingen N+1, ingen over-fetch.
**Ingen ændring.** Dette er den standard resten af netværkskoden bør holdes op mod.

### D11 — GPS-skrivestien er allerede optimeret.
`locationService.js:149-189` (`recordTrackedLocations`) kører ~1 Hz fra baggrunds-tasken. Den
bruger én transaktion pr. batch, læser kun det seneste punkt (indekseret via
`location_log_workout_timestamp_idx`), og springer duplikater over. `App.js:66-118` cacher
databaseforbindelsen med `busy_timeout` og WAL, med en kommentar der beskriver præcis det
problem den løser.
**Ingen ændring.** Skrivestien er fin — det er læsestien der er problemet (PERF-4).

### D12 — Små løkker og lister.
`WEEKDAY_LABELS` (7), `DEFAULT_WORKOUT_TYPES` (6, `db.js:11-18`), `GROUP_FILTERS`,
`SICKNESS_TYPES`, `heartRateAxisTicks` (4-5 elementer), uge-stripens 7 celler, og `monthPages`
(3 måneder). Alle kører én gang over en håndfuld elementer.
**Ingen reel effekt — rør dem ikke.** Der er ingen grund til at memoisere
`Array.from({length: 7})`.

### D13 — HomePages `FlatList` er korrekt opsat.
`HomePage.js:601-612`: stabil `keyExtractor` (`String(post.id)`), `renderItem` i `useCallback`,
header og footer memoiserede, `onEndReached` med paginerings-guards
(`workoutSummaryFeedLoadingRef`, `workoutSummaryFeedHasMoreRef`).
**Ingen ændring.** Det er `ExerciseLibraryList` der mangler virtualisering (PERF-13), ikke denne.

### D14 — Baggrunds-syncens coalescing virker.
`weightliftingService.js:26-47` samler hurtige på-hinanden-følgende push-anmodninger til én
kørsel plus en enkelt genkørsel, og `syncScheduler.js` serialiserer alt gennem én promise-kø.
Uden det ville hvert sæt-tryk starte en parallel sync.
**Ingen ændring i selve mekanismen.** Men bemærk: der er ingen *debounce* — første push starter
straks. Under aktiv sætlogning kører push-loopet derfor mere eller mindre kontinuerligt. Det er
ikke en fejl i coalescingen; det er PERF-6's rundture der gør hver kørsel dyr. Ret PERF-6, og
overvej derefter en debounce på 2–5 s hvis målingen viser at det er nødvendigt.

### D15 — Workout-afslutning blokerer ikke UI'et.
`workoutService.js:9-30` og `:32-62` lægger cloud-push og oprettelse af socialt opslag i
baggrunden via `startBackgroundSync`. Brugeren venter ikke på PERF-6's rundture.
**Ingen ændring i strukturen.** Konsekvensen af PERF-6 er derfor forsinket synlighed af det
sociale opslag og øget baggrundsaktivitet — ikke en frossen skærm. Det er grunden til at PERF-6
er HØJ og ikke KRITISK.

---

# Afslutning

## Anbefalet rækkefølge

Højeste gevinst pr. indsats først. De første fem kan laves uafhængigt af hinanden.

1. **PERF-1** — `getUser()` → `getSession()` i `weightliftingService.js:2909`.
   Én linje. Fjerner ~3.600 HTTP-kald pr. træning. *Lille.*
2. **PERF-5** — indeks på `Exercise_Instance(exercise_name)`. Én `CREATE INDEX` i `db.js:41-73`.
   Målt 23× på en sti der rammes 50–70 gange pr. træning. *Lille.*
3. **PERF-8 punkt 1** — gør det andet `reconcile`-kald betinget af `uploadedCount > 0`.
   Halverer sync-downloadet. Samme mønster i 7 funktioner. *Lille.*
4. **PERF-3 punkt 1+3** — `useMemo` om de fire kald i `Run.js:1914-1917`, og fjern de to
   overflødige `sort`. *Lille.*
5. **PERF-10** — fjern engangs-import-payloadet (efter bekræftelse fra ejeren). *Lille.*
6. **PERF-2** — skil urets tick fra datas tick i `Resistance`/`ExerciseList`, plus `React.memo`
   på rækkerne. Største gevinst i appens kerneflow, men kræver omhu. *Middel.*
7. **PERF-7** — del ét dagligt snapshot; `LIMIT 1` på næste workout; focus-guard. *Middel.*
8. **PERF-4** — inkrementel distanceberegning i løbeflowet. *Middel.*
9. **PERF-9** — skalér og konvertér assets. Mekanisk, men mange filer. *Lille.*
10. **PERF-14** — gør bundnavigationens interval betinget af en aktiv træning. *Middel.*
11. **PERF-6 punkt 1+2** — `WHERE needs_sync = 1` i SQL; cache forældre-identiteter. *Lille.*
    (Punkt 3, batch-upsert, er stor og risikabel — tag den som et separat stykke arbejde.)
12. **PERF-12** — saml MicrocyclePages N+1. *Middel.*
13. **PERF-15** — fjern kalenderens dobbelthentning. *Lille.*
14. **PERF-18** — ryd afhængigheder og død kode. *Lille.*
15. **PERF-13** — virtualisér øvelsesbiblioteket. **Kun hvis katalogtællingen retfærdiggør det.**
    *Middel.*
16. **PERF-11** — versionsgate migreringerne. **Mål først.** Punkt 3 (betingede `WHERE`'er) kan
    laves med lav risiko uafhængigt af resten. *Lille → stor.*
17. **PERF-16** — hold rendering tilbage indtil temaet er indlæst. **Mål først.** *Lille.*
18. **PERF-17** — reducér `Sync_Watchers`-volumen. Kræver forståelse af hard-delete-protokollen.
    *Middel.*

## Skal måles før ændring

Rør ikke disse før tallet foreligger — konklusionen kan blive "gør ingenting".

| Fund | Mål dette | Beslutningsregel |
|------|-----------|------------------|
| **PERF-11** | `initializeDatabase`-varighed på en rigtig brugerdatabase, fysisk mellemklasse-Android, median af 5 kolde starter | <150 ms → nedgradér til LAV, lad ligge. >500 ms → øverste prioritet |
| **PERF-16** | Mount-tæller i `RootNavigator` over 10 kolde starter med et ikke-standard accent-tema | 1 mount → fundet er ugyldigt, luk det. 2 mounts → bekræftet |
| **PERF-13** | `SELECT COUNT(*) FROM Exercise` efter en gennemført biblioteks-sync; tid til interaktiv liste | <60 øvelser → LAV, lad ligge. >200 → HØJ |
| **PERF-17** | `claimableRecords.length` pr. kald og request-body-størrelse på en konto med historik | <1.000 records → LAV. >10.000 → HØJ |
| **PERF-5** | `SELECT COUNT(*) FROM "Set"` på en rigtig brugerdatabase | <5.000 → MIDDEL (lav den alligevel, den er gratis). >20.000 → KRITISK |
| **PERF-10** | `source-map-explorer` på den eksporterede bundle | Bekræft payloadets andel før du argumenterer for gevinsten |
| **PERF-8** | Downloadet volumen ved én forgrundsaktivering | Sætter forventningen til punkt 2's gevinst |
| **PERF-1, PERF-2** | React DevTools Profiler-commits + `fetch`-tæller under en kørende timer | Bekræfter 1 Hz-frekvensen (forventning: ~60 renders og ~60 auth-kald pr. minut) |

## Målepunkter efter ændring

Mål **før** enhver ændring, så der findes et sammenligningsgrundlag. Alle tal skal tages på samme
fysiske enhed med samme brugerdatabase.

**Flow F1 — app-start**
- Kold-start-tid til interaktiv HomePage (median af 5). *Effekt fra: PERF-10, PERF-11, PERF-16.*
- `initializeDatabase`-varighed isoleret. *PERF-11.*
- Antal mounts af `RootNavigator` og `HomePage` pr. kold start. **Mål: 1 hver.** *PERF-16.*
- JS-bundle-størrelse i bytes. *PERF-10, PERF-18.*

**Flow F2 — logning af styrketræning** (den vigtigste måling i hele rapporten)
- **HTTP-kald pr. minut med kørende timer. Mål: 0 fra `auth/v1/user`.** *PERF-1.*
- **Commits af `ExerciseList` og `SetList` pr. 10 s med kørende timer. Mål: kun ved faktiske
  datamutationer, ikke 10 pr. 10 s.** *PERF-2.*
- SQLite-forespørgsler pr. sekund med kørende timer. **Mål: 0 i tomgang.** *PERF-2.*
- Tid fra tryk på "sæt udført" til UI'et opdaterer (median af 20 tryk, sent i en træning så
  historikken er stor). *PERF-5.*
- Antal HTTP-rundture for én `pushDirtyStrengthHierarchyWithCloud` efter en træning med N nye
  sæt. Beregn rundture/sæt. **Mål: <2 (fra 4–6).** *PERF-6.*

**Flow F3 — løbetræning**
- Tid for de fire beregninger i `Run.js:1914-1917`, målt ved 10, 30 og 60 minutters turlængde.
  **Mål: konstant, ikke voksende. Under 16,7 ms.** *PERF-3.*
- Tid for `loadTrackedRunSummary` ved samme tre tidspunkter. **Mål: konstant.** *PERF-4.*
- Frame-drops pr. minut i turens sidste 10 minutter. *PERF-3, PERF-4.*
- Batteriforbrug over en 45-minutters tracket tur (Battery Historian). *PERF-3, PERF-4, PERF-14.*
- Bekræft at den samlede distance er identisk med den nuværende beregning inden for 1 m, på
  mindst tre ture inkl. én med pause og én hvor appen killes undervejs. *PERF-4 — dette er et
  korrekthedskrav, ikke et performancekrav.*

**Flow F4/F5 — navigation**
- SQLite-forespørgsler pr. HomePage-fokus. **Mål: <10 (fra ~28).** *PERF-7.*
- SQLite-forespørgsler pr. `MicrocyclePage`-visning. **Mål: <10 (fra ~135).** *PERF-12.*
- SQLite-forespørgsler pr. kalender-månedsswipe. **Mål: 3 (fra 6).** *PERF-15.*
- Tid til interaktivt øvelsesbibliotek, og tastetryk-til-visning i søgefeltet. *PERF-13.*

**Tomgang**
- SQLite-forespørgsler og React-commits pr. minut med appen åben, ingen aktiv træning.
  **Mål: 0.** *PERF-14.*
- Downloadet volumen pr. forgrundsaktivering uden ændringer. **Mål: nogle få kB.** *PERF-8.*

**Assets**
- Samlet asset-størrelse i `src/` og APK-størrelse. *PERF-9.*
- Grafik-hukommelse på `ExerciseLibraryPage` og løbeskærmen (Android Studio Memory Profiler,
  "Graphics"). *PERF-9.*
- Visuel inspektion af hver ændret asset på en @3x-enhed side om side med originalen.
  *PERF-9 — kvalitetskrav, ikke performancekrav.*
