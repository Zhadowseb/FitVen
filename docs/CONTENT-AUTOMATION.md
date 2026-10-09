# Automatisk indhold til Instagram

Målet er, at ugens organiske materiale - skærmbilleder og video af den rigtige
app - bliver lavet af sig selv, uden at nogen forbinder en telefon. Selve
opslaget planlægges og postes af et menneske.

Appen bliver ikke gendannet i et designværktøj. Råmaterialet tages fra den
rigtige app i en Android-emulator, så det altid ligner det, der er live.

## Hvordan det hænger sammen

1. **Byg** - `.github/workflows/content-capture.yml` bygger en release-APK af
   appen (kun x86_64, som emulatoren bruger).
2. **Optag** - samme workflow starter en emulator, installerer APK'en og kører
   `scripts/content/capture.sh`, som tager skærmbilleder og en skærmoptagelse.
3. *(ikke bygget endnu)* **Skriv** - Claude vælger ugens emne og skriver
   billedtekst.
4. *(ikke bygget endnu)* **Sæt sammen** - skabeloner (Remotion eller ffmpeg)
   sætter optagelsen i en telefonramme med overskrift, i appens farver.
5. *(ikke bygget endnu)* **Aflever** - billeder, mp4 og tekst lægges som
   download eller sendes til dig.

## Status

Kun trin 1 og 2 findes. Appen startes og når login-skærmen, fordi der ingen
demokonto er. Workflowet kan køres fra fanen *Actions* → *Content capture* →
*Run workflow*. Resultatet er artefaktet `content-capture` (skærmbillede,
optagelse, logcat).

## Det, der skal være på plads, før det kan gå videre

Det er dit at lave. Det rører rigtige konti og hemmeligheder, og det gør jeg ikke.

1. **En demokonto, ikke testkontoen.** Testkontoen følger rigtige personer, og
   en træning på den sendte en "workout started"-notifikation ud til dem. Et
   automatisk job må aldrig kunne ramme rigtige brugere.
2. **Demokontoens omgangskreds er også demokonti.** Opret tre eller fire til
   (fx Emma Holm, Mads Kjær og Jonas) med AI-portrætter som profilbillede, og
   lad demokontoen følge dem og de dem. Så kommer "Venners aktivitet", feedet og
   centrene til at se rigtige ud uden rigtige mennesker.
   Hver konto skal have sin egen e-mailadresse. Det kan løses uden en postkasse
   pr. konto: Gmail-aliasser (`dinadresse+emma@gmail.com`) kommer alle i samme
   indbakke, og med e-mail-videresendelse på `fitven.dk` (fx Cloudflare Email
   Routing, gratis) kan `emma@fitven.dk` osv. gøre det samme. Eller oprettes
   kontoerne af et script med servicenøglen, så de aldrig behøver at bekræfte
   en mail.
3. **Lidt historik.** Log nogle træninger på demokontoen, så Records, Train og
   feedet har noget at vise.
4. **To hemmeligheder i GitHub** (Settings → Secrets and variables → Actions):
   `DEMO_EMAIL` og `DEMO_PASSWORD`. Når de findes, tilføjer jeg login og de
   skærme, ugens opslag skal bruge, til `scripts/content/capture.sh`.

## Kendte grænser

- Byggetrinnet kører hver gang. Når resten virker, bør APK'en bygges ved en
  ny version og gemmes, så ugens job kun installerer den.
- Emulatoren har ingen kamera, Bluetooth eller rigtig GPS. Skærme, der kræver
  dem, kan ikke optages.
- AI-genereret video (fx Higgsfield) passer til stemning og hook, ikke til
  skærmene og ikke til øvelser udført korrekt; modellerne laver forkert teknik.
  Realistisk AI-indhold skal mærkes på Instagram.
