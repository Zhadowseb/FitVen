# Demo-konti til indhold

En stor del af appen er det sociale: venner, feed, likes og profiler. Til
skærmbilleder og video skal der derfor være et helt socialt lag, ikke kun én
konto. `scripts/demo/seed-demo.js` laver det: fem opfundne personer, der følger
hinanden og har postet træninger.

Ingen af dem findes, og ingen er forbundet til en rigtig konto.

## Hvem der er med

| Nøgle | Navn | Rolle |
|---|---|---|
| `alex` | Alex Morgan | Kontoen, emulatoren logger ind som |
| `emma` | Emma Holm | Ven, to træninger i feedet |
| `mads` | Mads Kjær | Ven, to træninger |
| `jonas` | Jonas Berg | Ven, to træninger |
| `sofie` | Sofie Lund | Ven, én træning |

Adresserne er `<nøgle>.demo@fitven.dk`. De er oprettet som bekræftede, så der
bliver aldrig sendt en mail, og der behøver ikke at være en postkasse.
Alex' egen træningshistorik oprettes ikke her: den kommer af, at appen bruges
på kontoen (se `docs/CONTENT-AUTOMATION.md`), for en træning skal ind i appens
egen lokale database for at tælle.

Personerne, deres følgere, de syv træninger (med sæt) og opslagene står i
`scripts/demo/cast.js` og kan rettes dér. Profilbillederne ligger i
`scripts/demo/avatars/<nøgle>.jpg` (256 × 256); `mads` og `sofie` har ingen
endnu og vises med initialer. Billederne er udsnit af skærmbillederne og derfor
bløde: læg større versioner ind med samme filnavn.

## Sådan kører du det

Scriptet bruger servicenøglen fra `.env` (`SUPABASE_URL` og
`SUPABASE_SERVICE_ROLE_KEY`). Det køres i hånden på din computer og af ingen
workflow. Intet i det udskriver, logger eller sender nøglen.

```
npm run demo:plan                      # hvad der ville ske, rører intet, kræver ingen nøgle
npm run demo:probe                     # tjekker skyens tabeller mod det, scriptet skriver
npm run demo:apply -- --yes            # konti, profiler, billeder, følgere, træninger, opslag
npm run demo:apply -- --yes --accounts-only
npm run demo:status
npm run demo:reset -- --yes            # fjerner alle demo-konti og det, de ejer
```

Uden `--yes` skriver `apply` og `reset` kun, hvad de ville gøre.

**Første gang: kør `demo:probe` først.** Tabellerne for træninger, øvelser og
sæt er ikke beskrevet i repoets migrationer, så scriptet spørger skyen om,
hvilke kolonner de har, og skriver ingenting, hvis noget ikke passer. Det
fortæller i så fald præcis hvad (fx "kræver en kolonne, scriptet ikke
udfylder"), og så retter jeg det. `--accounts-only` springer træninger og
opslag over, hvis du vil have kontiene først.

Adgangskoden til Alex tages fra `DEMO_PASSWORD` i `.env`. Står den ikke der,
laver scriptet en og viser den én gang i terminalen, når kontoen oprettes. Læg
den i `.env` som `DEMO_PASSWORD` (så en ny kørsel beholder den) og i GitHub som
hemmeligheden `DEMO_PASSWORD`, sammen med `DEMO_EMAIL` (`alex.demo@fitven.dk`).

Kør `demo:apply -- --yes` igen lige før en optagelse: datoerne er relative til
dagen, så "3 dage siden" bliver ved med at passe, og træningerne lægges ind
forfra.

## Hvad der holder det fra at ramme noget rigtigt

- Scriptet skriver kun til FitVens eget projekt (adressen i `supaBaseClient.js`).
- En bruger er kun en demo-bruger, hvis den både har markeringen
  `fitven_demo` i sine metadata **og** en adresse, der slutter på
  `.demo@fitven.dk`. Nulstilling og opdatering rører kun dem.
- Alle følger-relationer er mellem de fem. Ingen rigtig bruger følger en
  demo-konto eller følges af en, og ingen får en notifikation.
- Opslagene er sat til `following`: kun følgere kan se dem, og følgerne er de
  fem. Træningerne har ikke noget center, så de kommer aldrig på en offentlig
  rangliste.
- Samtykke til privatlivspolitik og vilkår er skrevet ind som givet for de fem,
  med de nuværende versioner, så samtykkeskærmen ikke står i vejen.

## Det, man kan se udefra

Demo-kontiene er rigtige konti i det rigtige projekt, så de kan dukke op, hvor
andre brugere søger efter folk ("Emma Holm"), og tælles med i antallet af
brugere i de tal, der bliver målt. Fjern dem med `demo:reset`, når de ikke
skal bruges.
