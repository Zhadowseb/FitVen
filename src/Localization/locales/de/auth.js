// Anmeldung, Registrierung, Zustimmung und die Auth-Fehler.
export default {
  createAccount: "Konto erstellen",
  fields: {
    email: "E-Mail",
    emailPlaceholder: "du@beispiel.de",
    password: "Passwort",
    passwordPlaceholder: "Passwort eingeben",
    showPassword: "Passwort anzeigen",
    hidePassword: "Passwort verbergen",
  },
  errors: {
    enterEmail: "Gib deine E-Mail-Adresse ein.",
    enterPassword: "Gib dein Passwort ein.",
    enterEmailFirst: "Gib zuerst deine E-Mail-Adresse ein.",
    signInToDeleteAccount: "Du musst angemeldet sein, um dein Konto zu löschen.",
    couldNotDeleteAccount: "Das Konto konnte nicht gelöscht werden.",
  },
  login: {
    title: "Anmelden",
    subtitle: "Melde dich an, um deine Programme und Workouts zu laden.",
    submit: "Anmelden",
    signingIn: "Anmeldung läuft...",
    couldNotSignIn: "Anmeldung nicht möglich.",
    forgotPassword: "Passwort vergessen?",
    sending: "Wird gesendet...",
    enterEmailThenTapAgain: "Gib deine E-Mail-Adresse ein und tippe dann erneut hierauf.",
    resetLinkSent:
      "Falls zu dieser Adresse ein Konto existiert, ist ein Link zum Festlegen eines neuen Passworts unterwegs. Er läuft ab und funktioniert nur einmal.",
    couldNotSendEmail: "Die E-Mail konnte nicht gesendet werden. Versuche es erneut.",
    newHere: "Neu hier?",
  },
  register: {
    subtitle: "Mit einem Konto synchronisierst du deine Programme und Workouts über alle Geräte.",
    username: "Benutzername",
    usernamePlaceholder: "dein_name",
    usernamePreviewExample: "dein_name#1234",
    usernameHint:
      "FitVen ergänzt einen vierstelligen Tag, sodass du als {preview} erscheinst. Der Tag lässt sich später nicht ändern.",
    passwordMinLength: {
      one: "Mindestens {count} Zeichen.",
      other: "Mindestens {count} Zeichen.",
    },
    repeatPassword: "Passwort wiederholen",
    termsCheckbox: "Ich stimme den Nutzungsbedingungen zu.",
    termsCheckboxAccessibility: "Ich stimme den Nutzungsbedingungen zu",
    termsSummary:
      "Anstößige Inhalte und missbräuchliches Verhalten werden nicht toleriert. Wer dagegen verstößt, verliert sein Konto.",
    readFullTerms: "Vollständige Nutzungsbedingungen lesen",
    howDataIsHandled: "Wie FitVen mit deinen Daten umgeht",
    creating: "Konto wird erstellt...",
    errors: {
      pickUsername: "Wähle einen Benutzernamen.",
      usernameRules: "Nutze 3–20 Kleinbuchstaben, Zahlen oder Unterstriche.",
      choosePassword: "Wähle ein Passwort.",
      repeatPassword: "Gib das Passwort noch einmal ein.",
      passwordsDiffer: "Die beiden Passwörter stimmen nicht überein.",
      acceptTerms: "Du musst die Bedingungen akzeptieren, um ein Konto zu erstellen.",
      couldNotCreate: "Das Konto konnte nicht erstellt werden.",
    },
    done: {
      confirmEmailTitle: "E-Mail bestätigen",
      confirmEmailBody:
        "Wir haben einen Link an {email} geschickt. Öffne ihn, um die Adresse zu bestätigen, und melde dich dann an.",
      accountCreatedTitle: "Konto erstellt",
      accountCreatedBody: "Dein Konto ist bereit. Melde dich an, um loszulegen.",
      goToLogin: "Zur Anmeldung",
    },
  },
  consent: {
    title: "Bevor es weitergeht",
    body:
      "Zwei Dinge, denen du zustimmen musst. Die Nutzungsbedingungen legen fest, was bei FitVen erlaubt ist und was nicht – anstößige Inhalte und missbräuchliches Verhalten werden nicht toleriert. Die Datenschutzerklärung regelt den Umgang mit deinen Daten: FitVen speichert dein Training und, über Krankheitseinträge, Herzfrequenz und mit einer früheren FitVen-Version aufgezeichnete Läufe, auch Gesundheitsdaten über dich, für die das europäische Recht deine ausdrückliche Einwilligung verlangt. Lies beides und tippe auf Akzeptieren, um fortzufahren, oder schließe die App, wenn du das nicht möchtest.",
    termsHeading: "Nutzungsbedingungen",
    privacyHeading: "Datenschutzerklärung",
    accept: "Beides akzeptieren und weiter",
    saving: "Wird gespeichert...",
    couldNotSave: "Deine Antwort konnte nicht gespeichert werden. Versuche es erneut.",
  },
};
