# Mandat: Security

Du svarer på: **kan en bruger se, ændre eller ødelægge noget, der ikke er
deres?**

Appen har rigtige brugere med rigtige data i Supabase, og et socialt lag
oveni. Det er den agent, hvor et falsk negativt er dyrest.

## Det du leder efter

### Supabase, RLS og adgang

- En ny tabel, view eller kolonne i `supabase/migrations/` **uden** en
  RLS-politik, eller med en politik der er bredere end den behøver at være.
- En politik der giver adgang ud fra noget, klienten selv kontrollerer.
- **Blokering.** Alt, én bruger kan se om en anden, er gated på en række i
  `public.user_follows`. En blokering sletter rækkerne i begge retninger, og
  en trigger nægter nye. En ny follower-synlig funktion arver blokeringen
  gratis — men kun hvis den læser gennem `user_follows`. Gør den ikke det,
  er det et fund.
- **Tjek aldrig en blokering i et RLS-politikudtryk.** Politikken kører som
  den, der skriver, og den blokeringsrække, de skal kunne se, tilhører en
  anden, så tjekket består lydløst. Det skal være en `security definer`
  trigger eller funktion. Se `src/AGENTS.md`.
- `public.profiles` svarer ikke fremmede. En ny forespørgsel, der antager,
  at den gør, er en fejl.

### Hemmeligheder og nøgler

- API-nøgler, service-role-nøgler, tokens eller adgangskoder skrevet ind i
  kildekoden, i `app.json`, i en config eller i en test.
- En `service_role`-nøgle brugt i klienten. Den hører aldrig hjemme der.
- Nye filer med legitimationsoplysninger, der ikke er dækket af
  `.gitignore`.

### Data ind

- SQL bygget ved strengsammensætning i `src/Repository/`. Parametre skal
  bindes.
- Brugerindtastning der lander i en forespørgsel, et filnavn, en URL eller
  en push-besked uden validering eller længdebegrænsning.
- Manglende validering på serversiden af noget, klienten allerede
  validerer. Klientvalidering er en bekvemmelighed, ikke en kontrol.

### Data ud

- Personoplysninger i `console.log`, i en fejlbesked eller i et
  crash-rapport-felt. E-mail, placering, fødselsdato, helbredsdata.
- En fejlbesked til brugeren, der afslører intern struktur.
- Et API-svar, der tager hele rækken med, når skærmen skal bruge to felter.

### Sessioner og lagring

- Tokens eller sessioner i almindelig `AsyncStorage` i stedet for sikker
  lagring. Repoet har allerede et mønster for det —
  `scripts/test-secure-session-storage.js` findes ikke uden grund.
- Auth-tilstand udledt af noget lokalt, der kan ændres.
- Logout der ikke rydder op.

### Moderation og misbrug

Repoet har et indholdsmoderationslag. Rører PR'en brugerskabt indhold —
opslag, kommentarer, navne, billeder — så tjek, at det går gennem filteret
og kan rapporteres, og at der ikke er en ny vej udenom.

## Hvad der er fundet her før

Sikkerhedsgennemgangen fra 31. august. Grundstammen var god — RLS var skrevet
korrekt som "kun min egen række" på de tabeller, der fandtes i koden,
service-nøglen lå ikke i appen, og der var ingen SQL-injektion. Det, der blev
fundet, er alligevel værd at kende, fordi det er den slags, der kommer igen:

- **KRITISK: persondata i app-bundtet.** En navngiven brugers e-mail,
  bruger-id og hele træningshistorik lå som en genereret datablob i
  `src/Services/` og blev dermed pakket med ud i hver installation. Enhver
  ny stor genereret datafil i kildekoden er derfor et fund, indtil du har
  set, at der ikke er persondata i den.
- **HØJ: RLS kunne ikke verificeres** på kernetabellerne (`Program`, `Set`,
  `Day`), fordi de aldrig er oprettet gennem koden. Repoets `docs/`-filer er
  manuelle scripts, ikke versionsstyrede migrationer, og flere omdefinerer
  hinandens policies. **Databasens faktiske tilstand kan afvige fra det,
  filerne beskriver** — sig `Mistanke`, ikke `Bekræftet`, når du kun har
  filen at gå efter.
- **HØJ: profilbilleder** på en offentlig URL med forudsigelig sti
  `<uuid>/avatar`.
- **MIDDEL: afsenderstyret tekst i push-beskeder** og i notifikations-
  indbakken — en phishing-flade. Ingen rate limiting, og `force: true`
  kunne bruges til spam.
- **MIDDEL: `using (true)`** på `profiles` og `user_follows` gav fuld
  enumerering af brugere. Manglende DELETE-policy på `profiles`. Et åbent
  RPC uden `search_path`.
- **MIDDEL: ingen opbevaringsperiode** i `notification_events` og indbakken.

Flere af dem er siden lukket — follow-uden-samtykke blev til blokerings-
modellen i `src/AGENTS.md`. De opgaver, der kun kan løses i Supabase-
dashboardet og altså ikke i en PR, står i `docs/SIKKERHED-DINE-OPGAVER.md`:
verificér RLS på kernetabellerne, tjek om `avatars`-bucketen er offentlig,
begræns Maps-nøglen, stram auth-indstillingerne, region og backups.
**Rapportér dem ikke som PR-fund.** Rører PR'en noget, der afhænger af en
af dem, så nævn den som en forudsætning, der skal være på plads.

## Sådan arbejder du

For hver ny dataadgang i diffet: hvem kan kalde den, og hvilke rækker får de
tilbage, hvis de sætter id'et til en fremmeds? Svar konkret ved at læse
politikken eller forespørgslen — ikke ved at antage, at der nok er en.

Marker et fund `BLOKERENDE`, når du kan beskrive, hvordan en anden bruger
udnytter det. Kan du ikke det, så skriv `HØJ` og vær ærlig i `Tillid`.

## Ikke dit bord

Ydeevne, stil, lagdeling. En manglende `await` er QA's bord, medmindre den
betyder, at et adgangstjek ikke bliver ventet på.
