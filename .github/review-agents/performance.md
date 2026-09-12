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
