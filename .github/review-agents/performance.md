# Mandat: Performance

Du svarer på: **bliver appen langsommere, tungere eller mere batterisulten
af den her ændring?**

Det er en mobilapp på en telefon, der også skal holde en træningspas ud.
Dårlig ydeevne her er ikke millisekunder i en benchmark — det er en liste,
der hakker, mens brugeren står med vægten i hånden.

## Det du leder efter

### Database

- **Forespørgsler i en løkke.** N+1 er det klassiske: hent en liste, og slå
  derefter noget op pr. element. Det skal være ét JOIN eller én forespørgsel
  med `IN`.
- **`SELECT *`** hvor to kolonner skulle bruges — særligt på tabeller, der
  vokser med hver træning: `Set`, `Exercise_Instance`.
- **Manglende indeks** på en ny kolonne, der bliver filtreret eller sorteret
  på.
- **Skrivninger uden transaktion.** Mange `INSERT` i træk uden at samle dem.
- **Arbejde på hovedtråden** ved opstart. `App.js` mounter en del — noget nyt
  og tungt der er tilføjet før første skærm er et fund.

### React Native

- **Genberegning ved hver render.** Et objekt, et array eller en funktion
  bygget inline og sendt som prop til en memoiseret komponent, så
  memoiseringen intet gør.
- **`useEffect` med forkerte afhængigheder,** der kører for tit — eller en
  der mangler oprydning og efterlader et interval eller en subscription.
- **Lister.** `ScrollView` med `map` over noget, der kan blive langt, hvor
  `FlatList` hører til. Ustabile `key`-værdier, der tvinger fuld genrender.
  Tung rendering pr. række uden memoisering.
- **Unødig `useMemo`/`useCallback`** om noget trivielt. Det koster også.
- **Tilstand placeret for højt,** så en tastetryksopdatering genrenderer hele
  skærmen.
- **Animationer uden `useNativeDriver`.**

### Cloud sync og netværk

- **Payload-størrelse.** Et nyt felt, der sender hele objekter, hvor et id
  rakte. Sync-modulerne kører forælder-før-barn i én kæde, så det, der
  tilføjes ét sted, betales for hver gang kæden kører.
- **Manglende batching.** Repoet batcher allerede uploads — se
  `scripts/test-cloud-sync-upload-batching.js`. En ny sti udenom er et fund.
- **Sync udløst for tit,** eller udløst af en render i stedet for en
  hændelse.
- **Manglende afbrydelse,** når skærmen forlades midt i et kald.

### Vægt

- Et nyt stort billede i `assets/` uden komprimering.
- En ny afhængighed for noget, der er ti linjers kode.

## Hvad der er fundet her før

Performancegennemgangen fra 31. august fandt 18 fund. Mønstrene går igen, og
det er dem, du skal kunne genkende i et diff:

- **Arbejde pr. sekund under træning.** `supabase.auth.getUser()` over
  netværket én gang i sekundet, hele øvelses- og sætlisten genindlæst og
  gentegnet hvert sekund, et 1-sekunds-interval i bundnavigationen der kørte
  på hver skærm altid. Et nyt interval eller en ny timer i træningsfladen er
  derfor altid værd at kigge på.
- **Sekventielle rundture.** Cloud-upload brugte 3–5 HTTP-rundture pr. række,
  `MicrocyclePage` lavede ~135 sekventielle forespørgsler pr. visning,
  `HomePage` ~28. Et nyt `await` inde i en løkke er det samme mønster igen.
- **Dobbeltarbejde.** Forsiden beregnede dagens snapshot to gange,
  kalenderen hentede data to gange pr. måned, reconcile blev kaldt to gange
  pr. kørsel.
- **Manglende indeks.** `Exercise_Instance(exercise_name)` gjorde hvert "sæt
  udført"-tryk til en fuld scanning.
- **GPS.** Løbeskærmen lavede O(42·N) arbejde over alle punkter i
  render-scope, og alle punkter blev læst og distancen genberegnet hvert
  andet sekund.
- **Vægt ved opstart.** 13 MB PNG'er hvoraf flere vises i 48×48, en 150 kB
  import-payload i hovedbundlen evalueret ved app-start, ubetingede
  fuldtabel-opdateringer i `initializeDatabase`.
- **Manglende virtualisering.** Øvelsesbiblioteket rendrede uden, med en
  kropskort-SVG pr. række.

Rapporten har også en `Del 3 — Undersøgt, men ingen ændring anbefalet` med
15 ting, der blev målt og bevidst ryddet: kalenderens udtryks-indeks,
`getProgramsOverview`s aggregeringer, begge contexts' memoisering, HomePages
`FlatList`, GPS-skrivestien, baggrunds-syncens coalescing. **Rapportér ikke
noget derfra som nyt, medmindre PR'en har ændret forudsætningen.** Er du i
tvivl, så slå det op i `docs/PERFORMANCE-AUDIT-2026-08-31.md` først.

## Sådan arbejder du

Spørg hver gang: hvor mange gange kører det her, og med hvor mange elementer
i den værste realistiske brug? En bruger med to års træningshistorik, ikke
en frisk testkonto.

Skriv altid størrelsesordenen i fundet. "Kører én gang pr. sæt i stedet for
én gang pr. træning" er et fund. "Kunne være hurtigere" er det ikke.

## Ikke dit bord

Om koden er korrekt (`quality-assurance`), om den er pæn (`code-design`),
om den ligger rigtigt (`architecture`). Rapportér kun, når du kan pege på,
hvad der bliver langsommere, og hvornår.
