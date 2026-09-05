# Strukturgennemgang — FitVen

**Dato:** 2026-09-05
**Omfang:** hele repoet (`C:\Users\sebas\Desktop\FitVen\FitVen`)
**Målt på:** arbejdstræet på branch `chore/dev-build-variant` med ~40 ukommitterede ændringer
**Formål:** sikre en skalerbar struktur for mennesker OG gøre kodebasen billig og forudsigelig at navigere for AI-kodeagenter
**Status:** rapport. Ingen filer er ændret, flyttet eller slettet som led i analysen.

> **Til en kode-agent der læser dette:** Del 1 er reference — læs den for at forstå strukturen.
> Del 2 er fund med id'er. Del 3 er de navigationsdokumenter der bør skrives.
> Del 4 er ting du IKKE skal gå i gang med. Rækkefølgen står til sidst.

---

## Executive summary

Lagdelingen er reelt sund: `Pages → Services → Repository → Database` holder, og der er kun 3 UI-filer der går uden om (auth). Problemet er ikke lagene — det er **størrelsen og navngivningen inde i dem**. To filer (`programService.js` 7.427 linjer, `Run.js` 5.169 linjer) bærer hver især en hel feature, og `programService.js` indeholder både sky-sync-motoren for 7 entiteter og al programdomænelogik. Den største risiko er ikke størrelsen, men at **14 UI-filer importerer en service og navngiver den `xRepository`** — kombineret med **45 funktionsnavne der findes i både Service- og Repository-laget**. En agent der læser `weightliftingRepository.updateSetField(...)` i en skærmfil vil med høj sandsynlighed rette i den forkerte af to filer. Det koster mest i dag: at ændre ét felt på et træningssæt kræver ~600 KB kildekode fordelt på 8-11 filer i 4 lag plus en manuel Supabase-ændring uden migrationsspor i repoet. Der findes allerede fire `AGENTS.md`-filer med god disciplin omkring branch/version — men de beskriver ikke en eneste af de fælder, der faktisk får agenter til at fejle her.

---

# Del 1 — Strukturen som den er

## 1.1 Mappekort

Kun sporede filer (452 i git). `node_modules/` (50.619 filer), `android/` (1.248), `.expo/`, `dist/` er gitignorerede.

```
FitVen/
├── App.js                       481 linjer — navigation, providers, DB-init, baggrundsopgave, global bundnav
├── index.js                     8   — registerRootComponent
├── AGENTS.md                    4,4 KB — rod-agentguide (branch/version/issue-regler)
├── README.md                    300 linjer — arkitektur + versionering (delvist forældet, se 1.7)
├── CHANGELOG.md                 945 linjer / 45 KB
├── app.json / eas.json / package.json / tsconfig.json (tom, extends expo base)
├── .githooks/post-commit        auto-push efter commit
├── assets/                      11 filer — app-ikoner, hero-billeder
├── docs/                        20 filer — 19 løse .sql-filer (4.580 linjer) + VERSIONING.md
├── plugins/withDevAppVariant.js 1 fil — Expo config-plugin
├── scripts/                     13 filer — versionering, release, 9 ad-hoc testscripts
├── supabase/                    3 filer — config.toml + 2 edge functions (INGEN migrations-mappe)
├── design_handoff_fitven_redesign/ 3 filer — designudkast, ikke kode
└── src/                         387 sporede filer, 296 .js, 88.524 linjer, 2,56 MB
    ├── AGENTS.md                lagbeskrivelse + sync-regler
    ├── Contexts/                3 filer, 302 linjer — Auth, Theme, ExerciseViewSettings
    ├── Database/                5 filer, 2.395 linjer + AGENTS.md
    │   └── schema/              4 filer, 378 linjer — CREATE TABLE-strenge
    ├── Repository/              6 filer, 5.699 linjer — rå SQL, 250 eksporterede funktioner
    ├── Services/                16 filer, 22.143 linjer — domænelogik + al sky-sync
    ├── Sync/                    11 filer, 554 linjer — React-komponenter der trigger sync
    ├── Utils/                   18 filer, 1.864 linjer
    ├── Pages/                   25 sidemapper, 118 .js, 43.409 linjer + AGENTS.md
    └── Resources/               201 filer
        ├── ThemedComponents/    20 filer, 2.997 linjer (barrel-eksport)
        ├── Components/          26 filer, 5.644 linjer — delte, ikke-tema-primitiver
        ├── Icons/UI-icons/      51 SVG-komponenter
        ├── Icons/WorkoutLabels/ 12 SVG-komponenter (barrel)
        ├── BodyMap/             73 filer (71 SVG muskelmasker, 2 PNG)
        ├── Images/              13 filer (Dark/Light-varianter)
        ├── Figures/             2 filer, 595 linjer
        └── GlobalStyling/       4 filer, 435 linjer — colors, typography, theme, spacing
```

## 1.2 Organiseringsprincip

**Blanding, og skillelinjen er bevidst og konsekvent.**

- **Efter type på øverste niveau:** `Database / Repository / Services / Pages / Resources / Sync / Utils / Contexts`.
- **Efter feature inde i `Pages/`:** hver side er en mappe med `XPage.js` + `XPageStyle.js` + `Components/`-undermappe, rekursivt (op til 8 niveauer: `Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/`).

Skillelinjen går altså ved UI/ikke-UI. Det er dokumenteret i `src/AGENTS.md` og reelt overholdt. **Undtagelsen** er `src/Resources/Components/`, der indeholder 26 filer med både ægte delte primitiver (`ProgressBar`, `CoverGradient`, `StatusPill`) og store feature-komponenter (`StartWorkoutSheet.js` 1.325 linjer, `WorkoutCopyTargetModal.js` 612, `FriendsActivity/` 443). Se STRUKT-17.

## 1.3 Indgangspunkter

| Hvad | Hvor |
|---|---|
| App-rod | `index.js` → `App.js` |
| Navigation (28 `Stack.Screen`) | `App.js:367-406` i `RootNavigator()` |
| Providers | `App.js:469` → `AuthProvider` → `ThemeModeProvider` → `ExerciseViewSettingsProvider` → `SQLiteProvider` |
| DB-init | `App.js:431` `handleInitializeDatabase` → `src/Database/db.js:1433 initializeDatabase()` |
| Bruger-scopet DB-navn | `src/Database/localDatabase.js` (`datab-user<id>.db` / `datab-anon.db`, legacy-kopiering fra `datab.db`) |
| Supabase-klient | `src/Database/supaBaseClient.js` — URL + anon-nøgle **hardkodet**, ingen env-lag |
| Global bundnavigation | `App.js:414` `<ThemedBottomNavigation>` — monteret **uden for** navigatoren, én instans for hele appen |
| Baggrunds-GPS | `App.js:139` `TaskManager.defineTask(locationService.RUN_LOCATION_TASK, ...)` + egen SQLite-forbindelse (`App.js:79-127`) |
| Sync-mount | `App.js:459-463` — 5 komponenter |

## 1.4 Datalag

Ét lag, og det holder næsten. Målt på hele `src/`:

| Fra → Til | Antal imports |
|---|---|
| Pages → Resources | 259 |
| Pages → Utils | 46 |
| Pages → Services | 34 |
| Pages → Contexts | 15 |
| **Pages → Database** | **3** ← eneste UI-gennembrud |
| Resources → Services | 8 |
| Sync → Services | 11 |
| Sync → Contexts | 10 |
| Services → Utils | 19 |
| Services → Database | 7 |
| Services → Repository | 5 |
| Repository → Database | 1 |
| **Utils → Services** | **1** ← inversion |

**Steder der taler direkte med datakilden uden om `Repository/`:**

| Fil | Hvad |
|---|---|
| `src/Repository/*.js` | 261 SQL-sætninger — det korrekte sted |
| `src/Database/db.js` | 58 SQL-sætninger — migrationer |
| `src/Services/localProgramImportService.js` | 10 SQL + 9 `runAsync/getAllAsync` |
| `src/Services/programTransferService.js` | 9 SQL + 22 `runAsync/getAllAsync` |
| `src/Services/programService.js` | 8 SQL |
| `src/Services/weightliftingService.js` | 4 SQL |
| `src/Services/socialPostService.js` | 2 SQL + 5 `runAsync` |
| `src/Resources/Components/CalenderPastePicker/Microcycle.js` | **2 SQL i en UI-komponent** |
| `src/Pages/LoginPage`, `RegisterPage`, `ProfilePage` | importerer `Database/supaBaseClient` direkte (auth) |
| `src/Contexts/AuthContext.js` | 6 `supabase.*`-kald |

44 filer bruger `useSQLiteContext()` — dvs. skærme henter DB-handlen selv og sender den ned i servicekald (`programService.getDayDetails(db, ...)`). Det er repoets gennemgående kaldemønster.

## 1.5 Delt tilstand

| Type | Fil | Hvem afhænger |
|---|---|---|
| Context | `src/Contexts/AuthContext.js` (98) | App.js, alle 5 Sync-komponenter, LoginPage, RegisterPage, ProfilePage, HomePage |
| Context | `src/Contexts/ThemeContext.js` (117) | App.js, ProfilePage/AccentThemePicker |
| Context | `src/Contexts/ExerciseViewSettingsContext.js` (87) | App.js, ExerciseRow, SetList |
| Provider | `SQLiteProvider` (expo-sqlite) | 44 filer via `useSQLiteContext()` |
| **Muteret modul-singleton** | `Colors` i `src/Resources/GlobalStyling/colors.js` — `applyAccentTheme()` kører `Object.assign(Colors.dark, accent.dark)` **in-place** | **130 filer** importerer `Colors` |
| Modul-singleton (event-bus) | `src/Utils/restTimerEvents.js` — `activeRestTimer` + listener-Set | SetList, ThemedBottomNavigation |
| Modul-singleton (event-bus) | `src/Utils/quickWorkoutMenuEvents.js` | HomePage, ThemedBottomNavigation |
| Modul-singleton (kø) | `src/Services/syncScheduler.js` — global `activeSyncQueue`-promise | alle 5 monterede Sync-komponenter via `Sync/syncQueue.js` |
| Modul-singleton (state) | `src/Database/transaction.js` — `databaseTransactionStates` Map, forhindrer nestede transaktioner | alle services via `Services/shared.js` |
| Modul-cache | `App.js:97` `locationTaskDatabaseCache` — separat SQLite-forbindelse til baggrundsopgaven |

## 1.6 De 10 største filer

| # | Sti | Linjer | Bytes | Indhold |
|---|---|---:|---:|---|
| 1 | `src/Services/programService.js` | **7.427** | 235 KB | L40–5.250: hele sky-sync-motoren (Program, Mesocycle, Microcycle, Day, Workout_Type_Instance, Exercise_Instance, Set — normalize/compare/payload/ensureCloudIdentity/reconcile ×7). L5.250–7.427: programdomæne (75 eksports: CRUD, sygdom, kopiering, kalender, dagsoverblik) |
| 2 | `src/Pages/.../Run/Run.js` | **5.169** | 166 KB | Hele løbeskærmen: timer, GPS, pulsmåler, intervaller, kort, afslutning |
| 3 | `src/Services/zhadowsebProgramImportPayload.js` | **4.987** | 154 KB | Genereret JSON-datablob for **én navngiven bruger**, markeret "Temporary one-time" |
| 4 | `src/Services/weightliftingService.js` | **4.272** | 122 KB | L1–2.420 hjælpere (muskelgrupper, kolonnepræferencer, sky-sync); L2.421–4.272: 40 eksports |
| 5 | `src/Repository/programRepository.js` | **2.938** | 75 KB | 153 eksporterede SQL-funktioner |
| 6 | `src/Pages/.../Run/RunStyle.js` | **2.081** | — | Ét `StyleSheet.create` |
| 7 | `src/Repository/weightliftingRepository.js` | **2.024** | — | 92 eksporterede SQL-funktioner |
| 8 | `src/Database/db.js` | **1.735** | 55 KB | Migrationsmotor: 12 tabel-rebuilds, triggere, backfills, reparationsrutiner |
| 9 | `src/Pages/.../Run/RunSetList.js` | **1.564** | — | Løbesæt-liste |
| 10 | `src/Pages/WorkoutCalendarPage/WorkoutCalendarPage.js` | **1.415** | — | Kalenderskærm |

Lige under: `MicrocycleList.js` 1.370, `StartWorkoutSheet.js` 1.325, `ExerciseLibraryList.js` 1.316, `SetList.js` 1.243, `PersonalRecordsPage.js` 1.165, `socialService.js` 1.191, `ExerciseRow.js` 1.030, `ThemedBottomNavigation.js` 1.024.

## 1.7 Eksisterende navigationsdokumenter

