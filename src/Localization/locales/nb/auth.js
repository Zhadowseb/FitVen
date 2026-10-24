// Innlogging, registrering, samtykke og feilmeldingene brukeren leser.
export default {
  createAccount: "Opprett konto",
  fields: {
    email: "E-post",
    emailPlaceholder: "deg@eksempel.no",
    password: "Passord",
    passwordPlaceholder: "Skriv inn passord",
    showPassword: "Vis passord",
    hidePassword: "Skjul passord",
  },
  errors: {
    enterEmail: "Skriv inn e-postadressen din.",
    enterPassword: "Skriv inn passordet ditt.",
    enterEmailFirst: "Skriv inn e-postadressen din først.",
    signInToDeleteAccount: "Du må være logget inn for å slette kontoen din.",
    couldNotDeleteAccount: "Kunne ikke slette kontoen.",
  },
  login: {
    title: "Logg inn",
    subtitle: "Logg inn for å hente programmene og øktene dine.",
    submit: "Logg inn",
    signingIn: "Logger inn...",
    couldNotSignIn: "Kunne ikke logge inn.",
    forgotPassword: "Glemt passordet?",
    sending: "Sender...",
    enterEmailThenTapAgain: "Skriv inn e-postadressen din, og trykk her igjen.",
    resetLinkSent:
      "Hvis adressen har en konto, er en lenke for å velge nytt passord på vei. Den utløper, og den virker bare én gang.",
    couldNotSendEmail: "Kunne ikke sende e-posten. Prøv igjen.",
    newHere: "Ny her?",
  },
  register: {
    subtitle: "En konto synkroniserer programmene og øktene dine mellom enheter.",
    username: "Brukernavn",
    usernamePlaceholder: "ditt_navn",
    usernamePreviewExample: "ditt_navn#1234",
    usernameHint:
      "FitVen legger til en tagg på 4 sifre, så navnet vises som {preview}. Taggen kan ikke endres senere.",
    passwordMinLength: {
      one: "Minst {count} tegn.",
      other: "Minst {count} tegn.",
    },
    repeatPassword: "Gjenta passord",
    termsCheckbox: "Jeg godtar brukervilkårene.",
    termsCheckboxAccessibility: "Jeg godtar brukervilkårene",
    termsSummary:
      "Det er nulltoleranse for støtende innhold eller krenkende oppførsel. Bryter du det, forsvinner kontoen.",
    readFullTerms: "Les hele brukervilkårene",
    howDataIsHandled: "Hvordan FitVen behandler dataene dine",
    creating: "Oppretter konto...",
    errors: {
      pickUsername: "Velg et brukernavn.",
      usernameRules: "Bruk 3–20 små bokstaver, tall eller understreker.",
      choosePassword: "Velg et passord.",
      repeatPassword: "Skriv passordet én gang til.",
      passwordsDiffer: "De to passordene er ikke like.",
      acceptTerms: "Du må godta vilkårene for å opprette en konto.",
      couldNotCreate: "Kunne ikke opprette kontoen.",
    },
    done: {
      confirmEmailTitle: "Bekreft e-posten din",
      confirmEmailBody:
        "Vi har sendt en lenke til {email}. Åpne den for å bekrefte adressen, og logg deretter inn.",
      accountCreatedTitle: "Kontoen er opprettet",
      accountCreatedBody: "Kontoen din er klar. Logg inn for å komme i gang.",
      goToLogin: "Gå til innlogging",
    },
  },
  consent: {
    title: "Før du fortsetter",
    body:
      "Du må godta to ting. Brukervilkårene sier hva som er og ikke er tillatt på FitVen — det er nulltoleranse for støtende innhold eller krenkende oppførsel. Personvernerklæringen handler om dataene dine: FitVen lagrer treningen din, og gjennom sykdomsregistreringer, puls og løpeturer sporet med en tidligere versjon av FitVen også helsedata om deg, noe europeisk lov krever uttrykkelig samtykke til. Les begge, og trykk Godta for å fortsette, eller lukk appen hvis du heller ikke vil.",
    termsHeading: "Brukervilkår",
    privacyHeading: "Personvernerklæring",
    accept: "Godta begge og fortsett",
    saving: "Lagrer...",
    couldNotSave: "Kunne ikke lagre svaret ditt. Prøv igjen.",
  },
};
