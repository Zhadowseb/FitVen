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

HER ER MIT SVAR:

Det her var responset:

relname,relrowsecurity
Day,true
Exercise,true
Feedback,true
Mesocycle,true
Microcycle,true
Muscle,true
Muscle_Activation,true
Program,true
Sickness,true
body_map_region,true
day_template,true
exercise_column_preferences,true
exercise_instance,true
exercise_instance_template,true
mesocycle_template,true
microcycle_template,true
muscle_body_map_region,true
muscle_group,true
muscle_group_assignment,true
notification_events,true
notification_inbox,true
notification_preferences,true
profile_private,true
profiles,true
program_template,true
push_tokens,true
set,true
set_template,true
social_post,true
social_post_hidden_exercise,true
social_post_like,true
sync_local_watchers,true
user_follows,true
workout_start_notification_sources,true
workout_template,true
workout_type,true
workout_type_instance,true

3. Kør derefter denne:

   ```sql
   select tablename, policyname, cmd, roles, qual, with_check
   from pg_policies
   where schemaname = 'public'
   order by tablename, cmd;
   ```

MIT SVAR:

Her er responset:

tablename,policyname,cmd,roles,qual,with_check
Day,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Day,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
Day,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
Day,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Exercise,Enable read access for all users,SELECT,{public},true,null
Feedback,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
Mesocycle,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Mesocycle,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
Mesocycle,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
Mesocycle,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Microcycle,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Microcycle,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
Microcycle,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
Microcycle,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Muscle,Enable read access for all users,SELECT,{public},true,null
Muscle_Activation,Enable read access for all users,SELECT,{public},true,null
Program,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Program,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
Program,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
Program,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null
Sickness,Users can delete their own sickness records,DELETE,{authenticated},(auth.uid() = user_id),null
Sickness,Users can insert their own sickness records,INSERT,{authenticated},null,(auth.uid() = user_id)
Sickness,Users can view their own sickness records,SELECT,{authenticated},(auth.uid() = user_id),null
Sickness,Users can update their own sickness records,UPDATE,{authenticated},(auth.uid() = user_id),(auth.uid() = user_id)
body_map_region,Body map regions are viewable by authenticated users,SELECT,{authenticated},true,null
exercise_column_preferences,Users can delete their own exercise column preferences,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
exercise_column_preferences,Users can insert their own exercise column preferences,INSERT,{authenticated},null,(( SELECT auth.uid() AS uid) = user_id)
exercise_column_preferences,Users can view their own exercise column preferences,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
exercise_column_preferences,Users can update their own exercise column preferences,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),(( SELECT auth.uid() AS uid) = user_id)
exercise_instance,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
exercise_instance,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
exercise_instance,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
exercise_instance,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null
muscle_body_map_region,Muscle body map regions are viewable by authenticated users,SELECT,{authenticated},true,null
muscle_group,Muscle groups are viewable by authenticated users,SELECT,{authenticated},true,null
muscle_group_assignment,Muscle group assignments are viewable by authenticated users,SELECT,{authenticated},true,null
notification_inbox,Users can delete their own notifications,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
notification_inbox,Users can view their own notification inbox,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
notification_inbox,Users can mark their own notifications as read,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),(( SELECT auth.uid() AS uid) = user_id)
notification_preferences,Users can delete their own notification preferences,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
notification_preferences,Users can insert their own notification preferences,INSERT,{authenticated},null,(( SELECT auth.uid() AS uid) = user_id)
notification_preferences,Users can view their own notification preferences,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
notification_preferences,Users can update their own notification preferences,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),(( SELECT auth.uid() AS uid) = user_id)
profile_private,Users can delete their own private profile,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
profile_private,Users can insert their own private profile,INSERT,{authenticated},null,(( SELECT auth.uid() AS uid) = user_id)
profile_private,Users can view their own private profile,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
profile_private,Users can update their own private profile,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),(( SELECT auth.uid() AS uid) = user_id)
profiles,Users can insert their own profile,INSERT,{authenticated},null,(auth.uid() = id)
profiles,Profiles are viewable by authenticated users,SELECT,{authenticated},true,null
profiles,Users can update their own profile,UPDATE,{authenticated},(auth.uid() = id),(auth.uid() = id)
push_tokens,Users can delete their own push tokens,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
push_tokens,Users can register their own push tokens,INSERT,{authenticated},null,(( SELECT auth.uid() AS uid) = user_id)
push_tokens,Users can view their own push tokens,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
push_tokens,Users can update their own push tokens,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),(( SELECT auth.uid() AS uid) = user_id)
set,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
set,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
set,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
set,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null
social_post,Users can delete their own social posts,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = author_id),null
social_post,Users can insert their own social posts,INSERT,{authenticated},null,"((( SELECT auth.uid() AS uid) = author_id) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM workout_type_instance workout
  WHERE ((workout.id = social_post.source_workout_type_instance_id) AND (workout.user_id = ( SELECT auth.uid() AS uid))))))"