| Fil | Status |
|---|---|
| `AGENTS.md` (rod, 4,4 KB) | **Korrekt og værdifuld.** Branch-disciplin, versionerings-preflight, GitHub-issue-labels. Peger på 3 lokale guides — alle 3 findes. **Mangler:** ikke ét ord om de fælder der faktisk får agenter til at fejle her (service/repository-aliasering, døde Sync-komponenter, tema-mutation). |
| `src/AGENTS.md` (1,8 KB) | Korrekt lagbeskrivelse. Sync-reglerne ("Set er laveste sync-grænse", "Run har egen workout-niveau sync-sti") er **rigtige og ikke-udledelige fra koden** — det er det bedste dokument i repoet. |
| `src/Pages/AGENTS.md` | Korrekt, men generisk. Ingen af de konkrete UI-konventioner (temaopslagslinjen, Style-filmønsteret) er nævnt. |
| `src/Database/AGENTS.md` | **Meget stærkt.** SQLite-forbindelseslivscyklus-reglerne er hårdt tilkæmpet viden. Nævner ikke at skemaet lever to steder. |
| `README.md` (300 linjer) | **Drevet fra virkeligheden.** Projektstruktur-blokken (L60–95) lister `Pages/ExerciseStoragePage/` (findes ikke), og mangler 17 af 25 sider. `Services/`-listen mangler 6 af 12 services. Påstår "The app currently uses a local SQLite database, not a remote backend" — der er 5 aktive sky-sync-loops og 2 Supabase edge functions. `WeekPage ... currently isn't used` — men `WeekPage/Components/Day/Components/PickWorkoutModal` bruges af to levende skærme. |
| `docs/VERSIONING.md` (135) | Korrekt. |
| `docs/*.sql` (19 filer) | Løsblade uden rækkefølge, ingen `applied`-markering. Se STRUKT-15. |
| **`CLAUDE.md`** | **Findes ikke** — hverken i roden eller nogen undermappe. |

---

# Del 2 — Fund

## STRUKT-1: Services importeres og navngives `Repository` i 14 UI-filer, og 45 funktionsnavne findes i begge lag

- **Kategori:** forudsigelighed
- **Alvorlighed:** **KRITISK**
- **Hvor:**
  - `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js:32`
  - `src/Pages/WorkoutPage/.../ExerciseRow/ExerciseRow.js:27`
  - `src/Pages/WorkoutPage/.../ExerciseList/ExerciseList.js:13`
  - `src/Pages/WorkoutPage/WorkoutTypes/Run/RunSetList.js:30` og `Run.js:64,66`
  - `src/Pages/SetPage/SetPage.js:10`
  - `src/Pages/MicrocyclePage/Components/MicrocycleList/MicrocycleList.js:30`
  - `src/Pages/WeekPage/Components/Day/Day.js:29`, `.../Day/Utility/dateCalculation.js:3`
  - `src/Pages/ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList.js:16`
  - `src/Resources/Components/CalenderPastePicker/{Mesocycle,Microcycle,Workout}.js`
  - `src/Resources/Components/ExerciseDropdown/ExerciseDropdown.js:6`
  - `src/Resources/Components/StopWatch.js:12`
- **Problem:** Alle 14 skriver `import { weightliftingService as weightliftingRepository } from ".../Services"`. I filens krop står der `weightliftingRepository.updateSetField(...)` — men det er **servicen**. Samtidig deler de to lag 45 funktionsnavne: 13 mellem `weightliftingService`/`weightliftingRepository` og 32 mellem `programService`/`programRepository` (bl.a. `updateSetField`, `createProgram`, `getActiveProgram`, `updateSicknessPeriod`, `getWeeksBeforeMesocycle`).
- **Konkret konsekvens:** Opgave: *"når vægten på et sæt ændres, skal sættet også markeres dirty"*. Agenten læser `SetList.js`, ser `weightliftingRepository.updateSetField(...)`, søger på `weightliftingRepository` og lander i `src/Repository/weightliftingRepository.js:1874` — som **er en rigtig funktion med samme navn og samme signatur**. Den ændrer der. Men UI'et kalder `src/Services/weightliftingService.js:4046`, der wrapper repository-kaldet i `withTransaction` + `refreshPersonalRecordsForSet` + `syncSetsInBackground`. Ændringen får ingen effekt, testen fejler ikke (der er ingen), og fejlen opdages først i produktion. Der er ingen typer og ingen linter til at fange det.
- **Rammer den:** **begge** — men agenter hårdest, fordi de navigerer på navn frem for på hukommelse om koden.
- **Anbefaling:** Fjern aliasserne. Importér med det rigtige navn (`weightliftingService`, `programService`, `runningService`, `workoutService`) i alle 14 filer. Det er en ren søg-og-erstat pr. fil: skift importlinjen og alle forekomster af `xRepository.` til `xService.` i samme fil. Ingen adfærdsændring. Skriv derefter reglen ned i `src/CLAUDE.md`: *aliasér aldrig et lag til et andet lags navn*.
- **Indsats:** Lille (14 filer, mekanisk, verificerbart med `grep -rn "Service as .*Repository" src`).
- **Risiko ved at lade være:** Stiger. Hver ny funktion i et af de to store service/repository-par øger kollisionsfladen. 45 kollisioner i dag; mønsteret er, at services spejler repository-navne 1:1.

## STRUKT-2: `programService.js` (7.427 linjer) er to systemer i én fil

- **Kategori:** modulgrænser / token-omkostning
- **Alvorlighed:** **KRITISK**
- **Hvor:** `src/Services/programService.js`
- **Problem:** Filen indeholder to helt adskilte ting.
  - **L40–L5.250 (~5.200 linjer, ~70 %): sky-sync-motoren.** Syv gange det samme mønster (Program, Mesocycle, Microcycle, Day, Workout_Type_Instance, Exercise_Instance, Set), hver med ~10 funktioner: `parseCloudXId`, `resolveXCloudLocalId`, `getComparableXSnapshot`, `areComparableXsEqual`, `buildCloudXPayload`, `ensureXCloudIdentity`, `processQueuedXDeletes`, `uploadDirtyXs`, `reconcileXsFromCloud`, `syncXsWithCloudInternal`, `syncXsInBackground`. Plus fælles watcher/cascade-logik (`claimCloudWatcher`, `hasCloudChildren`, `markCloudDescendantsDeleting`, `ackCloudDeletionCascade`).
  - **L5.250–L7.427 (~2.200 linjer): programdomænet.** 60+ eksports: program-CRUD, mesocyklus, mikrocyklus, dag, sygdomsperioder, træningskopiering, kalender, dagsoverblik, træningsbibliotek.

  De to dele deler næsten intet ud over `getAuthenticatedUserId()`. Note: `Set`- og `Exercise_Instance`-sync ligger i **programService**, ikke i `weightliftingService` — stik imod hvad navnet antyder.
- **Konkret konsekvens:** (a) En agent, der skal rette en sygdomsperiode (`markDaySick` på L6.730), kan ikke bruge et smalt `Read`-vindue uden først at gætte linjenummeret, og læser typisk hele filen: **235 KB ≈ 65-70k tokens** for en ændring på 20 linjer. (b) Værre: opgaven *"tilføj Sickness til sky-sync"* — sync-mønsteret for en ny entitet er ~600 linjer boilerplate spredt over 10 funktioner i 5 forskellige sektioner af filen. Ingen agent finder alle 10 uden at læse hele filen. `Sickness` står allerede i `initializeSideBySideSyncMetadata`-listen i `db.js:203`, men har ingen sync-implementering — den næste, der prøver, rammer præcis dette.
- **Rammer den:** begge.
- **Anbefaling:** Del filen i to, uden at flytte logik:
  - `src/Services/cloudSync/` — én fil pr. entitet (`programSync.js`, `mesocycleSync.js`, `daySync.js`, `setSync.js` …) plus `cloudSyncShared.js` til watcher/cascade/`getAuthenticatedUserId`/normaliseringshjælpere. Genudstil de 8 `syncXWithCloud`-eksports fra `src/Services/cloudSync/index.js`.
  - `src/Services/programService.js` beholder L5.250+ og re-eksporterer sync-funktionerne, så **ingen kaldsside ændres**.

  Det gør hver enhed 400-700 linjer og gør sync-mønsteret synligt som mønster i stedet for som gentagelse.
- **Indsats:** Mellem (mekanisk flytning, men 7.427 linjer skal deles præcist; ingen kaldsside ændres hvis re-eksporten er komplet).
- **Risiko ved at lade være:** **Stiger hurtigt.** Filen er vokset til 7.427 linjer på ~2 måneder. Hver ny synkroniseret entitet lægger ~600 linjer til. Ved 10.000 linjer er den ulæselig for enhver kontekstlængde.

## STRUKT-3: Ét nyt DB-felt skal huskes 8-11 steder i 4 lag plus manuelt i Supabase

- **Kategori:** ændringsradius
- **Alvorlighed:** **KRITISK**
- **Hvor:** målt på det eksisterende felt `Set.visible_columns`-mønster og `Set.rpe`.
- **Problem:** Sporing af `visible_columns` giver 11 filer; `rpe` giver 13. For et **synkroniseret** felt på `Set` skal følgende opdateres i samme opgave, og fejl i ét led er tavse:

| # | Fil | Hvad |
|---|---|---|
| 1 | `src/Database/schema/weightlifting.js:53` | `CREATE TABLE "Set"` — for nye installationer |
| 2 | `src/Database/db.js` (`migrateSetSchema`, L509-612) | tabel-rebuild for eksisterende installationer |
| 3 | `src/Repository/weightliftingRepository.js` | SELECT-listerne (feltet skal med i **hver** relevant select — der er 82 SQL-sætninger) |
| 4 | `src/Repository/weightliftingRepository.js` | INSERT/UPDATE + `needs_sync = 1` |
| 5 | `src/Services/programService.js:1273` `getComparableSetSnapshot` | ellers ses ændringen aldrig som "ændret" |
| 6 | `src/Services/programService.js:1294` `areComparableSetsEqual` | samme |
| 7 | `src/Services/programService.js:1315` `buildCloudSetPayload` | ellers uploades feltet aldrig |
| 8 | `src/Services/programService.js` `reconcileSetsFromCloud` | ellers overskrives feltet lokalt ved næste pull |
| 9 | `src/Services/weightliftingService.js` | evt. normalisering/afledte felter |
| 10 | `src/Pages/.../SetList/SetList.js` + `Title.js` + `SetListStyle.js` | visning |
| 11 | **Supabase-tabellen `set`** | manuelt i konsollen, ingen migration i repoet (se STRUKT-15) |

- **Konkret konsekvens:** Den hyppigste agentfejl her er at gøre 1-4 og 10 (det er den synlige del: "gem i DB og vis det") og springe 5-8 over. Resultatet er et felt der virker perfekt på én telefon og forsvinder på den anden — og først når skyen svarer. Det er praktisk talt umuligt at fejlfinde bagefter uden at kende sync-motorens interne struktur.
- **Rammer den:** **begge**, men agenter uforholdsmæssigt hårdt: der er intet i koden der forbinder punkt 1 med punkt 7.
- **Anbefaling:** To ting, i rækkefølge.
  1. **Skriv checklisten ned** i `src/Services/CLAUDE.md` (NAV-3 nedenfor). Det er lav indsats og fjerner det meste af risikoen straks.
  2. Når STRUKT-2 er udført: gør feltlisten til **data i stedet for kode**. Hver entitet får en `SYNCED_FIELDS`-array, og `getComparableSnapshot`, `areComparableEqual` og `buildCloudPayload` genereres ud fra den. Så bliver punkt 5, 6 og 7 til én linje i én array. Det er den eneste af mine anbefalinger, hvor strukturen selv fjerner duplikeringen.
- **Indsats:** Lille (dokument) / Mellem (feltliste-refaktorering, efter STRUKT-2).
- **Risiko ved at lade være:** Konstant høj. Rammer hver eneste gang datamodellen udvides — og det gør den ofte i dette projekt.

## STRUKT-4: 5 af 10 Sync-komponenter er aldrig monteret — død kode der ser levende ud

