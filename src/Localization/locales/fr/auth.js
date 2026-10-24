// Connexion, inscription, consentement et messages d'erreur d'authentification.
export default {
  createAccount: "Créer un compte",
  fields: {
    email: "E-mail",
    emailPlaceholder: "toi@exemple.com",
    password: "Mot de passe",
    passwordPlaceholder: "Saisis ton mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
  },
  errors: {
    enterEmail: "Saisis ton adresse e-mail.",
    enterPassword: "Saisis ton mot de passe.",
    enterEmailFirst: "Saisis d'abord ton adresse e-mail.",
    signInToDeleteAccount: "Tu dois être connecté pour supprimer ton compte.",
    couldNotDeleteAccount: "Impossible de supprimer le compte.",
  },
  login: {
    title: "Connexion",
    subtitle: "Connecte-toi pour retrouver tes programmes et tes séances.",
    submit: "Se connecter",
    signingIn: "Connexion…",
    couldNotSignIn: "Impossible de se connecter.",
    forgotPassword: "Mot de passe oublié ?",
    sending: "Envoi…",
    enterEmailThenTapAgain: "Saisis ton adresse e-mail, puis appuie de nouveau ici.",
    resetLinkSent:
      "Si un compte existe avec cette adresse, un lien pour choisir un nouveau mot de passe est en route. Il expire et ne fonctionne qu'une seule fois.",
    couldNotSendEmail: "Impossible d'envoyer l'e-mail. Réessaie.",
    newHere: "Première visite ?",
  },
  register: {
    subtitle: "Un compte synchronise tes programmes et tes séances entre tous tes appareils.",
    username: "Nom d'utilisateur",
    usernamePlaceholder: "ton_nom",
    usernamePreviewExample: "ton_nom#1234",
    usernameHint:
      "FitVen ajoute un tag à 4 chiffres : il s'affichera donc sous la forme {preview}. Ce tag ne pourra plus être modifié.",
    passwordMinLength: {
      one: "Au moins {count} caractère.",
      other: "Au moins {count} caractères.",
    },
    repeatPassword: "Répète le mot de passe",
    termsCheckbox: "J'accepte les conditions d'utilisation.",
    termsCheckboxAccessibility: "J'accepte les conditions d'utilisation",
    termsSummary:
      "Aucune tolérance pour les contenus choquants ou les comportements abusifs. Enfreins cette règle et ton compte est supprimé.",
    readFullTerms: "Lire les conditions d'utilisation complètes",
    howDataIsHandled: "Comment FitVen traite tes données",
    creating: "Création du compte…",
    errors: {
      pickUsername: "Choisis un nom d'utilisateur.",
      usernameRules: "Utilise 3 à 20 lettres minuscules, chiffres ou tirets bas.",
      choosePassword: "Choisis un mot de passe.",
      repeatPassword: "Saisis à nouveau le mot de passe.",
      passwordsDiffer: "Les deux mots de passe ne sont pas identiques.",
      acceptTerms: "Tu dois accepter les conditions pour créer un compte.",
      couldNotCreate: "Impossible de créer le compte.",
    },
    done: {
      confirmEmailTitle: "Confirme ton e-mail",
      confirmEmailBody:
        "Nous avons envoyé un lien à {email}. Ouvre-le pour confirmer l'adresse, puis connecte-toi.",
      accountCreatedTitle: "Compte créé",
      accountCreatedBody: "Ton compte est prêt. Connecte-toi pour commencer.",
      goToLogin: "Aller à la connexion",
    },
  },
  consent: {
    title: "Avant de continuer",
    body:
      "Deux choses à accepter. Les conditions d'utilisation fixent ce qui est autorisé ou non sur FitVen — aucune tolérance pour les contenus choquants ou les comportements abusifs. La politique de confidentialité couvre tes données : FitVen enregistre tes entraînements et, via les entrées de maladie, la fréquence cardiaque et les courses suivies avec une version antérieure de FitVen, des données de santé te concernant, pour lesquelles le droit européen exige ton autorisation explicite. Lis les deux et appuie sur Accepter pour continuer, ou ferme l'app si tu préfères ne pas le faire.",
    termsHeading: "Conditions d'utilisation",
    privacyHeading: "Politique de confidentialité",
    accept: "Tout accepter et continuer",
    saving: "Enregistrement…",
    couldNotSave: "Impossible d'enregistrer ta réponse. Réessaie.",
  },
};
