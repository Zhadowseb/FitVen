# Android-downloads på Dev-siden: det skal du gøre

Koden er klar: `store-stats`-funktionen henter nu også Android-installs fra
Google Play og skriver dem i `store_stats` (platform `android`), ved siden af
iOS. Dev-siden har allerede en Android-kolonne; den er bare tom, fordi der ikke
har været noget at fylde den med. Det, der mangler, er adgangen: Google Play
har ingen "salgsrapport" som Apple, så tallene hentes fra de rapporter, Play
Console selv lægger i en Cloud Storage-bucket, og den adgang kan kun du give.

Ingen nøgler ligger i koden eller i appen. Du sætter dem som **secrets på
funktionen** i Supabase (Dashboard -> Edge Functions -> Secrets). Send dem ikke
til mig, og læg dem ikke i chatten.

## 1. Find rapport-bucketen

1. Play Console -> **Download reports** -> **Statistics**.
2. Tryk på knappen **Copy Cloud Storage URI**. Den ser sådan ud:
   `gs://pubsite_prod_<tal>/` (på nogle konti `gs://pubsite_prod_rev_<tal>/`)
3. Selve bucket-navnet er `pubsite_prod_<tal>` (uden `gs://` og uden skråstreg).
   Det er værdien til `PLAY_REPORTS_BUCKET`. For FitVens udviklerkonto er det
   `pubsite_prod_7090016886199254644`: det blev læst ud af linket til
   oktober-rapporten på Statistik-siden, hvor filen hedder
   `stats/installs/installs_com.anonymous.programapp_202610_overview.csv`, præcis
   som koden forventer.

## 2. Lav en service account (Google Cloud)

1. Google Cloud Console -> vælg det projekt, du bruger til FitVen (eller lav et
   nyt, kun til det her) -> **IAM & Admin** -> **Service accounts** -> **Create**.
2. Navn fx `fitven-play-stats`. Den skal **ikke** have nogen rolle i projektet:
   den får sin adgang i Play Console i næste trin, og mere skal den ikke have.
3. Åbn den nye service account -> **Keys** -> **Add key** -> **Create new key**
   -> **JSON**. Filen hentes til din computer. Det er hele indholdet af den fil,
   der skal i `PLAY_SERVICE_ACCOUNT_JSON`. Gem den ikke i repoet.
4. Tjek at **Cloud Storage JSON API** er slået til i projektet (APIs & Services
   -> Library -> "Cloud Storage JSON API"). Det er den normalt som standard.

(Rør ikke ved API-nøgle-begrænsninger i projektet. Det her bruger en service
account, ikke en API-nøgle.)

## 3. Giv den adgang i Play Console

1. Play Console -> **Users and permissions** -> **Invite new users**.
2. Skriv service accountens e-mail (den står i JSON-filen som `client_email`,
   den ender på `.iam.gserviceaccount.com`).
3. Under **App permissions** vælger du FitVen og giver kun:
   **View app information and download bulk reports (read-only)**.
4. Send invitationen. Der kan gå op til et døgn, før adgangen virker.

## 4. Sæt secrets på funktionen

Dashboard -> Edge Functions -> Secrets (eller `npx supabase secrets set ...`):

| Secret | Værdi |
|---|---|
| `PLAY_SERVICE_ACCOUNT_JSON` | hele JSON-filen fra trin 2, indsat som den er |
| `PLAY_REPORTS_BUCKET` | `pubsite_prod_7090016886199254644` |
| `PLAY_PACKAGE_NAME` | kun hvis den ikke er `com.anonymous.programapp` |

Uden de to første gør funktionen ingenting på Android og siger det i sit svar
(`android.skipped`); iOS påvirkes ikke.

## 5. Udgiv funktionen og prøv den

```bash
npx supabase functions deploy store-stats --no-verify-jwt --project-ref <project-ref>
```

Kør den derefter med hånden (den samme hemmelighed, som cron-jobbet bruger, i
headeren `x-store-stats-secret`) eller vent til 06:15 UTC. Svaret har et
`android`-felt:

- `written` - de dage, der blev skrevet. Første gang er det de seneste 30.
- `notInReport` - dage, Google endnu ikke har skrevet (typisk i går). De bliver
  hentet af næste kørsel. Det er aldrig et nul på Dev-siden, men en tankestreg.
- `noReport` - en måned uden fil (ingen installs den måned, eller endnu ikke
  skrevet). Det er ikke en fejl.
- `problems` - hvis noget er galt. **403** betyder næsten altid, at
  service accounten ikke har fået tilladelsen i trin 3 endnu, eller at
  `PLAY_REPORTS_BUCKET` ikke er din udviklerkontos.

## Hvad tallet er

Det er **Daily User Installs** fra Play Consoles "Installs"-rapport: de brugere,
der installerede appen på en af deres enheder den dag. Det er det nærmeste, Play
har ved iOS' "første downloads", som heller ikke tæller opdateringer og
gen-downloads. Det er ikke det samme tal, og de to kolonner skal ikke
sammenlignes som om de var det. Sammenlign det første rigtige tal med Play
Consoles Statistics-side i hånden, før du stoler på det.

Play skriver en dags tal, når dagen er slut, og som regel med en dags forsinkelse
eller to. De første dage efter, at du har sat det op, kan derfor mangle den
seneste dag.