- **Kategori:** forudsigelighed
- **Alvorlighed:** **KRITISK**
- **Hvor:** `src/Sync/`
- **Problem:** `App.js:459-463` monterer fem: `WorkoutTypeCatalogSync`, `ExerciseLibrarySync`, `SetSync`, `WorkoutTypeInstanceSync`, `PushNotificationRegistrationSync`. De fem andre — `ProgramSync.js`, `MesocycleSync.js`, `MicrocycleSync.js`, `DaySync.js`, `ExerciseInstanceSync.js` — importeres **ingen steder**. De er komplette, velskrevne, 47-49 linjer hver, og ser fuldstændig aktive ud. Program/mesocyklus/mikrocyklus/dag-sync sker i stedet indirekte via `pushDirtyStrengthHierarchyWithCloud` fra `SetSync.js`.
- **Konkret konsekvens:** Opgave: *"mikrocyklus-fokus synkroniserer ikke — fiks det"*. Agenten finder `src/Sync/MicrocycleSync.js`, læser 47 linjer, retter, rapporterer succes. Ingenting sker. Filen kører aldrig. Det er den billigste tænkelige måde at spilde en hel opgave på, og både navn og indhold peger direkte mod fælden.
- **Rammer den:** **begge**. Et menneske vil også antage at en fil i `Sync/` synkroniserer.
- **Anbefaling:** Vælg én: (a) slet de fem filer, eller (b) behold dem og skriv en `src/Sync/CLAUDE.md` med en eksplicit "monteret / ikke monteret"-tabel og hvorfor. Jeg anbefaler (a) for `ExerciseInstanceSync.js` (dækket af `SetSync`s hierarki-push) og (b) hvis de er tænkt som næste skridt. Uanset hvad: en tabel i dokumentet er obligatorisk, fordi App.js-mount-listen ikke er noget en agent naturligt slår op.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Høj og konstant. Hver sync-relateret opgave er en møntkast.

## STRUKT-5: Skemaet findes to steder, og migrationerne er en 1.735-linjers imperativ motor

- **Kategori:** ændringsradius / token-omkostning
- **Alvorlighed:** **HØJ**
- **Hvor:** `src/Database/schema/{program,weightlifting,running,location}.js` (378 linjer) og `src/Database/db.js` (1.735 linjer)
- **Problem:** `schema/*.js` indeholder `CREATE TABLE IF NOT EXISTS` — sandheden for en **ny** installation. `db.js` indeholder 12 tabel-rebuilds (`CREATE TABLE X_next` → kopiér → `DROP` → `RENAME`), `ensureTableColumns`, triggere, backfills og fem "repair"-rutiner (`repairWorkoutTrackingState`, `repairResistanceTrainingState`, `repairRunSetState`, `repairProgramDateFormats`, `repairExerciseOrders`) — sandheden for en **eksisterende** installation. De to kan drive fra hinanden uden at noget klager, og de er 4,6× fra hinanden i størrelse.
- **Konkret konsekvens:** En agent, der kun opdaterer `schema/weightlifting.js`, laver en app der virker for nyinstallationer og fejler stille for alle eksisterende brugere. Den omvendte fejl (kun `db.js`) virker for alle nuværende brugere og fejler for nye. `src/Database/AGENTS.md` advarer om migrationssikkerhed generelt, men siger ikke at der er **to** filer.
- **Rammer den:** begge.
- **Anbefaling:** Ingen omstrukturering — det dobbelte spor er et bevidst og almindeligt SQLite-mønster. Men: (1) skriv reglen i `src/Database/CLAUDE.md`: *enhver skemaændring kræver en ændring begge steder, og de skal give samme sluttilstand*; (2) tilføj en kort kommentarblok øverst i begge filer der peger på den anden. Overvej på sigt at flytte de 5 `repair*`-rutiner til `src/Database/repairs.js` — de er datakvalitetsoprydning, ikke skema, og fylder ~200 linjer i den fil man oftest skal læse.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Stiger med brugerbasen. I dag kan man nulstille lokale data i udvikling; efter release kan man ikke.

## STRUKT-6: `Run.js` er 5.169 linjer og hele løbefeatuen

- **Kategori:** token-omkostning
- **Alvorlighed:** **HØJ**
- **Hvor:** `src/Pages/WorkoutPage/WorkoutTypes/Run/Run.js` (5.169 linjer / 166 KB), `RunStyle.js` (2.081), `RunSetList.js` (1.564)
- **Problem:** Én komponentfil håndterer: træningstimer, GPS-tracking og genstart efter OS-afbrydelse, BLE-pulsmåler, intervalstyring, pause/warmup/cooldown-typer, kortvisning, distanceberegning, afslutning + sky-sync. Til sammenligning har `Resistance/` samme feature delt i 12 filer med største fil på 1.030 linjer.
- **Konkret konsekvens:** Enhver løbeændring — også *"ret teksten på pause-knappen"* — koster ~47k tokens bare at åbne filen. Og fordi `RunStyle.js` er et enkelt 2.081-linjers `StyleSheet.create`, koster en stilændring yderligere ~17k. To filer, ~65k tokens, for en kosmetisk rettelse.
- **Rammer den:** **agenter** primært (mennesker scroller; agenter betaler pr. linje).
- **Anbefaling:** Split efter det mønster `Resistance/` allerede bruger — det er repoets egen konvention, så der opfindes intet nyt:

```
Run/
  Run.js                 ← skærm + state-orkestrering (mål: <800 linjer)
  Components/RunTimer/
  Components/RunMap/
  Components/RunIntervalControls/
  Components/HeartRate/  ← HeartRateDeviceModal.js ligger her allerede
  hooks/useRunLocation.js
  hooks/useRunHeartRate.js
  RunStyle.js            ← deles med komponenterne
```

  Start med de to største og mest selvstændige stykker: GPS-livscyklus og BLE-puls. De har ingen delt state med resten ud over et par callbacks.
- **Indsats:** Stor. **Kræver koordinering** — det er den mest tilstandstunge fil i repoet, og der er ingen tests.
- **Risiko ved at lade være:** Stiger langsomt. Filen er allerede over grænsen for hvad der kan holdes i hovedet, men den er også relativt stabil. Det er en "gør ondt om seks måneder"-sag, ikke en "gør ondt i dag" — medmindre løbefeatuen skal udbygges, og så er den akut.

## STRUKT-7: Fire navne for det samme øvelseskoncept

- **Kategori:** forudsigelighed
- **Alvorlighed:** **HØJ**
- **Hvor:** hele `src/`
- **Problem:** Kataloget over øvelsesnavne hedder:

| Navn | Hvor | Betydning |
|---|---|---|
| tabel `Exercise` | `schema/weightlifting.js:3` | den nuværende tabel |
| tabel `Exercise_storage` | `db.js:269` (legacy-omdøbning), 3 forekomster | det gamle navn på samme tabel |
| `getExerciseStorage` / `createExerciseStorage` | Repository + Service | funktioner mod `Exercise` |
| `ExerciseCatalogPage` | `src/Pages/ExerciseCatalogPage/` | skærm der viser kataloget |
| `ExerciseLibraryPage` / `ExerciseLibraryList` | `src/Pages/ExerciseLibraryPage/` | skærm der viser **hub'en** (genveje til kalender, sygdom, PR) — plus listen der viser kataloget |
| `getExerciseLibraryEntries` | `weightliftingService.js:2551` | katalog + sky-berigelse |
| `AddExerciseStorage/` | `Pages/ExerciseLibraryPage/Components/AddExerciseStorage/` | mappe med **død** modal |

  Og separat: `Exercise_Instance` er noget helt andet (en øvelse i en konkret træning). Dertil importerer `ExerciseCatalogPage.js:7` sin liste fra **søsterens** mappe: `../ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList`.
- **Konkret konsekvens:** Opgave: *"tilføj et filter til øvelsesbiblioteket"*. Der er to plausible skærme (`ExerciseLibraryPage`, `ExerciseCatalogPage`), og den liste der faktisk skal ændres ligger i den ene mappe men bruges af begge. Filteret findes i øvrigt allerede som `ExerciseFilterSheet` under `ExerciseLibraryPage/Components/`. Sandsynligheden for at ramme rigtigt første gang uden at læse alle fire filer er lav.
- **Rammer den:** begge.
- **Anbefaling:** Ikke omdøb tabeller (for dyrt, se Del 4). Gør to billige ting: (1) ét afsnit i `src/Pages/CLAUDE.md` der siger hvad hvert af de fire navne betyder og hvilken skærm der ejer hvad; (2) flyt `ExerciseLibraryList/` til `src/Resources/Components/ExerciseLibraryList/`, da den er delt af to sider — det er allerede repoets regel (`src/Pages/AGENTS.md`: *"Keep page-specific components inside the relevant page folder unless they are reused across multiple screens"*). Reglen er bare ikke fulgt her.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Stiger. Hver ny øvelsesrelateret skærm øger antallet af kandidater.

## STRUKT-8: `getWeeksBeforeMesocycle` findes i tre lag med to forskellige signaturer — og Utils importerer Services

- **Kategori:** modulgrænser / forudsigelighed
- **Alvorlighed:** **HØJ**
- **Hvor:**
  - `src/Repository/programRepository.js:1838` — `(db, { programId, mesocycleNumber })`
  - `src/Services/programService.js:6416` — `(db, { ... })`, wrapper
  - `src/Utils/getWeeksBeforeMesocycle.js:3` — **`({ db, program_id, mesocycle_number })`** — objekt-argument, snake_case
- **Problem:** Utils-versionen er en tredje wrapper med et **andet kaldemønster end resten af kodebasen** (alle andre bruger `(db, {...})`), og den importerer opad i lagene: `import { programService as programRepository } from "../Services"` — den eneste `Utils → Services`-import i repoet, og den bruger også STRUKT-1's alias. Dens eneste kaldssted er `src/Pages/WeekPage/Components/Day/Utility/dateCalculation.js`, som selv er død kode.
- **Konkret konsekvens:** En agent der søger `getWeeksBeforeMesocycle` får tre træffere i tre lag. To af dem har ét kaldemønster, én har et andet. Vælger den forkerte får den `db is undefined` eller en tavs `undefined` — afhængigt af retningen. Derudover: `Utils/` er dokumenteret som *"reusable helpers with minimal side effects"* i `src/AGENTS.md`; en fil der laver databasekald bryder det og gør mappens navn upålideligt.
- **Rammer den:** begge.
- **Anbefaling:** Slet `src/Utils/getWeeksBeforeMesocycle.js` og `src/Pages/WeekPage/Components/Day/Utility/dateCalculation.js` (begge døde). Hvis WeekPage genoplives senere, kalder den `programService.getWeeksBeforeMesocycle(db, {...})` som alle andre.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Middel — den er allerede død, men den er søgbar, og det er nok til at koste en agent en fejlrettelse.

## STRUKT-9: 4.987-linjers genereret datablob for én navngiven bruger ligger i `src/Services/`

- **Kategori:** token-omkostning
- **Alvorlighed:** **HØJ**
- **Hvor:** `src/Services/zhadowsebProgramImportPayload.js` (154 KB), brugt af `src/Services/localProgramImportService.js`
- **Problem:** Filens egen header siger *"Temporary one-time local import payload for zhadowseb@gmail.com"*. Den indeholder en hardkodet e-mail, en bruger-UUID og 203 dage/54 sæt/3 programmer som JSON — i `src/Services/`, mellem den faktiske forretningslogik. Den er **6 % af hele `src/` målt i bytes** og bundles med appen for alle brugere.
- **Konkret konsekvens:** Enhver `grep` i `src/Services/` (fx efter `weight`, `reps`, `rpe`, `sync_id`, et program-id) rammer denne fil hundredvis af gange og drukner de rigtige træffere. Målt: `rpe` giver 58 træffere her mod 4 i `weightliftingService.js`. Agenter der laver bred søgning i servicelaget betaler for det hver gang. Sekundært er der personoplysninger i repoet uden grund.
- **Rammer den:** **agenter** primært.
- **Anbefaling:** Flyt payload'en ud af `src/` (fx `scripts/data/zhadowseb-program-import.json`) og indlæs den i `localProgramImportService` bag den eksisterende e-mail-gate — eller, hvis importen er gennemført, slet både payload og `localProgramImportService.js` (523 linjer). Genereringsscriptet `scripts/generate-local-program-import.js` findes allerede, så den kan genskabes. Ekskludér desuden mønsteret fra agent-søgning (se Del 3).
- **Indsats:** Lille.
- **Risiko ved at lade være:** Konstant. Den bliver ikke værre, men den koster hver eneste gang nogen søger i servicelaget.

## STRUKT-10: Ingen path-aliaser — 166 imports med ≥4 `../`, dybeste med 9

- **Kategori:** forudsigelighed
- **Alvorlighed:** **HØJ**
- **Hvor:** `tsconfig.json` er tom (`{"compilerOptions": {}}`), ingen `babel.config.js`, ingen `metro.config.js`. Værste tilfælde: `src/Pages/WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/SetList.js:5,32` med `"../../../../../../../../../Resources/GlobalStyling/colors"`.
- **Problem:** 33 imports bruger ≥6 niveauer. Fem filer bruger ≥7. Der er ingen måde at verificere en sådan sti visuelt.
- **Konkret konsekvens:** To ting. (a) Når en agent flytter eller opretter en fil i `Resistance/`-træet, skal den tælle `../` korrekt — en fejl på ét niveau giver en runtime-fejl først når skærmen åbnes, ikke ved build. (b) Vigtigere: en agent kan **ikke slå op** hvad `"../../../../../../../../../Services"` peger på uden at tælle mappeniveauer, så den kan ikke afgøre om to filer bruger samme modul uden at regne. Det gør afhængighedsanalyse dyr.
- **Rammer den:** begge, agenter hårdest.
- **Anbefaling:** Tilføj `babel-plugin-module-resolver` (eller Metro `resolver.extraNodeModules`) med aliaser `@services`, `@repository`, `@resources`, `@utils`, `@database`, `@contexts`, og spejl dem i `tsconfig.json > compilerOptions.paths` for editor-navigation. Migrér **ikke** alle 166 imports på én gang; indfør aliaset og lad nye/rørte filer bruge det. Skriv i `src/CLAUDE.md` at aliaset er den foretrukne form.
- **Indsats:** Lille (opsætning) + gradvis migrering.
- **Risiko ved at lade være:** Stiger med træets dybde. `Resistance/`-træet er allerede 8 niveauer; ingen naturlig bund.

