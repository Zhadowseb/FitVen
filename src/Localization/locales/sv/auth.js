// Inloggning, registrering, samtyckesskärmen och de autentiseringsfel användaren ser.
export default {
  createAccount: "Skapa konto",
  fields: {
    email: "E-post",
    emailPlaceholder: "du@exempel.se",
    password: "Lösenord",
    passwordPlaceholder: "Ange lösenord",
    showPassword: "Visa lösenord",
    hidePassword: "Dölj lösenord",
  },
  errors: {
    enterEmail: "Ange din e-postadress.",
    enterPassword: "Ange ditt lösenord.",
    enterEmailFirst: "Ange din e-postadress först.",
    signInToDeleteAccount: "Du måste vara inloggad för att radera ditt konto.",
    couldNotDeleteAccount: "Kontot kunde inte raderas.",
  },
  login: {
    title: "Logga in",
    subtitle: "Logga in för att hämta dina program och pass.",
    submit: "Logga in",
    signingIn: "Loggar in...",
    couldNotSignIn: "Det gick inte att logga in.",
    forgotPassword: "Glömt lösenordet?",
    sending: "Skickar...",
    enterEmailThenTapAgain: "Ange din e-postadress och tryck sedan här igen.",
    resetLinkSent:
      "Om adressen har ett konto är en länk för att välja nytt lösenord på väg. Länken går ut och fungerar bara en gång.",
    couldNotSendEmail: "Mejlet kunde inte skickas. Försök igen.",
    newHere: "Ny här?",
  },
  register: {
    subtitle: "Med ett konto synkas dina program och pass mellan enheter.",
    username: "Användarnamn",
    usernamePlaceholder: "ditt_namn",
    usernamePreviewExample: "ditt_namn#1234",
    usernameHint:
      "FitVen lägger till en fyrsiffrig tagg, så det visas som {preview}. Taggen kan inte ändras senare.",
    passwordMinLength: {
      one: "Minst {count} tecken.",
      other: "Minst {count} tecken.",
    },
    repeatPassword: "Upprepa lösenordet",
    // App Store compliance: the summary beside the checkbox must say, in so
    // many words, that there is no tolerance for objectionable content or
    // abusive users.
    termsCheckbox: "Jag godkänner användarvillkoren.",
    termsCheckboxAccessibility: "Jag godkänner användarvillkoren",
    termsSummary:
      "Vi har nolltolerans mot stötande innehåll och kränkande beteende. Bryter du mot det raderas kontot.",
    readFullTerms: "Läs hela användarvillkoren",
    howDataIsHandled: "Så hanterar FitVen dina data",
    creating: "Skapar konto...",
    errors: {
      pickUsername: "Välj ett användarnamn.",
      usernameRules: "Använd 3-20 gemena bokstäver, siffror eller understreck.",
      choosePassword: "Välj ett lösenord.",
      repeatPassword: "Skriv lösenordet igen.",
      passwordsDiffer: "De två lösenorden är inte likadana.",
      acceptTerms: "Du måste godkänna villkoren för att skapa ett konto.",
      couldNotCreate: "Det gick inte att skapa kontot.",
    },
    done: {
      confirmEmailTitle: "Bekräfta din e-post",
      confirmEmailBody:
        "Vi har skickat en länk till {email}. Öppna den för att bekräfta adressen och logga sedan in.",
      accountCreatedTitle: "Kontot är skapat",
      accountCreatedBody: "Ditt konto är klart. Logga in för att komma igång.",
      goToLogin: "Till inloggningen",
    },
  },
  consent: {
    title: "Innan du fortsätter",
    body:
      "Det är två saker att godkänna. Användarvillkoren beskriver vad som är och inte är tillåtet på FitVen – vi har nolltolerans mot stötande innehåll och kränkande beteende. Integritetspolicyn gäller dina data: FitVen sparar din träning och, genom sjukdomsregistreringar, puls och löprundor som spårats med en tidigare version av FitVen, hälsodata om dig, vilket enligt europeisk lag kräver ditt uttryckliga samtycke. Läs båda och tryck på Godkänn för att gå vidare, eller stäng appen om du hellre inte vill.",
    termsHeading: "Användarvillkor",
    privacyHeading: "Integritetspolicy",
    accept: "Godkänn båda och fortsätt",
    saving: "Sparar...",
    couldNotSave: "Ditt svar kunde inte sparas. Försök igen.",
  },
};
