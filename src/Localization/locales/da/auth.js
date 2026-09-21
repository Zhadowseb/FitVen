// Keep in step with ../en/auth.js.
export default {
  createAccount: "Opret konto",
  fields: {
    email: "E-mail",
    emailPlaceholder: "dig@eksempel.dk",
    password: "Adgangskode",
    passwordPlaceholder: "Indtast adgangskode",
    showPassword: "Vis adgangskode",
    hidePassword: "Skjul adgangskode",
  },
  errors: {
    enterEmail: "Indtast din e-mailadresse.",
    enterPassword: "Indtast din adgangskode.",
    enterEmailFirst: "Indtast din e-mailadresse først.",
    signInToDeleteAccount: "Du skal være logget ind for at slette din konto.",
    couldNotDeleteAccount: "Kunne ikke slette kontoen.",
  },
  login: {
    title: "Log ind",
    subtitle: "Log ind for at hente dine programmer og træninger.",
    submit: "Log ind",
    signingIn: "Logger ind...",
    couldNotSignIn: "Kunne ikke logge ind.",
    forgotPassword: "Glemt adgangskode?",
    sending: "Sender...",
    enterEmailThenTapAgain: "Indtast din e-mailadresse, og tryk her igen.",
    resetLinkSent:
      "Hvis den adresse har en konto, er et link til at vælge en ny adgangskode på vej. Det udløber, og det virker kun én gang.",
    couldNotSendEmail: "Kunne ikke sende e-mailen. Prøv igen.",
    newHere: "Ny her?",
  },
  register: {
    subtitle: "En konto synkroniserer dine programmer og træninger på tværs af enheder.",
    username: "Brugernavn",
    usernamePlaceholder: "dit_navn",
    usernamePreviewExample: "dit_navn#1234",
    usernameHint:
      "FitVen tilføjer et 4-cifret tag, så det vises som {preview}. Tagget kan ikke ændres senere.",
    passwordMinLength: {
      one: "Mindst {count} tegn.",
      other: "Mindst {count} tegn.",
    },
    repeatPassword: "Gentag adgangskode",
    // Samme betydning som den engelske: nultolerance over for anstødeligt
    // indhold og krænkende brugere. scripts/test-terms-of-use.js tjekker det.
    termsCheckbox: "Jeg accepterer brugsbetingelserne.",
    termsCheckboxAccessibility: "Jeg accepterer brugsbetingelserne",
    termsSummary:
      "Der er nultolerance over for anstødeligt indhold og krænkende adfærd. Bryder du det, lukkes kontoen.",
    readFullTerms: "Læs de fulde brugsbetingelser",
    howDataIsHandled: "Sådan håndterer FitVen dine data",
    creating: "Opretter konto...",
    errors: {
      pickUsername: "Vælg et brugernavn.",
      usernameRules: "Brug 3-20 små bogstaver, tal eller understreger.",
      choosePassword: "Vælg en adgangskode.",
      repeatPassword: "Skriv adgangskoden igen.",
      passwordsDiffer: "De to adgangskoder er ikke ens.",
      acceptTerms: "Du skal acceptere betingelserne for at oprette en konto.",
      couldNotCreate: "Kunne ikke oprette kontoen.",
    },
    done: {
      confirmEmailTitle: "Bekræft din e-mail",
      confirmEmailBody:
        "Vi har sendt et link til {email}. Åbn det for at bekræfte adressen, og log derefter ind.",
      accountCreatedTitle: "Konto oprettet",
      accountCreatedBody: "Din konto er klar. Log ind for at komme i gang.",
      goToLogin: "Gå til log ind",
    },
  },
  consent: {
    title: "Før du fortsætter",
    body:
      "To ting at acceptere. Brugsbetingelserne fastlægger, hvad der er og ikke er tilladt på FitVen — der er nultolerance over for anstødeligt indhold og krænkende adfærd. Privatlivspolitikken handler om dine data: FitVen gemmer din træning og, gennem sygdomsregistreringer, puls og registrerede løb, helbredsoplysninger om dig, som europæisk lov kræver din udtrykkelige tilladelse til. Læs begge og tryk på Accepter for at fortsætte, eller luk appen, hvis du hellere vil lade være.",
    termsHeading: "Brugsbetingelser",
    privacyHeading: "Privatlivspolitik",
    accept: "Accepter begge og fortsæt",
    saving: "Gemmer...",
    couldNotSave: "Kunne ikke gemme dit svar. Prøv igen.",
  },
};