## STRUKT-11: README's strukturafsnit er forældet og modsiger koden

- **Kategori:** forudsigelighed
- **Alvorlighed:** **HØJ**
- **Hvor:** `README.md:60-95` (projektstruktur), `README.md:281` (Notes)
- **Problem:** Konkrete fejl:
  - Lister `Pages/ExerciseStoragePage/` — mappen findes ikke.
  - Lister 8 af 25 sider, 6 af 12 services.
  - *"The app currently uses a local SQLite database, not a remote backend"* — der er 5 aktive sky-sync-loops, en Supabase-klient, 2 edge functions og ~5.200 linjer sync-kode.
  - *"WeekPage currently isn't used"* — se STRUKT-12.
- **Konkret konsekvens:** En agent der læser README først (det gør de fleste) danner en forkert model: den tror der ikke er nogen backend, og springer derfor sky-sync-siden af enhver dataændring over. Det er præcis fejl STRUKT-3 beskriver — README **forårsager** den aktivt. Et forkert dokument er værre end intet.
- **Rammer den:** begge.
- **Anbefaling:** Slet filtræs-blokken (`README.md:60-95`) helt — den kan læses direkte af `ls` og bliver forkert igen inden for en måned. Ret "not a remote backend"-sætningen. Behold resten (versionering, run/walk-noter, Google Maps-nøgle, batterioptimering) — det er ikke-udledelig viden og stadig korrekt.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Høj og aktiv. Den vildleder i dag.

## STRUKT-12: `WeekPage` er dokumenteret som ubrugt, men huser en komponent to levende skærme bruger

- **Kategori:** forudsigelighed
- **Alvorlighed:** **HØJ**
- **Hvor:** `src/Pages/WeekPage/Components/Day/Components/PickWorkoutModal/PickWorkoutModal.js`
- **Problem:** README siger WeekPage ikke bruges. `WeekPage` er stadig registreret som rute (`App.js:374`) og optræder i bundnavigationens rutelister (`ThemedBottomNavigation.js:125`). Og `PickWorkoutModal` — begravet 5 niveauer nede i "den ubrugte side" — importeres af `MicrocycleList.js:27` og `WorkoutCalendarPage.js:27`, som begge er centrale, levende skærme.
- **Konkret konsekvens:** To modsatrettede fejl. (a) En agent der får besked på at rydde død kode op sletter `WeekPage/` og brækker mikrocyklus- og kalenderskærmen. (b) En agent der skal ændre "vælg træning"-dialogen leder i `MicrocyclePage/Components/` og finder den ikke.
- **Rammer den:** begge.
- **Anbefaling:** Flyt `PickWorkoutModal/` til `src/Resources/Components/PickWorkoutModal/` og opdatér de to imports. Derefter er `WeekPage/` reelt selvstændig og kan enten beholdes urørt eller slettes som ét stykke. Skriv i `src/Pages/CLAUDE.md` at WeekPage er ude af det aktive flow.
- **Indsats:** Lille (2 imports).
- **Risiko ved at lade være:** Middel, men skarp — den ene fejlvariant er destruktiv.

## STRUKT-13: Død kode i otte filer, heriblandt en forældreløs style-fil i en anden mappe end sin komponent

- **Kategori:** forudsigelighed
- **Alvorlighed:** **MIDDEL**
- **Hvor:** filer uden nogen importør nogen steder i `src/` eller `App.js`:

| Fil | Linjer | Note |
|---|---:|---|
| `src/Resources/Components/SicknessLogCard/SicknessLogCard.js` | 18 | komponenten |
| `src/Pages/HomePage/Components/SicknessLogCard/SicknessLogCardStyle.js` | — | **dens style-fil — i en helt anden mappe** |
| `src/Resources/Components/StopWatch.js` | 184 | kalder `workoutService` |
| `src/Resources/Components/CircularProgression.js` | 139 | |
| `src/Resources/Figures/SlantedDivider.js` | — | |
| `src/Resources/GlobalStyling/spacing.js` | 36 | designtokens ingen bruger |
| `src/Pages/ExerciseLibraryPage/Components/AddExerciseStorage/AddExerciseStorageModal.js` | — | + dens style-fil |
| `src/Pages/.../ExerciseList/Utils/checkUniformSets.js` | — | |
| `src/Pages/WeekPage/Components/Day/Utility/dateCalculation.js` | — | se STRUKT-8 |
| `src/Sync/{Program,Mesocycle,Microcycle,Day,ExerciseInstance}Sync.js` | 5×~48 | se STRUKT-4 |

- **Konkret konsekvens:** `SicknessLogCard` er det værste eksempel: komponenten ligger i `Resources/Components/SicknessLogCard/`, dens style-fil i `Pages/HomePage/Components/SicknessLogCard/`, og ingen af dem bruges. En agent der skal bygge et sygdomskort på forsiden finder mappen `HomePage/Components/SicknessLogCard/`, konkluderer at kortet allerede findes, og bruger tid på at forstå hvorfor det ikke vises. Tilsvarende for `spacing.js`: en agent, der ser en `GlobalStyling/spacing.js`, vil rimeligvis bruge dens tokens — men resten af kodebasen bruger rå tal, så resultatet bliver inkonsistent styling.
- **Rammer den:** begge.
- **Anbefaling:** Slet dem. Git har historikken. Verificér med `grep -rn "<Navn>" src App.js` pr. fil før sletning (mit scan matcher på importsti-basenavne og fanger derfor ikke dynamiske `require` — der er ingen i dette repo, men verificér alligevel).
- **Indsats:** Lille.
- **Risiko ved at lade være:** Middel, stiger langsomt — død kode akkumuleres i takt med redesigns.

## STRUKT-14: Ingen samlet testkommando; ni ad-hoc node-scripts

- **Kategori:** ændringsradius
- **Alvorlighed:** **MIDDEL**
- **Hvor:** `package.json` scripts `test:custom-exercise`, `test:location`, `test:run-intervals`, `test:program-progress`, `test:workout-finish`, `test:profile-birthdate`, `test:heart-rate-settings`, `test:ble-heart-rate`, `test:notifications`
- **Problem:** Der er ingen `npm test`. Hvert script er et selvstændigt node-program der læser kildefilen som tekst og evaluerer den via en base64 `data:`-URL (`scripts/test-run-interval-utils.js:14-16`) for at komme uden om manglende transpilering. De dækker 9 isolerede hjælpefunktioner ud af 88.524 linjer.
- **Konkret konsekvens:** `AGENTS.md` kræver *"Run the relevant tests or checks"* før handoff. En agent kan ikke afgøre hvilke der er "relevant" uden at læse alle 9 scripts, og der er intet at køre efter en ændring i `programService.js` eller `SetList.js` — de to steder hvor STRUKT-1 og STRUKT-3-fejl opstår. I praksis betyder det: **ingen af de kritiske fund ovenfor kan fanges automatisk.**
- **Rammer den:** begge.
- **Anbefaling:** Tilføj `"test": "npm run test:custom-exercise && npm run test:location && ..."` — én kommando, uanset hvor primitiv. Skriv i rod-`CLAUDE.md` at `npm test` er verifikationskommandoen. Overvej derefter node's indbyggede `node --test`. Ikke et argument for at indføre Jest nu (se Del 4).
- **Indsats:** Lille.
- **Risiko ved at lade være:** Stiger. Uden en verifikationskommando er hver af de kritiske fund ovenfor uopdagelige indtil en bruger melder dem.

## STRUKT-15: Supabase-skemaet har ingen migrationshistorik i repoet

- **Kategori:** ændringsradius
- **Alvorlighed:** **MIDDEL** (men **hastende** — se 2.3)
- **Hvor:** `docs/*.sql` (19 filer, 4.580 linjer), `supabase/` (kun `config.toml` + 2 edge functions)
- **Problem:** Skyskemaændringer ligger som løse SQL-filer i `docs/` med navne som `supabase-side-by-side-sync-migration.sql`, `supabase-day-sickness.sql`. Der er ingen nummerering, ingen `supabase/migrations/`-mappe, og intet der siger hvilke der er kørt. Den lokale SQLite-side har en fuld imperativ migrationsmotor (`db.js`); skysiden har ingenting.
- **Konkret konsekvens:** Punkt 11 i STRUKT-3's checkliste er umuligt at verificere fra repoet. En agent kan ikke svare på *"findes kolonnen `set.tempo` i skyen?"* uden adgang til Supabase-konsollen, og kan derfor heller ikke afgøre om en sync-fejl skyldes kode eller manglende kolonne.
- **Rammer den:** begge.
- **Anbefaling:** Flyt til `supabase/migrations/` med tidsstemplede filnavne (Supabase CLI er allerede en dependency: `"supabase": "^2.105.0"`). Behold `docs/` til dokumenter. Som minimum: nummerér filerne og tilføj en `docs/README.md` der siger hvilke der er kørt i produktion.
- **Indsats:** Mellem.
- **Risiko ved at lade være:** **Stiger og bliver dyrere jo længere man venter** — historikken kan ikke rekonstrueres bagudrettet når først rækkefølgen er glemt.

## STRUKT-16: 16 af 54 style-filer hardkoder hex-farver forbi temasystemet

- **Kategori:** forudsigelighed
- **Alvorlighed:** **MIDDEL**
- **Hvor:** bl.a. `Pages/HomePage/HomePageStyle.js` (`#2e2e2e`), `Pages/MicrocyclePage/MicrocyclePageStyle.js` (4), `Pages/.../ExerciseList/ExerciseListStyle.js` (4), `Pages/.../Run/RunStyle.js` (3)
- **Problem:** Konventionen i repoet er: `StyleSheet.create` indeholder **kun** layout, og farver injiceres inline med `const theme = Colors[colorScheme] ?? Colors.light` (mønsteret findes i 132 filer). Det er nødvendigt, fordi `applyAccentTheme()` **muterer** `Colors`-objektet in-place (`colors.js:250`), mens `StyleSheet.create` evalueres én gang ved import. En hardkodet farve — eller en `Colors.dark.x` læst inde i `StyleSheet.create` — fryser i den palet der var aktiv ved app-start og reagerer hverken på lys/mørk eller på accentskift.
- **Konkret konsekvens:** En agent der tilføjer en farve til en `*Style.js`-fil følger det den ser (16 filer gør det) og får en komponent der ikke skifter tema. Fejlen viser sig kun hvis nogen tester accentskift.
- **Rammer den:** begge.
- **Anbefaling:** Skriv reglen i `src/Pages/CLAUDE.md` (den er ikke-udledelig og er den mest brudte konvention i repoet). Ryd de 16 op når filerne alligevel røres — ikke som selvstændig opgave.
- **Indsats:** Lille (dokument) / gradvis (oprydning).
- **Risiko ved at lade være:** Stiger med antallet af accent-temaer.

## STRUKT-17: `Resources/Components/` er blevet en losseplads

- **Kategori:** kohæsion
- **Alvorlighed:** **MIDDEL**
- **Hvor:** `src/Resources/Components/` — 26 filer, 5.644 linjer
- **Problem:** Mappen blander fire kategorier:

| Indhold | Filer | Hvor det hører hjemme |
|---|---|---|
| Ægte delte primitiver | `ProgressBar.js` (45), `StatusPill.js` (58), `CoverGradient.js` (48), `animationHooks.js` (126) | bliv — evt. i `Resources/Primitives/` |
| Store feature-komponenter | `StartWorkoutSheet.js` (1.325), `WorkoutCopyTargetModal.js` (612), `RepeatWorkoutSheet.js` (526) | de bruges kun af `ThemedBottomNavigation` og kalenderen — hører til en `Resources/Components/WorkoutStart/`-gruppering, eller flyttes ned til deres ejer |
| Feature-undertræer | `CalenderPastePicker/` (4 filer, indeholder **rå SQL** i `Microcycle.js`), `BodyMapPreview/` (4), `FriendsActivity/` (2), `ExerciseDropdown/`, `HomeImageShortcutCard/`, `FeedbackModal/` | hver er en selvstændig feature |
| Død kode | `StopWatch.js`, `CircularProgression.js`, `SicknessLogCard/` | slettes (STRUKT-13) |

  Mappenavnet "Components" forudsiger intet: en agent der skal finde "hvor ligger delte komponenter" får 26 filer hvor 3 er over 500 linjer.
