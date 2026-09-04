# Sikkerhed — de opgaver kun du kan løse

Fra sikkerhedsgennemgangen 31. august 2026. Alt herunder ligger i Supabase-
og Google-dashboardene, ikke i koden, så jeg kan hverken se eller ændre det.

Rækkefølgen er efter hastighed, ikke efter hvor svært det er. **Opgave 1 går
forud for alt andet** — den afgør om databasen står åben lige nu.

---

## 1. Verificér at RLS er slået til på kernetabellerne

**Hvorfor:** Tabellerne `Program`, `Mesocycle`, `Microcycle`, `Day`,
`workout_type_instance`, `exercise_instance`, `set`, `Exercise`, `Muscle`,
`Muscle_Activation` og `Feedback` er aldrig oprettet gennem koden — kun ændret.
Deres beskyttelse kan derfor ikke ses. Supabase giver som udgangspunkt rollerne
`anon` og `authenticated` fuld adgang til alt i `public`-skemaet, og RLS er den
eneste reelle spærre. Mangler den på bare én tabel, kan enhver med anon-nøglen
(som ligger i APK'en) læse og ændre alle brugeres data.

Det viser sig ikke ved normal brug af appen, fordi klienten altid selv filtrerer
på `user_id`. Alt ser rigtigt ud, indtil nogen sender en forespørgsel udenom.

**Sådan gør du:**

1. Åbn Supabase → dit FitVen-projekt → **SQL Editor** i venstremenuen.
2. Kør denne:

   ```sql
   select relname, relrowsecurity
   from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r'
   order by relrowsecurity, relname;
   ```

3. Kør derefter denne:

   ```sql
   select tablename, policyname, cmd, roles, qual, with_check
   from pg_policies
   where schemaname = 'public'
   order by tablename, cmd;
   ```

**Hvad du kigger efter:** Alt i første resultat med `relrowsecurity = false` er
åbent. Kryds derefter af i andet resultat: en tabel med RLS slået til, men uden
en eneste policy, er lukket helt (ingen kan læse den) — også det er værd at vide.

**Send mig begge resultater.** Så skriver jeg de faktiske policies ned som
migrationsfiler i `docs/`, så tilstanden er dokumenteret fremover, og retter det
der mangler.

**Hvis noget mangler RLS:** slå den til med det samme — men vær opmærksom på at
`enable row level security` uden policies låser tabellen helt, også for appen.
Skriv til mig først, så laver vi policy og aktivering i samme omgang.

---

## 2. Tjek om `avatars`-bucketen er offentlig

**Hvorfor:** Koden henter profilbilleder med `getPublicUrl()`, som kun virker
hvis bucketen er offentlig. Er den det, gælder de ellers stramme storage-policies
slet ikke for læsning — filerne serveres uden login. Stien er samtidig helt
forudsigelig: `<bruger-uuid>/avatar`, og alle bruger-uuid'er kan læses af enhver
med en konto. Så har man i praksis permanente, offentlige URL'er til samtlige
brugeres ansigtsbilleder.

**Sådan gør du:**

1. Supabase → **Storage** → **Buckets**.
2. Find `avatars`. Der står **Public** eller **Private** ud for den.

**Send mig svaret.** Er den offentlig, laver jeg om til signerede URL'er med kort
levetid — det er den rigtige løsning, fordi et slettet billede så også reelt
forsvinder. Bemærk at eksisterende offentlige URL'er allerede kan være kopieret
eller cachet; ændringen lukker fremtiden, ikke fortiden.

---

## 3. Begræns Google Maps-nøglen

**Hvorfor:** Nøglen `AIzaSyBzhic…` skal ligge i appen — det er ikke fejlen.
Fejlen er hvis den kan bruges fra hvor som helst. Så kan en tredjepart trække
den ud af APK'en og sende regningen til din Google-konto, og bruge kvoten op så
kortet holder op med at virke for dine brugere. Ingen persondata er berørt.

**Sådan gør du:**

1. Find først din SHA-1. Bruger du Google Play App Signing (standard i dag), er
   det Googles certifikat der tæller, ikke dit eget:
   **Play Console** → FitVen → **Test og udgivelse** → **Appintegritet** →
   **Appsigneringsnøglecertifikat** → kopiér **SHA-1**.
2. Gå til **Google Cloud Console** → **APIs & Services** → **Credentials**.
3. Klik på nøglen.
4. Under **Application restrictions**: vælg **Android apps** og tilføj
   pakkenavn `com.anonymous.programapp` + SHA-1'en fra trin 1.
   Tilføj også iOS-bundle-id'et `com.fitven.app` hvis nøglen bruges der.
5. Under **API restrictions**: begræns til de Maps-API'er du faktisk bruger.
6. Gem.

> Pakkenavnet ser forkert ud (`com.anonymous.*`), men det **skal** blive som det
> er — det er appens identitet på Play Store. Ændrer du det, bliver det en ny
> app, og dine nuværende brugere kan ikke opdatere.

**Sæt derefter et forbrugsloft:** Google Cloud Console → **Billing** →
**Budgets & alerts** → opret et budget med alarm ved fx 50 % og 100 %.

---

## 4. Stram auth-indstillingerne i Supabase

**Hvorfor:** Kontoovertagelse er den nemmeste vej til alt det, RLS ellers
beskytter korrekt — træningsdata, fødselsdato, pulsdata og sygdomsregistreringer.
Adgangskodekravet bliver på 6 tegn efter dit valg, og så er de her indstillinger
den reelle beskyttelse.

**Sådan gør du:**

1. Supabase → **Authentication** → **Policies** (eller **Providers** →
   **Email**, afhængigt af dashboard-versionen).
2. Slå **Leaked password protection** til. Den tjekker adgangskoder mod
   HaveIBeenPwned og afviser dem der optræder i kendte læk. Med 6 tegn som
   minimum er den vigtig.
3. Bekræft at **Confirm email** er slået til, så en konto ikke kan oprettes på
   en adresse man ikke ejer.
4. Under **Rate Limits**: tjek at der er en grænse på login-forsøg. Standarden er
   normalt fornuftig — noter hvad der står, hvis du er i tvivl.

**Overvej MFA.** Appen behandler helbredsoplysninger, så det er relevant. Det
kræver også arbejde i appen — sig til hvis du vil have det med.

---

## 5. Region, databehandleraftaler og backups

**Hvorfor:** Persondata sendes til Supabase, Expo Push Service (USA), Firebase
Cloud Messaging (USA) og Google Maps (USA). Overførsel til USA kræver et gyldigt
grundlag, og det skal fremgå af persondatapolitikken — som jeg skal bruge disse
oplysninger til at kunne henvise korrekt i.

**Sådan gør du:**

1. **Region:** Supabase → **Project Settings** → **General**. Noter regionen.
   Ligger projektet i EU, er der ingen overførsel for databasen selv — kun for
   Expo, Firebase og Maps.
2. **Backup-opbevaringstid:** Supabase → **Database** → **Backups**. Noter hvor
   længe backups gemmes. Det er relevant, fordi en slettet brugers data lever
   videre i backups i den periode, og det skal oplyses.
3. **Databehandleraftaler:** hent og gem dem et sted du kan finde dem igen.
   - Supabase: findes under deres legal-sider (DPA).
   - Expo: deres DPA dækker push-tjenesten.
   - Google (Firebase + Maps): Google Cloud / Firebase databehandlertillæg.

   Du behøver ikke gøre andet end at have dem — men uden dem er der ikke et
   dokumenteret grundlag.

**Send mig region og backup-periode.** De skal stå i persondatapolitikken.

---

## Sådan ligger resten

Alt andet fra rapporten er kode, og det tager jeg:

- Fjernelse af den indlejrede brugers persondata fra bundtet
- Server-side validering og rate limiting i notifikationsfunktionen
- Push-token kan ikke længere fravristes en anden bruger
- Signerede avatar-URL'er (venter på dit svar i opgave 2)
- `console`-kald ude af produktionsbuilds
- `LocationDebugLog` fjernet helt, `device_info` ude af feedback, kun fødselsår
- Session flyttet til Keychain/Keystore — **alle bliver logget ud én gang**
- Positivliste i søgefilteret
- Policies og opbevaringsperioder som SQL, du kører (venter på opgave 1)
- Blokering af følgere, sletning af konto, samtykkeflow

Persondatapolitikkens **tekst** skal du skrive — jeg bygger flowet og linket, men
indholdet er en juridisk beslutning.

To ting fra rapporten er fravalgt bevidst: dataeksport (GDPR art. 20) og
anmeldelse til Datatilsynet (art. 33). Begge forbliver dermed uopfyldte.