social_post,Social posts are viewable by owners and allowed audience,SELECT,{authenticated},"((( SELECT auth.uid() AS uid) IS NOT NULL) AND ((author_id = ( SELECT auth.uid() AS uid)) OR ((deleted_at IS NULL) AND ((visibility = 'everyone'::text) OR ((visibility = 'following'::text) AND (EXISTS ( SELECT 1
   FROM user_follows follow
  WHERE ((follow.follower_id = social_post.author_id) AND (follow.following_id = ( SELECT auth.uid() AS uid))))))))))",null
social_post,Users can update their own social posts,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = author_id),"((( SELECT auth.uid() AS uid) = author_id) AND (EXISTS ( SELECT 1
   FROM workout_type_instance workout
  WHERE ((workout.id = social_post.source_workout_type_instance_id) AND (workout.user_id = ( SELECT auth.uid() AS uid))))))"
social_post_hidden_exercise,Users can unhide their own social post exercises,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
social_post_hidden_exercise,Users can hide their own social post exercises,INSERT,{authenticated},null,(( SELECT auth.uid() AS uid) = user_id)
social_post_hidden_exercise,Users can view their hidden social post exercises,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
social_post_like,Users can remove their own social post likes,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
social_post_like,Users can like visible social posts,INSERT,{authenticated},null,"((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM social_post post
  WHERE ((post.id = social_post_like.post_id) AND (post.deleted_at IS NULL) AND ((post.author_id = ( SELECT auth.uid() AS uid)) OR (post.visibility = 'everyone'::text) OR ((post.visibility = 'following'::text) AND (EXISTS ( SELECT 1
           FROM user_follows follow
          WHERE ((follow.follower_id = post.author_id) AND (follow.following_id = ( SELECT auth.uid() AS uid)))))))))))"
social_post_like,Social post likes are viewable with visible posts,SELECT,{authenticated},"(EXISTS ( SELECT 1
   FROM social_post post
  WHERE ((post.id = social_post_like.post_id) AND (post.deleted_at IS NULL) AND ((post.author_id = ( SELECT auth.uid() AS uid)) OR (post.visibility = 'everyone'::text) OR ((post.visibility = 'following'::text) AND (EXISTS ( SELECT 1
           FROM user_follows follow
          WHERE ((follow.follower_id = post.author_id) AND (follow.following_id = ( SELECT auth.uid() AS uid))))))))))",null
sync_local_watchers,Users can delete own sync watchers,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
sync_local_watchers,Users can insert own sync watchers,INSERT,{authenticated},null,(( SELECT auth.uid() AS uid) = user_id)
sync_local_watchers,Users can view own sync watchers,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
sync_local_watchers,Users can update own sync watchers,UPDATE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),(( SELECT auth.uid() AS uid) = user_id)
user_follows,Users can delete their own follows,DELETE,{authenticated},(auth.uid() = follower_id),null
user_follows,Users can follow from their own profile,INSERT,{authenticated},null,((auth.uid() = follower_id) AND (follower_id <> following_id))
user_follows,Follow rows are viewable by authenticated users,SELECT,{authenticated},true,null
workout_start_notification_sources,Users can delete their own workout start sources,DELETE,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
workout_start_notification_sources,Users can insert their own workout start sources,INSERT,{authenticated},null,"((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM user_follows follow
  WHERE ((follow.follower_id = ( SELECT auth.uid() AS uid)) AND (follow.following_id = workout_start_notification_sources.source_user_id)))))"
workout_start_notification_sources,Users can view their own workout start sources,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
workout_type,Workout types are viewable by authenticated users,SELECT,{authenticated},true,null
workout_type_instance,Enable delete for users based on user_id,DELETE,{public},(( SELECT auth.uid() AS uid) = user_id),null
workout_type_instance,Enable insert for users based on user_id,INSERT,{public},null,(( SELECT auth.uid() AS uid) = user_id)
workout_type_instance,Followed workout activity is viewable,SELECT,{authenticated},"((( SELECT auth.uid() AS uid) = user_id) OR ((deleted_at IS NULL) AND ((date >= (CURRENT_DATE - 1)) AND (date <= (CURRENT_DATE + 1))) AND (EXISTS ( SELECT 1
   FROM user_follows follow
  WHERE ((follow.follower_id = ( SELECT auth.uid() AS uid)) AND (follow.following_id = workout_type_instance.user_id))))))",null
workout_type_instance,Enable users to view their own data only,SELECT,{authenticated},(( SELECT auth.uid() AS uid) = user_id),null
workout_type_instance,Enable update for users based on user_id,UPDATE,{public},(( SELECT auth.uid() AS uid) = user_id),null


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

MIT SVAR:

Den er public.

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

MIT SVAR:

Det er blevet rykket, så det skal vi nok gemme til sidst, så du kan hjælpe mig med det.

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

MIT SVAR:

Leaked password protection, er kun pro plan, som jeg ikke har endnu. Det må vi gemme til senere.

Confirm email er nu slået til.

Der er rate limits på.

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

MIT SVAR:

Region: eu-north-1
Backup: ikke slået til på gratis plan, når der begynder at komme lidt tracksion, opgraderer jeg til pro.
Evt må du godt lave issues på github, med de ting jeg har netop vi gemmer til senere, når jeg opgraderer til pro plan.
Du må også godt lave en issue på at downloade databehandleraftalerne.

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
