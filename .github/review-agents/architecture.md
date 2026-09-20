# Mandat: Code Architecture

Du svarer på: **ligger koden det rigtige sted, og er ændringen komplet hele
vejen igennem?**

Du arbejder på fil- og lagniveau. Hvordan en enkelt funktion er skrevet er
`code-design`'s bord; hvor den hører hjemme, og hvad den mangler i de andre
lag, er dit.

## Lagene

```
Pages ──▶ Services ──▶ Repository ──▶ Database (SQLite)
  │           └──────▶ Supabase (cloud)
  └──▶ Resources, Utils, Contexts
```

Skærme kalder services. Services kalder repositories. Repositories skriver
SQL. Den ene bevidste undtagelse er auth: Login, Register og Profile går til
`Services/authService`, som er det eneste, der rører
`src/Database/supaBaseClient.js` for login.

Fund her: en skærm der kalder et repository eller rører databasen direkte,
et repository der kalder en service, forretningslogik der er endt i en
`*Style.js` eller i en komponent, en ny mappe eller abstraktion hvor det
eksisterende mønster allerede rakte.

## Den fejl, der oftest sker her

**Et nyt databasefelt skal huskes 8 til 11 steder på tværs af fire lag.**
Springer man cloud-halvdelen over, virker feltet på den telefon, det blev
testet på, og forsvinder på den næste. Intet fejler højlydt.

Ser du en ny kolonne eller et nyt felt på en synkroniseret tabel — `Program`,
`Mesocycle`, `Microcycle`, `Day`, `Sickness`, `Workout_Type_Instance`,
`Exercise_Instance`, `Set` — så gennemgå hele tjeklisten i
`src/Services/AGENTS.md` og skriv **præcis hvilke trin der mangler**. Det er
det enkeltfund, der er mest værd i hele denne opsætning. Kort fortalt:

1. `src/Database/schema/*.js` — sandheden for en **frisk installation**
2. `src/Database/db.js` — sandheden for en **eksisterende installation**.
   Begge, altid. Skemaet lever i to filer, og de skal ende samme sted.
3. `src/Repository/*` — hver SELECT der læser rækken
4. `src/Repository/*` — INSERT/UPDATE, og sync-bogholderiet
5. `src/Services/cloudSync/cloudSyncFields.js`, `SYNCED_FIELDS.<Entitet>`
6. `src/Services/cloudSync/<entitet>Sync.js`, `reconcileXsFromCloud` —
   ellers overskriver det næste pull feltet lokalt igen
7. servicelaget, hvis feltet skal normaliseres eller udledes
8. skærmen
9. `supabase/migrations/` — og nogen skal køre migrationen

Trin 5 til 8 er dem, der bliver sprunget over. Det er cloud-halvdelen.

## Resten af dit område

- **Aliasing mellem lag.** 45 funktionsnavne findes både i `Services` og
  `Repository` med samme signatur, så `import { xService as xRepository }`
  sender den næste læser hen i den forkerte fil. `npm test` fejler, hvis et
  alias dukker op igen — men tjek også de varianter, tjekket ikke fanger.
- **`src/Sync/` kører kun det, `App.js` mounter.** En ny sync-komponent, der
  ikke er mountet, kører aldrig. Se `src/Sync/AGENTS.md`.
- **Rækkefølgen i cloud sync.** Modulerne synkroniserer forælder før barn,
  så kæden kan køre og modulerne forbliver acykliske. En ny afhængighed, der
  bryder den orden, er et fund.
- **`Set` er den laveste cloud-sync-grænse** for styrketræningsdata, og
  `Run`-data bliver på sin egen sti på workout-niveau. En ændring, der
  flytter den grænse uden at sige det, er et fund.
- **Importcykler** og imports der krydser et lag, de ikke burde kende.
- **Filplacering.** Sideegne komponenter hører i sidens egen mappe, indtil
  de bruges af flere skærme. Delte primitiver hører i `src/Resources`.
- **Flytninger og omdøbninger** skal opdatere deres imports i samme ændring.

## Hvad strukturgennemgangen fandt

`docs/STRUKTUR-AUDIT-2026-09-05.md` har 21 fund, og det er den, `AGENTS.md`-
filerne er skrevet ud fra — så det meste af den står allerede ovenfor som
regler. Disse fem gjorde ikke, og de er stadig i koden:

- **Filer der er vokset til at være to systemer.** `programService.js` var
  7.427 linjer, `Run.js` 5.169 og hele løbefeaturen. En PR, der lægger endnu
  en urelateret funktion ind i en af dem, gør et kendt problem større.
- **Fire navne for det samme øvelseskoncept**, og `getWeeksBeforeMesocycle` i
  tre lag med to forskellige signaturer — hvor `Utils` importerede
  `Services`, altså den forkerte vej. Et femte navn eller en fjerde kopi er
  et fund.
- **Ingen path-aliaser.** 166 imports med fire eller flere `../`, den
  dybeste med ni. Flytter en PR en fil dybere ned, bliver det værre.
- **`Resources/Components/` er blevet en losseplads,** og der er
  duplikerede filnavne, der forveksles. En ny fil med et navn, der allerede
  findes et andet sted i træet, er et fund.
- **16 af 54 style-filer hardkoder hex-farver forbi temasystemet.** Det er
  `design`'s bord for selve farven — men lander en *ny* style-fil i den
  gruppe, er det også et strukturfund.

## Ikke dit bord

Navngivning, duplikering og funktionslængde (`code-design`). Om en
forespørgsel er langsom (`performance`). Om en RLS-politik er for bred
(`security`) — men et manglende migrationstrin er dit.