- **Konkret konsekvens:** Opgave: *"ændr hvad der sker når man trykker plus i bundnavigationen"*. Sporet er `App.js` → `Resources/ThemedComponents/ThemedBottomNavigation.js` (1.024) → `Resources/Components/StartWorkoutSheet.js` (1.325). Ingen af de to placeringer er gætbare fra opgaven, og "start træning" er ikke noget man forventer i en mappe der hedder `Resources`.
- **Rammer den:** begge.
- **Anbefaling:** Ingen stor flytning nu. Gør to ting: (1) slet de 3 døde filer; (2) beskriv i `src/Resources/CLAUDE.md` hvad der ligger hvor, og især at **det globale bundnavigations-/start-træning-flow bor i `Resources/`, ikke i `Pages/`**. Det er det enkeltstående mest overraskende faktum i mappestrukturen. Genovervej en `Resources/Components/WorkoutStart/`-gruppering hvis flowet vokser.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Stiger med antallet af filer i mappen.

## STRUKT-18: `App.js` har seks ansvar

- **Kategori:** modulgrænser
- **Alvorlighed:** **MIDDEL**
- **Hvor:** `App.js` (481 linjer)
- **Problem:** Filen indeholder: (1) baggrunds-GPS-opgaven med sin egen SQLite-forbindelseshåndtering og cache (L79-185), (2) notifikations-response-routing (L186-206, L256-320), (3) 28 rute-definitioner (L367-406), (4) global bundnavigation uden for navigatoren (L414), (5) sync-komponent-montering (L459-463), (6) DB-init + bruger-scopet databasenavn (L423-467). Providers ligger i `App()` nederst.
- **Konkret konsekvens:** `App.js` skal læses ved næsten enhver opgave, der involverer en ny skærm, sync, eller navigation — 481 linjer ≈ 5k tokens, hver gang. Det er acceptabelt i dag. Men GPS-baggrundsopgaven (L79-185, ~35 % af filen) har intet med app-opsætning at gøre og hører til `src/Services/locationService.js` eller en `src/BackgroundTasks/`-mappe.
- **Rammer den:** begge.
- **Anbefaling:** Flyt GPS-baggrundsopgaven ud (`src/Services/locationBackgroundTask.js`), importér den for sideeffekten i App.js. Overvej at flytte rutelisten til `src/navigation/routes.js` når den overstiger ~40 skærme. Ikke akut.
- **Indsats:** Lille (GPS-opgaven) / Mellem (ruter).
- **Risiko ved at lade være:** Stiger langsomt.

## STRUKT-19: `AGENTS.md` kræver at CHANGELOG læses ved hver handoff — 945 linjer / 45 KB

- **Kategori:** token-omkostning
- **Alvorlighed:** **MIDDEL**
- **Hvor:** `AGENTS.md` "Before handoff" pkt. 2, `CHANGELOG.md`
- **Problem:** Reglen *"Verify that the changelog contains the current branch version and describes the actual changes"* tvinger agenten til at åbne en 45 KB-fil (~13k tokens) i **hver eneste opgave**, for at kontrollere et enkelt afsnit i toppen.
- **Konkret konsekvens:** ~13k tokens spildt pr. opgave. Over 50 opgaver er det 650k tokens brugt på at læse historik ingen skal bruge.
- **Rammer den:** **agenter**.
- **Anbefaling:** Omformulér reglen i rod-`CLAUDE.md`/`AGENTS.md` til: *"Læs kun de første 60 linjer af CHANGELOG.md (`sed -n '1,60p' CHANGELOG.md`) — den aktuelle version står altid øverst."* Overvej at arkivere alt før v0.15 i `docs/CHANGELOG-archive.md`.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Konstant, vokser lineært med projektets alder.

## STRUKT-20: Duplikerede filnavne der forveksles

- **Kategori:** forudsigelighed
- **Alvorlighed:** **LAV**
- **Hvor:**
  - `Pages/WorkoutPage/WorkoutTypes/Run/Run.js` (5.169) vs. `Resources/Icons/WorkoutLabels/Run.js` (ikon)
  - `Pages/WorkoutPage/WorkoutTypes/Resistance/Resistance.js` (759) vs. `Resources/Icons/WorkoutLabels/Resistance.js`
  - `Resources/Icons/UI-icons/Dumbbell.js` vs. `Resources/Icons/WorkoutLabels/Dumbbell.js`
- **Problem:** Størrelsesforskellen gør de to første relativt ufarlige (en agent opdager hurtigt at den har åbnet et ikon). De to `Dumbbell.js` er reelt forvekslelige.
- **Rammer den:** begge, mildt.
- **Anbefaling:** Ikke omdøb `Run.js`/`Resistance.js` — deres mappekontekst er tydelig. Overvej `WorkoutLabels/DumbbellLabel.js`. Lav prioritet.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Flad.

## STRUKT-21: Inkonsistent mappenavngivning

- **Kategori:** forudsigelighed
- **Alvorlighed:** **LAV**
- **Hvor:** `Pages/ProgramOverviewPage/Components/rm_list/` (snake_case blandt PascalCase), `Resources/BodyMap/*/Muscle_masks/`, `Pages/WeekPage/Components/Day/Utility/` (ental) vs. `.../ExerciseList/Utils/` (flertal).
- **Problem:** Ingen funktionel effekt, men på Windows-udvikling (case-insensitivt filsystem) mod CI/Android (case-sensitivt) er inkonsistent casing en kendt kilde til "virker lokalt, fejler i build".
- **Rammer den:** begge, mildt.
- **Anbefaling:** Skriv navnereglen ned i `src/CLAUDE.md` (mapper og komponentfiler: PascalCase; service/repository/utils-filer: camelCase). Omdøb `rm_list/` → `EstimatedSetList/` når mappen alligevel røres.
- **Indsats:** Lille.
- **Risiko ved at lade være:** Flad.

---

## 2.1 Kohæsion — faktisk filliste og omkostning pr. feature

Målestokken: **hvor mange filer og linjer skal læses for at ændre featuren korrekt.** Token-estimater er ~3,5 tegn/token på denne kodebase.

### Feature A — Styrketræning: tilføj et felt til et sæt og vis det

**13 filer, 19.515 linjer, ~600 KB ≈ 170k tokens**

| Linjer | Fil |
|---:|---|
| 143 | `src/Database/schema/weightlifting.js` |
| 1.735 | `src/Database/db.js` |
| 2.024 | `src/Repository/weightliftingRepository.js` |
| 4.272 | `src/Services/weightliftingService.js` |
| 7.427 | `src/Services/programService.js` ← sæt-sky-sync bor her |
| 1.243 | `src/Pages/.../ExerciseRow/SetList/SetList.js` |
| 376 | `src/Pages/.../ExerciseRow/SetList/SetListStyle.js` |
| 103 | `src/Pages/.../ExerciseRow/SetList/Title.js` |
| 1.030 | `src/Pages/.../ExerciseList/Components/ExerciseRow/ExerciseRow.js` |
| 130 | `src/Pages/.../ExerciseRow/CollapsedSetSummary.js` |
| 734 | `src/Pages/.../ExerciseList/ExerciseList.js` |
| 215 | `src/Pages/SetPage/SetPage.js` |
| 83 | `src/Sync/SetSync.js` |

**4 mapper. Værste tilfælde i repoet.** Bemærk at 13.723 af de 19.515 linjer er tre filer (`programService`, `weightliftingService`, `weightliftingRepository`) — dvs. omkostningen er næsten udelukkende STRUKT-2.

### Feature B — Forsidens "i dag"-kort

**9 filer, 12.323 linjer ≈ 105k tokens**

`HomePage.js` (787), `HomePageStyle.js` (44), `TodayHeroCard.js` (346) + style (232), `WeekStrip.js` (85), `GreetingHeader.js` (111), `WorkoutSummaryCard.js` (353), `programService.js` (7.427), `programRepository.js` (2.938).

UI-delen er forbilledlig — 7 filer, 1.958 linjer, alle i én mappe. **84 % af omkostningen er de to store bagvedliggende filer.**

### Feature C — Sygdomsregistrering

**9 filer, 15.869 linjer ≈ 135k tokens** — og fordelt over **5 mapper**

`SicknessPage.js` (577) + style (210), `programService.js` (7.427), `programRepository.js` (2.938), `schema/program.js` (177), `db.js` (1.735), `Resources/Images/sicknessTypes.js` (20), `MicrocycleList.js` (1.370, viser sygdomsmarkering), `WorkoutCalendarPage.js` (1.415, viser sygdomsmarkering). Plus den døde `SicknessLogCard`-dublet (STRUKT-13).

Værste **spredning**: sygdomsvisning findes i tre skærme der ikke deler komponent.

### Feature D — Løbetræning

**13 filer, 10.421 linjer ≈ 90k tokens**

`Run.js` (5.169), `RunStyle.js` (2.081), `RunSetList.js` (1.564), `ListHeader.js` (73), `runningService.js` (125), `runningRepository.js` (177), `locationService.js` (304), `locationRepository.js` (136), `locationUtils.js` (346), `runIntervalUtils.js` (85), `heartRateService.js` (303), `schema/running.js` (26), `schema/location.js` (32). Plus `App.js:79-185` (baggrundsopgaven).

God lagdeling, men 85 % af linjerne er i 3 UI-filer. **Modsat problem af Feature A/B/C.**

### Feature E — Social opslag

**8 filer, 4.332 linjer ≈ 37k tokens**

`SocialPostEditPage.js` (205), `SocialPostSettingsPage.js` (475), `ExerciseSocialPostSettingsPage.js` (337), `socialPostService.js` (989), `socialService.js` (1.191), `FriendsActivity/FriendsActivity.js` (443), `SocialUserListPage.js` (296), `SearchPage.js` (396).

**Den sundeste feature i repoet** — ingen fil over 1.200 linjer, tydelig lagdeling, ingen `db.js`-afhængighed. Det er sådan resten bør se ud. Eneste anke: `FriendsActivity` ligger i `Resources/Components/` selvom kun `HomePage` bruger den.

### Sammenfatning

| Feature | Filer | Linjer | ~Tokens | Mapper | Flaskehals |
|---|---:|---:|---:|---:|---|
| A: Sæt-felt | 13 | 19.515 | ~170k | 4 | `programService` + `weightliftingService` |
| C: Sygdom | 9 | 15.869 | ~135k | 5 | `programService` + spredning over 3 skærme |
| B: Forsidekort | 9 | 12.323 | ~105k | 3 | `programService` + `programRepository` |
| D: Løb | 13 | 10.421 | ~90k | 4 | `Run.js` + `RunStyle.js` |
| E: Social | 8 | 4.332 | ~37k | 3 | ingen |

**`programService.js` optræder i 3 af 5 og udgør alene 40-60 % af omkostningen i hver af dem.**

**Efter de foreslåede ændringer** (STRUKT-2 gennemført; NAV-dokumenterne på plads, så agenten kender feltcheklisten uden at læse sync-koden):

| Feature | Før | Efter | Reduktion |
|---|---:|---:|---:|
| A: Sæt-felt | ~170k | ~75k | −56 % |
| C: Sygdom | ~135k | ~55k | −59 % |
| B: Forsidekort | ~105k | ~45k | −57 % |
| D: Løb (kun med STRUKT-6) | ~90k | ~35k | −61 % |

Estimatet forudsætter, at agenten efter opdelingen kan læse `cloudSync/setSync.js` (~600 linjer) i stedet for hele `programService.js`, og at NAV-dokumenterne fjerner behovet for at læse sync-koden overhovedet ved rene domæneændringer.

---

## 2.2 Implicitte konventioner der ikke er skrevet ned nogen steder

Disse skal en agent kende. Ingen af dem kan læses ud af kodens struktur, og ingen af dem står i de eksisterende `AGENTS.md`-filer.

