// Demande à FitVen : le chat IA sur ton propre entraînement - la barre de
// l'accueil, le chat, le consentement la première fois et l'interrupteur du
// profil. À garder alignés avec ../en/ask.js.
export default {
  title: "Demande à FitVen",
  placeholder: "Pose une question sur ton entraînement…",
  openLabel: "Demander à FitVen à propos de ton entraînement",
  badge: "Seulement tes données",
  badgeHint: "Ouvre une explication de ce que l'IA peut voir",
  badgeSheet: {
    title: "Seulement tes données",
    body: "L'IA de FitVen peut lire tes propres séances, records, programmes et pas quand tu poses une question. Elle ne voit pas les données des autres et ne change rien sans toi.",
  },
  menu: {
    open: "Menu du chat",
    newChat: "Nouveau chat",
  },
  empty: {
    title: "Demande ce que tu veux sur ton entraînement",
    intro: "FitVen lit tes propres séances, records, programmes et pas pour répondre. Jamais ceux des autres.",
  },
  suggest: {
    stuck: "Pourquoi mon {exercise} stagne-t-il ?",
    stuckAny: "Lequel de mes mouvements stagne ?",
    next: "Comment aborder ma prochaine séance {workout} ?",
    today: "Que dois-je m'entraîner aujourd'hui ?",
    month: "Comment s'est passé {month} ?",
    recent: "Comment se sont passées mes dernières semaines ?",
    volume: "Mon volume hebdomadaire est-il équilibré ?",
  },
  disclaimer: "L'IA peut se tromper. Conseils généraux, pas un avis médical.",
  input: {
    label: "Demande à FitVen",
    send: "Envoyer",
    speak: "Dicter ta question",
  },
  typing: "FitVen réfléchit…",
  answered: "FitVen a répondu",
  chart: {
    a11y: "{title}, {range}. {summary}",
    a11yNoRange: "{title}. {summary}",
  },
  suggestion: {
    eyebrow: "Changement suggéré · {workout}",
    add: "Ajouter à la prochaine séance {workout}",
    notNow: "Pas maintenant",
    group: "Changement suggéré pour {workout} : {text}",
    added: "Ajouté à {workout}",
    undo: "Annuler",
    undone: "Changement annulé",
    dismissed: "Non ajouté",
    line: "{exercise} : {sets}",
    setPart: "{count} × {reps} à {weight} kg",
    noWorkout: "Tu n'as aucune séance {workout} prévue, donc il n'y a rien à modifier.",
    failed: "Impossible de l'ajouter. Réessaie dans un instant.",
    undoFailed: "Impossible d'annuler le changement.",
  },
  sources: {
    line: {
      one: "Basé sur {count} séance · {range}",
      other: "Basé sur {count} séances · {range}",
    },
    lineNoRange: {
      one: "Basé sur {count} séance",
      other: "Basé sur {count} séances",
    },
    see: "Les voir",
    seeHint: "Ouvre les séances sur lesquelles la réponse s'appuie",
  },
  tier: {
    haiku: "Haiku",
    sonnet: "Sonnet",
    opus: "Opus",
    left: {
      one: "{count} restante",
      other: "{count} restantes",
    },
    recommended: "Recommandé",
    a11y: {
      one: "{name}, {count} question restante ce mois-ci",
      other: "{name}, {count} questions restantes ce mois-ci",
    },
    a11yUnknown: "{name}",
    pickerLabel: "Choisis le modèle qui répondra",
  },
  quota: {
    reached: "Tu as utilisé toutes tes questions {tier} ce mois-ci.",
    reachedAll: "Tu as utilisé toutes tes questions ce mois-ci. Elles repartent le mois prochain.",
    pickAnother: "Demande plutôt avec un autre modèle :",
    use: "Utiliser {tier}",
  },
  error: {
    offline: "Tu es hors ligne. Redemande quand tu seras connecté.",
    generic: "Une erreur s'est produite. Réessaie.",
    provider: "L'IA de FitVen n'a pas pu répondre pour le moment. Réessaie.",
    unavailable: "Demande à FitVen n'est pas disponible pour le moment. Réessaie plus tard.",
    unauthorized: "Reconnecte-toi pour poser une question.",
    consent: "Accepte de partager tes données d'entraînement pour poser une question.",
  },
  consent: {
    title: "Avant de demander",
    intro: "Pour répondre, l'IA de FitVen doit lire tes propres données d'entraînement.",
    what: {
      title: "Ce qui est partagé",
      body: "Ta question et les données d'entraînement FitVen dont elle a besoin : séances, records, programmes et pas.",
    },
    who: {
      title: "Qui les reçoit",
      body: "Le fournisseur d'IA qui rédige la réponse. Elles servent à te répondre, rien d'autre.",
    },
    others: {
      title: "Les autres personnes",
      body: "Rien n'est partagé avec les autres utilisateurs. Ton chat reste sur ce téléphone.",
    },
    change: "Tu peux le désactiver à tout moment dans ton profil.",
    continue: "Continuer",
    notNow: "Pas maintenant",
    failed: "Impossible d'enregistrer ton choix. Vérifie ta connexion et réessaie.",
  },
  settings: {
    title: "Demande à FitVen",
    body: "Laisse l'IA de FitVen lire tes données d'entraînement quand tu lui poses une question. Si tu le désactives, Demande à FitVen disparaît de l'accueil.",
    failed: "Impossible de changer cela. Vérifie ta connexion et réessaie.",
  },
};