1. **Temaopslag sker altid i komponentens krop, aldrig i `StyleSheet.create`.** Mønsteret er præcis `const colorScheme = useColorScheme(); const theme = Colors[colorScheme] ?? Colors.light;` (132 filer). Grunden er, at `applyAccentTheme()` muterer `Colors` in-place — `StyleSheet.create` kører kun én gang ved import og fryser derfor farven.
2. **`*Style.js` indeholder kun layout.** Farver injiceres inline: `style={[styles.card, { backgroundColor: theme.card }]}`. 16 filer bryder det (STRUKT-16).
3. **Alle service- og repository-funktioner tager `db` som første argument**, hentet med `useSQLiteContext()` i skærmen. Undtagelsen `Utils/getWeeksBeforeMesocycle.js` er død kode.
4. **Importér altid via barrel:** `from "../../Services"`, `from "../../Resources/ThemedComponents"`. Forholdet er 53:1 hhv. 60:3 i repoet.
5. **Repository-funktioner skal sætte `needs_sync = 1`, bumpe `sync_version` og `COALESCE(sync_id, uuid())`** ved hver skrivning til en synkroniseret tabel (`Program`, `Mesocycle`, `Microcycle`, `Day`, `Sickness`, `Workout_Type_Instance`, `Exercise_Instance`, `Set`). Mønsteret ses i `weightliftingRepository.js:1874-1885`. Glemmes det, gemmes ændringen lokalt og forsvinder ved næste pull.
6. **Skriveoperationer wrappes i `withTransaction`** fra `Services/shared.js`. Den forhindrer nestede transaktioner via en global Map og har retry på "database is locked" — nestet kald giver en fejl der ikke ligner et lag-problem.
7. **Sky-sync trigges aldrig direkte** — altid via `syncXInBackground(db)` eller `enqueueSync()`, som serialiserer alt gennem én global promise-kæde (`Services/syncScheduler.js`). Parallelle sync-kald korrumperer rækkefølgen ved forældre-før-barn-upload.
8. **Baggrundsopgaver må ikke bruge `SQLiteProvider`-forbindelsen.** Dokumenteret i `src/Database/AGENTS.md` — bruger `SQLite.openDatabaseAsync(name, { useNewConnection: true })`. God, allerede skrevet ned.
9. **`Set` er den laveste sky-sync-grænse; `Run` synkroniserer på workout-niveau.** Dokumenteret i `src/AGENTS.md`. God.
10. **Skemaændring kræver ændring i to filer** (`schema/*.js` og `db.js`) — ikke skrevet ned (STRUKT-5).
11. **Version og changelog styres af branch-navnet** via `npm run version:auto`. Dokumenteret i rod-`AGENTS.md`. God.
12. **`Sickness` står i `db.js`'s sync-metadata-liste, men har ingen sync-implementering.** Ikke skrevet ned; en agent vil antage at sygdom synkroniserer.

---

## 2.3 Skalerbarhed

**Hvor det knækker ved dobbelt størrelse (~180k linjer):**

| Mappe | I dag | Ved 2× | Hvad der sker |
|---|---|---|---|
| `src/Pages/` | 25 sider, 118 filer, 43.409 linjer | ~50 sider, ~240 filer | **Klarer sig.** Feature-mappe-mønsteret skalerer; hver side er selvstændig. Eneste problem er dybden (allerede 8 niveauer) → STRUKT-10 bliver akut. |
| `src/Services/` | 16 filer, 22.143 linjer | ~20 filer, ~45.000 linjer | **Knækker.** Vokser i *filstørrelse*, ikke filantal. `programService.js` går mod 12-15.000 linjer. Uanvendelig. |
| `src/Repository/` | 6 filer, 250 eksports | ~8 filer, ~500 eksports | **Presset men OK.** `programRepository.js` (153 eksports) er allerede over grænsen for hvad man kan overskue, men filerne er homogene og søgbare. Lav prioritet. |
| `src/Database/db.js` | 1.735 linjer, 12 migrationer | ~3.500 linjer, ~25 migrationer | **Knækker.** Imperative rebuilds akkumuleres uendeligt; ingen af dem kan fjernes uden at brække gamle installationer. |
| `src/Resources/Components/` | 26 filer | ~50 filer | **Knækker.** Mappenavnet forudsiger allerede ingenting (STRUKT-17); ved 50 filer er den ubrugelig som opslagssted. |
| `src/Sync/` | 11 filer (5 døde) | ~20 filer | Klarer sig hvis STRUKT-4 løses; ellers bliver forholdet død/levende værre. |
| `src/Resources/Icons/UI-icons/` | 51 filer | ~100 | Klarer sig — flad liste af små filer er fint. Overvej barrel-eksport som `WorkoutLabels/` allerede har. |

**Beslutninger der bliver dyrere jo længere man venter — hastende, uanset nuværende smerte:**

1. **STRUKT-15 (Supabase-migrationshistorik).** Rækkefølgen af de 19 `docs/*.sql` kan rekonstrueres i dag ud fra git-historik. Om seks måneder og 40 filer kan den ikke. **Mest hastende punkt i rapporten trods MIDDEL-alvorlighed.**
2. **STRUKT-2 (opdeling af `programService.js`).** Hver ny synkroniseret entitet lægger ~600 linjer boilerplate til, som skal flyttes med. Opdeling koster i dag ~1 dags arbejde; om 3.000 linjer koster den det dobbelte.
3. **STRUKT-1 (aliasering).** 14 filer i dag. Mønsteret kopieres til hver ny fil der laves ved at kigge på en nabo — det er sådan det er nået til 14.
4. **STRUKT-10 (path-aliaser).** 166 imports i dag. Aliaset skal indføres **før** næste store flytning, ellers skal alle stier rettes to gange.

---

# Del 3 — Foreslået navigationsstruktur

**Forudsætning først:** repoet bruger allerede `AGENTS.md` (4 filer, brugt af Codex). At tilføje `CLAUDE.md` ved siden af skaber to sæt dokumenter der driver fra hinanden — præcis den fejl README allerede har lavet. **Anbefaling: behold indholdet i `AGENTS.md`-filerne og lad `CLAUDE.md` være en to-linjers pointer.**

Rod-`CLAUDE.md`:

```markdown
# CLAUDE.md
Al agentvejledning for dette repo står i `AGENTS.md` (rod) og i `AGENTS.md`
i de relevante undermapper. Læs rod-`AGENTS.md` først.
```

Nedenfor angives stierne som `CLAUDE.md`; **skriv indholdet i den tilsvarende `AGENTS.md`** i samme mappe (NAV-1, NAV-2, NAV-4 og NAV-5 udvider eksisterende filer; NAV-3 og NAV-6 er nye).

---

### NAV-1: `/CLAUDE.md` → indhold i `/AGENTS.md` (udvidelse af eksisterende)

- **Dækker:** hele repoet
- **Læses hvornår:** altid
- **Hvorfor nødvendig:** Den eksisterende rod-`AGENTS.md` er god på proces (branch, version, issues), men nævner ikke hvad projektet er, hvordan man verificerer en ændring, eller hvor de fem største fælder ligger. En agent der kun læser den, ved stadig ikke at der er en sky-backend (README siger aktivt det modsatte, STRUKT-11).
- **Foreslået indhold** — tilføjes til den eksisterende fil, øvrige afsnit bevares uændret:

```markdown
## Hvad er dette

FitVen er en Expo / React Native træningsapp (Android + iOS).
Data ligger i en lokal SQLite-database pr. bruger OG synkroniseres til Supabase.
Det er ikke en offline-only app — enhver dataændring har en sky-side.

## Kommandoer

    npm run start          # Expo dev-client
    npm run android        # native run
    npm test               # alle testscripts (se scripts/)
    npm run version:auto   # efter oprettelse af arbejdsbranch
    npm run version:status # verificer version/branch-tilstand

Der er ingen linter og ingen typekontrol. `npm test` dækker 9 isolerede
hjælpefunktioner. Ændringer i services, repositories og skærme kan ikke
verificeres automatisk — læs koden.

## Lagene

    Pages ──▶ Services ──▶ Repository ──▶ Database (SQLite)
      │           └──────▶ Supabase (sky)
      └──▶ Resources, Utils, Contexts

Skærme kalder services. Services kalder repositories. Repositories skriver SQL.
Undtagelse: Login/Register/Profile importerer `Database/supaBaseClient` direkte
for auth — det er tilsigtet.

## De fem ting der oftest går galt her

1. **`xRepository` i en skærmfil betyder som regel `xService`.** 14 UI-filer
   skriver `import { weightliftingService as weightliftingRepository }`.
   45 funktionsnavne findes i BEGGE lag med samme signatur. Verificer altid
   importlinjen øverst i filen før du følger et kald.
2. **Fem filer i `src/Sync/` er ikke monteret.** Kun de fem der står i
   `App.js` omkring linje 459 kører. Se `src/Sync/AGENTS.md`.
3. **Et nyt DB-felt skal opdateres 8-11 steder.** Følg checklisten i
   `src/Services/AGENTS.md` — springer du sky-siden over, virker feltet
   lokalt og forsvinder ved næste synkronisering.
4. **Skemaet findes to steder**: `src/Database/schema/*.js` (nye
   installationer) og `src/Database/db.js` (eksisterende). Begge skal ændres.
5. **Farver må aldrig stå i en `*Style.js`.** `Colors` muteres ved
   accentskift. Se `src/Pages/AGENTS.md`.

## CHANGELOG

Læs kun toppen: `sed -n '1,60p' CHANGELOG.md`. Filen er 945 linjer og resten
er historik du ikke skal bruge.

## README.md

`README.md` er delvist forældet — især projektstruktur-blokken og påstanden
om at der ikke er nogen backend. Stol på koden og på AGENTS.md-filerne.
```

- **Vedligehold:** Bliver forældet når (a) en af de fem fælder rettes — så skal punktet slettes, ikke stå tilbage; (b) et npm-script tilføjes eller fjernes. Opdag det ved at køre `npm run` og sammenligne, og ved at `grep -rn "Service as .*Repository" src | wc -l` giver 0.

---

### NAV-2: `src/CLAUDE.md` → indhold i `src/AGENTS.md` (udvidelse af eksisterende)

- **Dækker:** hele `src/`
- **Læses hvornår:** når agenten rører noget i `src/` (dvs. næsten altid)
- **Hvorfor nødvendig:** Den eksisterende fil er god, men mangler de tre konventioner der får kode til at virke lokalt og fejle i skyen, samt navneforvirringen omkring øvelser (STRUKT-7).
- **Foreslået indhold** — tilføjes:

```markdown
## Konventioner der SKAL følges (koden virker ikke uden)

- Alle service- og repository-funktioner tager `db` som første argument.
  Skærmen henter den med `useSQLiteContext()` og sender den ned.
- Skriveoperationer wrappes i `withTransaction` fra `Services/shared.js`.
  Nestede transaktioner fejler — funktionen har en global vagt.
- Repository-skrivninger til en synkroniseret tabel SKAL sætte
  `needs_sync = 1`, bumpe `sync_version` og sikre `sync_id`. Mønster:
  `src/Repository/weightliftingRepository.js` funktion `updateSetField`.
  Synkroniserede tabeller: Program, Mesocycle, Microcycle, Day, Sickness,
  Workout_Type_Instance, Exercise_Instance, Set.
- Sky-sync startes aldrig direkte — altid via `syncXInBackground(db)` eller
  `enqueueSync()`. Alt serialiseres gennem én global kø i
  `Services/syncScheduler.js`.
- Importér via barrel: `from "../../Services"`, ikke
  `from "../../Services/programService"`.
- Aliasér ALDRIG et lag til et andet lags navn.
  `import { xService as xRepository }` er en eksisterende fejl, ikke et mønster.

## Navngivning

- Mapper og komponentfiler: PascalCase. Service-, repository- og utils-filer:
  camelCase.
- "Øvelse" har fire navne. De betyder:
  - tabel `Exercise` = katalog over øvelsesnavne (hed før `Exercise_storage`)
  - tabel `Exercise_Instance` = en øvelse i en konkret træning
  - `ExerciseCatalogPage` = skærmen der viser/vælger fra kataloget
  - `ExerciseLibraryPage` = hub-skærmen med genveje (kalender, sygdom, PR).
    Listen `ExerciseLibraryList` bor under den, men bruges af begge skærme.

## Kendte skæve steder

- `src/Pages/WeekPage/` er ude af det aktive brugerflow, MEN
  `WeekPage/Components/Day/Components/PickWorkoutModal/` bruges af
  `MicrocyclePage` og `WorkoutCalendarPage`. Slet ikke mappen.
- Den globale bundnavigation og hele "start træning"-flowet bor i
  `src/Resources/ThemedComponents/ThemedBottomNavigation.js` og
  `src/Resources/Components/StartWorkoutSheet.js` — ikke i `src/Pages/`.
  Den er monteret i `App.js` uden for navigatoren.
```

- **Vedligehold:** Bliver forældet ved lagomlægning eller når WeekPage/PickWorkoutModal flyttes. Opdag ved at bekræfte at hver navngiven sti stadig findes.

---

### NAV-3: `src/Services/CLAUDE.md` → `src/Services/AGENTS.md` (ny)

- **Dækker:** `src/Services/` og `src/Repository/`
- **Læses hvornår:** når agenten rører data, sky-sync eller domænelogik — dvs. ved næsten enhver ikke-kosmetisk ændring
- **Hvorfor nødvendig:** Forhindrer den dyreste fejl i repoet (STRUKT-3: felt der virker lokalt og forsvinder ved sync) og fjerner behovet for at læse 5.200 linjer sync-kode for at forstå mønsteret. **Dette er det vigtigste af de seks dokumenter.**
- **Foreslået indhold:**

```markdown
# AGENTS.md — Services og Repository

## Scope
`src/Services/` og `src/Repository/`.

## Hvor tingene faktisk ligger

`programService.js` (7.427 linjer) indeholder to adskilte systemer:
- ca. linje 40–5.250: sky-sync-motoren for ALLE syv synkroniserede entiteter,
  inklusive `Set` og `Exercise_Instance`. De ligger her, ikke i
  `weightliftingService.js`, på trods af navnet.
- ca. linje 5.250–7.427: programdomænet (program, mesocyklus, mikrocyklus,
  dag, sygdom, kopiering, kalender, dagsoverblik).

Brug `grep -n "^export" src/Services/programService.js` til at finde et
indgangspunkt frem for at læse filen.

`weightliftingService.js` (4.272): hjælpere til og med ca. linje 2.420,
eksporterede funktioner derefter.

## Sky-sync-mønsteret

Hver synkroniseret entitet har ti funktioner efter samme skabelon:

    parseCloudXId / resolveXCloudLocalId      identitet
    getComparableXSnapshot                    hvad tæller som "ændret"
    areComparableXsEqual                      sammenligning
    buildCloudXPayload                        hvad uploades
    ensureXCloudIdentity                      opret cloud-række ved behov
    processQueuedXDeletes                     sletningskø
    uploadDirtyXs                             push
    reconcileXsFromCloud                      pull + konfliktløsning
    syncXsWithCloudInternal / ...InBackground indgange

Forældre synkroniseres altid før børn:
Program → Mesocycle → Microcycle → Day → Workout_Type_Instance
→ Exercise_Instance → Set.

`Sickness` står i sync-metadata-listen i `db.js`, men har INGEN
sync-implementering. Sygdomsdata synkroniserer ikke.

## CHECKLISTE: tilføj et felt til en synkroniseret tabel

Alle punkter i samme opgave. Udelader du 5–8, virker feltet lokalt og
forsvinder næste gang skyen svarer — uden fejlmeddelelse.

1. `src/Database/schema/<domæne>.js` — CREATE TABLE (nye installationer)
2. `src/Database/db.js` — migration/ensureTableColumns (eksisterende
   installationer). Se `src/Database/AGENTS.md`.
3. `src/Repository/<x>Repository.js` — feltet med i ALLE relevante SELECT
4. `src/Repository/<x>Repository.js` — INSERT/UPDATE + `needs_sync = 1`
5. `programService.js` → `getComparableXSnapshot` — ellers ses ændringen
   aldrig som "ændret" og uploades aldrig
6. `programService.js` → `areComparableXsEqual`
7. `programService.js` → `buildCloudXPayload` — ellers uploades feltet ikke
8. `programService.js` → `reconcileXsFromCloud` — ellers overskrives feltet
   lokalt ved næste pull
9. Skærmen der viser feltet
10. Supabase-tabellen — manuelt. Læg SQL'en i `docs/` med et navn der
    matcher ændringen, ellers går den tabt.

Verificer punkt 5–8 med:
`grep -n "ComparableSetSnapshot\|areComparableSets\|buildCloudSetPayload" src/Services/programService.js`

## Regler

- Repositories indeholder SQL og intet andet. Services indeholder transaktioner,
  afledte værdier og sync-orkestrering.
- 45 funktionsnavne findes i både service- og repository-laget. Når du følger et
  kald, så tjek importlinjen i den kaldende fil — den kan være aliasseret.
- Disse services skriver SQL direkte uden om Repository (accepteret gæld, udvid
  det ikke): `localProgramImportService`, `programTransferService`,
  `socialPostService`.
```

- **Vedligehold:** Forældes når `programService.js` deles op (STRUKT-2) — så skal linjeintervallerne erstattes af filnavne. Opdag det ved at `grep -c "^export" src/Services/programService.js` ændrer sig markant, eller ved at `src/Services/cloudSync/` opstår.

---

### NAV-4: `src/Database/CLAUDE.md` → `src/Database/AGENTS.md` (udvidelse)

- **Dækker:** `src/Database/` inkl. `schema/`
- **Læses hvornår:** når agenten rører skema, migrationer eller SQLite-livscyklus
- **Hvorfor nødvendig:** Den eksisterende fil er stærk på forbindelsessikkerhed, men siger ikke at skemaet lever to steder (STRUKT-5) — den fejl giver en app der virker for nyinstallationer og fejler stille for alle eksisterende brugere.
- **Foreslået indhold** — tilføjes:

```markdown
## Skemaet findes TO steder

- `src/Database/schema/{program,weightlifting,running,location}.js`
  `CREATE TABLE IF NOT EXISTS` — kører kun ved en frisk installation.
- `src/Database/db.js` (1.735 linjer)
  Migrationer for eksisterende installationer: `ensureTableColumns`,
  `ALTER TABLE`, og 12 fulde tabel-rebuilds efter mønsteret
  `CREATE TABLE X_next` → kopiér → `DROP X` → `RENAME X_next TO X`.

Enhver skemaændring kræver ændring BEGGE steder, og de to skal give
nøjagtig samme sluttilstand. Ingenting kontrollerer det.

## db.js struktur

    L27–235    hjælpere: ensureColumnExists, ensureTableColumns, backfills
    L151–235   sync-metadata-triggere (holder last_updated ajour)
    L236–960   tabel-rebuild-migrationer, én funktion pr. tabel
    L965–1235  workout-type-katalog og reparationsrutiner
    L1382–1432 app-metadata + fremmednøgle-reparation
    L1433+     initializeDatabase — kaldes fra App.js, kører alt i rækkefølge

`repair*`-funktionerne er datakvalitetsoprydning, ikke skema. De kører ved
hver app-start.

## Ved tilføjelse af en synkroniseret tabel

Tabellen skal ind i `syncTables`-listen i `initializeSideBySideSyncMetadata`
(omkring L203) for at få `cloud_id`, `last_updated` og triggere.
At stå på listen giver IKKE sync — sync-logikken skal skrives separat i
`programService.js`. `Sickness` står på listen uden sync-implementering.

## Databasefilen er bruger-scopet

`src/Database/localDatabase.js` vælger navnet: `datab-user<id>.db` eller
`datab-anon.db`, med engangskopiering fra legacy `datab.db`. Ved skift af
bruger remountes `SQLiteProvider` med en ny `key` (`App.js`), hvilket
lukker og genåbner forbindelsen.
```

- **Vedligehold:** Linjeintervallerne i "db.js struktur" forældes ved hver ny migration. Skriv dem som omtrentlige, og verificer med `grep -n "^async function migrate\|^export async function initializeDatabase" src/Database/db.js`.

---

### NAV-5: `src/Pages/CLAUDE.md` → `src/Pages/AGENTS.md` (udvidelse)

- **Dækker:** `src/Pages/` og `src/Resources/`
- **Læses hvornår:** når agenten rører UI
- **Hvorfor nødvendig:** Temamutations-konventionen (STRUKT-16) er brudt i 16 filer og kan ikke udledes af koden — en agent der kopierer en nabofil får en komponent der ikke skifter tema. Derudover er placeringen af det globale bundnavigations-flow i `Resources/` det mest overraskende faktum i strukturen.
- **Foreslået indhold** — tilføjes:

```markdown
## Farver og tema — den vigtigste regel her

`applyAccentTheme()` i `src/Resources/GlobalStyling/colors.js` MUTERER
`Colors`-objektet in-place når brugeren skifter accentfarve.
`StyleSheet.create` evalueres én gang ved import. Derfor:

- `*Style.js` må KUN indeholde layout: mål, afstand, flex, radius, skrift.
- Farver hentes i komponentens krop og sættes inline:

      const colorScheme = useColorScheme();
      const theme = Colors[colorScheme] ?? Colors.light;
      ...
      <View style={[styles.card, { backgroundColor: theme.card }]} />

- Hardkodede hex-værdier i en `*Style.js` fryser ved app-start og reagerer
  hverken på lys/mørk eller på accentskift. 16 style-filer gør det i dag —
  det er en fejl, ikke et mønster. Ryd op når du alligevel rører filen.
- `withAlpha(theme.primary, 0.2)` til gennemsigtighed. Aldrig `"#RRGGBBAA"`.

## Sidestruktur

    Pages/<Navn>Page/
      <Navn>Page.js
      <Navn>PageStyle.js
      Components/<Komponent>/<Komponent>.js + <Komponent>Style.js

En komponent der bruges af mere end én side flyttes til
`src/Resources/Components/`. Det er reglen; den er brudt for
`ExerciseLibraryList` (under ExerciseLibraryPage, bruges også af
ExerciseCatalogPage) og `PickWorkoutModal` (under WeekPage, bruges af
MicrocyclePage og WorkoutCalendarPage).

## Hvad der IKKE ligger i Pages

- Den globale bundnavigation:
  `src/Resources/ThemedComponents/ThemedBottomNavigation.js` (1.024 linjer).
  Monteret i `App.js` uden for navigatoren, én instans for hele appen.
- "Start træning"-flowet: `src/Resources/Components/StartWorkoutSheet.js`.
- Kopiér/indsæt-træning: `src/Resources/Components/CalenderPastePicker/`
  (indeholder rå SQL — gammel gæld, kopiér ikke mønsteret).

## Ny skærm

1. Opret `src/Pages/<Navn>Page/<Navn>Page.js` + `<Navn>PageStyle.js`
2. `import` + `<Stack.Screen name="<Navn>Page" ...>` i `App.js`
   (rutenavnet SKAL matche mappenavnet — bundnavigationen matcher på strengen)
3. Hvis skærmen skal markere en fane som aktiv: tilføj rutenavnet til den
   relevante liste i `ThemedBottomNavigation.js` omkring linje 108–130
4. Hvis skærmen skal skjule bundnavigationen: undtagelsen håndteres i
   `App.js` omkring linje 413
```

- **Vedligehold:** "16 style-filer"-tallet forældes ved oprydning. Verificer med `grep -rlc "#[0-9a-fA-F]\{3,8\}" --include=*Style.js src | wc -l`. Linjehenvisningerne til `ThemedBottomNavigation.js` og `App.js` forældes ved redigering — skriv dem som "omkring linje N" og verificer med grep på funktionsnavnet.

---

### NAV-6: `src/Sync/CLAUDE.md` → `src/Sync/AGENTS.md` (ny)

- **Dækker:** `src/Sync/`
- **Læses hvornår:** når agenten rører noget i `src/Sync/`
- **Hvorfor nødvendig:** Forhindrer en hel spildt opgave (STRUKT-4). Halvdelen af mappens filer kører ikke, og der er intet i dem der antyder det. Dette er det billigste dokument at skrive og et af de mest værdifulde.
- **Foreslået indhold:**

```markdown
# AGENTS.md — Sync

## Scope
`src/Sync/`.

## Hvad disse filer er

Hovedløse React-komponenter (`return null`). De monteres i `App.js` og
trigger sync ved mount og når appen kommer i forgrunden. De indeholder
INGEN sync-logik — den ligger i `src/Services/programService.js` og
`weightliftingService.js`.

## Monteret / ikke monteret

Kun disse fem er monteret (`App.js`, omkring linje 459):

    WorkoutTypeCatalogSync           MONTERET
    ExerciseLibrarySync              MONTERET
    SetSync                          MONTERET  <- pusher HELE styrke-hierarkiet
    WorkoutTypeInstanceSync          MONTERET
    PushNotificationRegistrationSync MONTERET

Disse fem importeres INGEN steder og kører aldrig:

    ProgramSync                      DØD
    MesocycleSync                    DØD
    MicrocycleSync                   DØD
    DaySync                          DØD
    ExerciseInstanceSync             DØD

Program, mesocyklus, mikrocyklus og dag synkroniseres i stedet indirekte via
`pushDirtyStrengthHierarchyWithCloud`, som `SetSync` kalder.

At ændre i en af de fem inaktive filer har ingen effekt. Verificer altid mod
`App.js` før du redigerer her.

## Kø

Alle sync-kald går gennem `enqueueSync()` (`Sync/syncQueue.js` →
`Services/syncScheduler.js`), som serialiserer alt i én global promise-kæde.
Kald aldrig en `syncXWithCloud`-funktion uden om køen — forældre skal
uploades før børn.
```

- **Vedligehold:** Forældes i det øjeblik en komponent monteres eller afmonteres i `App.js`. Opdag med `grep -c "Sync />" App.js` (skal give 5) sammenholdt med `ls src/Sync/*Sync.js | wc -l` (giver 10).

---

## 3.1 Mapper der skal ekskluderes fra agent-søgning

`ripgrep` (som agenters `Grep`-værktøj bruger) respekterer `.gitignore`, så `node_modules/` (50.619 filer), `android/` (1.248), `dist/` og `.expo/` er allerede ude. Det der **mangler** er projektintern støj.

Opret `.ignore` i roden (ripgrep læser den; git ignorerer den ikke, så filerne forbliver sporet):

```
# Genereret engangs-datablob — 154 KB JSON, drukner søgninger i src/Services
src/Services/zhadowsebProgramImportPayload.js

# Historik, ikke kode
CHANGELOG.md

# Designudkast, ikke kode
design_handoff_fitven_redesign/

# Låsefil
package-lock.json

# Applikeret patch-fil
fitven-run-walk-fix.patch
```

Effekt: en søgning efter `rpe` i `src/Services/` går fra 89 til 31 træffere; `weight`, `reps` og `sync_id` tilsvarende. `CHANGELOG.md` (45 KB) og `package-lock.json` (595 KB) forsvinder fra fritekstsøgninger.

Undlad at ekskludere `docs/*.sql` — de er den eneste kilde til skyskemaet.

## 3.2 Konventioner der bør stå ét sted som "sådan gør vi her"

Alle tolv konventioner fra afsnit 2.2 hører hjemme i navigationsdokumenterne, fordelt sådan:

| Konvention | Dokument |
|---|---|
| `db` som første argument; barrel-import; ingen lag-aliasering; navngivning | NAV-2 (`src/AGENTS.md`) |
| `withTransaction`; `needs_sync`/`sync_version`/`sync_id`; `enqueueSync`; feltcheckliste; `Sickness` uden sync | NAV-3 (`src/Services/AGENTS.md`) |
| Skema to steder; `syncTables`-listen; bruger-scopet DB; forbindelseslivscyklus *(findes allerede)* | NAV-4 (`src/Database/AGENTS.md`) |
| Tema/farve-reglen; sidestruktur; ny skærm; hvad der ikke ligger i Pages | NAV-5 (`src/Pages/AGENTS.md`) |
| Monteret/ikke-monteret; køen | NAV-6 (`src/Sync/AGENTS.md`) |
| `npm test`; CHANGELOG-hovedet; de fem fælder; README er upålidelig | NAV-1 (rod-`AGENTS.md`) |
| `Set` som sync-grænse; `Run` på workout-niveau | NAV-2 *(står der allerede — bevar)* |

---

# Del 4 — Overvejet, men frarådet

**1. Fuld feature-mappe-migration (`src/features/træning/`, `src/features/løb/` …).**
Ser rigtigt ud: featuretraces i afsnit 2.1 viser 3-5 mapper pr. feature. Men omkostningen er 387 sporede filer og 166 dybe relative imports der alle skal rettes, uden tests til at fange fejl, i et repo med ~40 ukommitterede ændringer. Og den løser ikke det faktiske problem: 40-60 % af hver features omkostning er `programService.js`, som ville følge med uanset hvor den placeres. **Løs STRUKT-2 først** — derefter er featurespredningen 3 mapper i stedet for 5, og gevinsten ved en migration er marginal.

**2. TypeScript-migration.**
Ville fange STRUKT-1 (service/repository-forveksling) og STRUKT-3 (manglende felt i payload) ved compile-tid — det er reelt attraktivt. Men det er 88.524 linjer uden typer, tsconfig er tom, og der er ingen build-pipeline der kører typekontrol. En delvis migration giver `any` i alle grænseflader og dermed ingen af garantierne. Billigere alternativ med 80 % af værdien: fjern aliasserne (STRUKT-1) og skriv feltchecklisten ned (NAV-3). Genovervej TypeScript hvis projektet får mere end én udvikler.

**3. Opdeling af `programRepository.js` (2.938 linjer, 153 eksports) og `weightliftingRepository.js` (2.024, 92 eksports).**
Store filer, men homogene: hver funktion er 5-25 linjer SQL uden tilstand og uden indbyrdes afhængighed. En agent finder den rigtige med ét grep og læser 20 linjer. Omkostningen ved at læse dem er reelt lav, i modsætning til `programService.js` hvor logikken er sammenflettet. Opdeling ville flytte 245 imports uden at reducere den faktiske læseomkostning. **Lad dem ligge.**

**4. Fjern barrel-eksporterne (`Services/index.js`, `ThemedComponents/index.js`).**
Argumentet er, at `import { programService } from "../../Services"` trækker alle 22.143 linjer ind i modulgrafen. Men Metro tree-shaker ikke meningsfuldt her, og for en agents *læseomkostning* er barrelen en fordel: den er 12 linjer og fungerer som indholdsfortegnelse over servicelaget. 53:1-forholdet viser at konventionen er etableret. **Bevar den.**

**5. Flyt de 71 BodyMap-SVG'er ud af `src/`.**
De fylder 73 filer i filtræet, men 0 JS-linjer og rammes stort set aldrig af kodesøgninger. Flytningen ville kræve ændringer i `BodyMapPreview`-komponenterne uden nogen målbar gevinst. **Lad dem ligge.**

**6. Erstat de 9 testscripts med Jest/Vitest.**
Fristende, men React Native-testopsætning er ikke-triviel (transformere, mocks af `expo-sqlite`, `react-native-ble-plx`, `expo-location`), og gevinsten er begrænset så længe der ikke skrives nye tests. Den reelle mangel er, at der **ingen** dækning er af services og repositories — og den mangel løses ikke af at skifte testløber. Tilføj `npm test` som samlekommando (STRUKT-14), og indfør en rigtig testløber først når nogen faktisk skal skrive test af `programService`.

**7. Omdøb `Exercise_storage`-navnesporet i databasen.**
`getExerciseStorage`/`createExerciseStorage` er misvisende (tabellen hedder `Exercise` nu), men omdøbning rører repository, service, tre skærme og en migrationssti der allerede håndterer den historiske omdøbning i `db.js:269`. Risikoen for at brække en migration for eksisterende brugere overstiger gevinsten. **Dokumentér betydningen (NAV-2) i stedet.**

---

# Afslutning

## Anbefalet rækkefølge

Navigationsdokumenterne først — de gør de efterfølgende ændringer sikrere at udføre, og NAV-6 og NAV-3 forhindrer aktivt fejl fra dag ét.

1. **NAV-1** — rod-`AGENTS.md` udvides + `CLAUDE.md`-pointer *(og STRUKT-19: CHANGELOG-hovedreglen indgår her)*
2. **NAV-6** — `src/Sync/AGENTS.md` *(billigst, forhindrer en hel spildt opgave)*
3. **NAV-3** — `src/Services/AGENTS.md` med feltchecklisten *(fjerner STRUKT-3's risiko før noget kode røres)*
4. **NAV-2, NAV-4, NAV-5** — `src/`, `src/Database/`, `src/Pages/`
5. **STRUKT-11** — ret README (slet filtræsblokken, ret backend-påstanden)
6. **STRUKT-1** — fjern service→repository-aliasering i 14 filer
7. **STRUKT-14** — tilføj `npm test`
8. Agent-eksklusioner (`.ignore`, afsnit 3.1) + **STRUKT-9** (flyt payload'en ud af `src/`)
9. **STRUKT-13 + STRUKT-8 + STRUKT-4** — slet død kode samlet (efter NAV-6, så beslutningen om Sync-filerne er truffet bevidst)
10. **STRUKT-12** — flyt `PickWorkoutModal` til `Resources/Components/`
11. **STRUKT-15** — Supabase-migrationer til `supabase/migrations/` *(hastende trods MIDDEL)*
12. **STRUKT-10** — path-aliaser opsættes (før nogen større flytning)
13. **STRUKT-2** — del `programService.js` i `Services/cloudSync/` + domænedel
14. **STRUKT-3, trin 2** — `SYNCED_FIELDS`-datadrevet payload/sammenligning
15. **STRUKT-18** — flyt GPS-baggrundsopgaven ud af `App.js`
16. **STRUKT-6** — del `Run.js` op *(størst, gør sidst)*
17. **STRUKT-5, 7, 16, 17, 20, 21** — løbende, når filerne alligevel røres

## Kan gøres uden risiko (rører ikke kørende kode)

- NAV-1 til NAV-6 — alle seks dokumenter
- STRUKT-11 (README)
- STRUKT-14 (`npm test`-samlekommando — tilføjer kun et script)
- `.ignore` til agent-søgning
- STRUKT-19 (omformulering af CHANGELOG-reglen)
- STRUKT-13 og STRUKT-8 (sletning af død kode) — verificer hver fil med `grep -rn "<Navn>" src App.js` før sletning; `grep`-verifikationen er selve risikoafdækningen
- STRUKT-9 (flytning af payload) hvis importstien opdateres i samme commit

## Kræver koordineret ændring

| Ændring | Rører | Skal verificeres bagefter |
|---|---|---|
| **STRUKT-1** (fjern aliasering) | 14 filer, ~70 kaldsteder | App starter; åbn manuelt: træningsskærm (sæt/øvelser), løbeskærm, mikrocyklus, kalender, sæt-side, øvelsesbibliotek. `grep -rn "Service as .*Repository" src` skal give 0. |
| **STRUKT-2** (del programService) | 1 fil deles i ~9; alle 53 barrel-imports skal fortsat virke | `grep -c "^export" src/Services/cloudSync/*.js` skal summere til de 8 sync-eksports + de 75 domæne-eksports. Kør appen med to enheder/konti og bekræft at program, mesocyklus, dag, træning og sæt stadig synkroniserer begge veje. Kør `npm test`. |
| **STRUKT-10** (path-aliaser) | build-config + gradvis migrering | Metro cache ryddes (`npx expo start -c`); appen skal bygge på både Android og iOS. Aliaser der virker i Metro men ikke i tsconfig giver editor-fejl uden buildfejl — tjek begge. |
| **STRUKT-12** (flyt PickWorkoutModal) | 2 imports + 1 mappeflytning | Åbn MicrocyclePage og WorkoutCalendarPage og bekræft at "vælg træning"-dialogen åbner. |
| **STRUKT-15** (Supabase-migrationer) | 19 SQL-filer + Supabase-projektet | `supabase db diff` mod produktion skal være tom efter migrering af historikken. **Gør dette før flere skyændringer.** |
| **STRUKT-6** (del Run.js) | 1 fil deles i ~8; tilstandstung | Fuld manuel løbetest: start træning, GPS-punkter registreres, lås telefonen, genoptag, tilslut pulsmåler, gennemfør interval, afslut, se kort. Der er ingen tests. **Højeste verifikationsomkostning i rapporten.** |

## Antagelser gjort i analysen

1. **Analysen er på arbejdstræet, ikke HEAD.** Der er ~40 ukommitterede ændringer på `chore/dev-build-variant`, herunder slettede filer (`HomePage/Components/ActiveProgramSnapshot/`). Linjetal og importrelationer afspejler arbejdstræet.
2. **Dødkode-analysen er statisk** — den matcher importstiers basenavne. Der blev ikke fundet dynamiske `require()` eller strengbaserede modulopslag i repoet, men verificer hver enkelt fil med `grep` før sletning.
3. **Appen er ikke kørt, og ingen tests er kørt.** Alle udsagn om adfærd (fx at de fem Sync-komponenter ikke kører) er udledt af at de ikke importeres nogen steder i `src/` eller `App.js`.
4. **Ingen adgang til Supabase-projektet.** Udsagn om skysiden bygger på `docs/*.sql`, `supabase/functions/` og sync-koden.
5. **Token-estimater** bruger ~3,5 tegn/token på denne kodebase (målt på faktiske bytes), og antager at en agent læser en fil helt når den skal ændre den. Agenter der bruger målrettede linjevinduer betaler mindre; agenter der læser hele filen for at forstå kontekst betaler det angivne.
6. **"Feature-omkostning efter forslag"** i afsnit 2.1 antager at STRUKT-2 er gennemført **og** at NAV-3's feltcheckliste findes, så agenten kan springe sync-koden over ved rene domæneændringer. Uden dokumentet realiseres kun cirka halvdelen af besparelsen.
7. **`AGENTS.md` frem for `CLAUDE.md`.** Rapporten antager at repoet skal have ét sæt agentdokumenter, ikke to. Hvis både Codex og Claude skal bruges med hvert sit sæt, er anbefalingen den samme — men så skal den ene være en symlink eller en pointer, aldrig en kopi.
8. **Den hardkodede Supabase-anon-nøgle i `src/Database/supaBaseClient.js:13`** er behandlet som tilsigtet (anon-nøgler er offentlige by design) og ikke som et fund. Værd at bemærke: der findes intet env-lag overhovedet — hvis der på et tidspunkt skal være et separat staging-projekt, er det en ændring der rører den fil og build-konfigurationen.
