// Un exercice partagé (écran 1b) et son signalement.
// Les mots communs à tous les écrans sur un exercice partagé (les tags, « {n} utilisateurs »,
// « Toi », « ta salle », « Pas de vidéo ») se trouvent dans customExercises.
export default {
  // Le toast sur l'écran auquel tu reviens.
  added: "{name} ajouté à tes exercices",
  menu: {
    open: "Plus d'options",
    report: "Signaler l'exercice",
  },
  video: {
    play: "Lire la vidéo",
    pause: "Mettre la vidéo en pause",
    unavailable: "La vidéo ne peut pas être lue pour le moment",
    needsUpdate: "Mets l'app à jour pour lire la vidéo",
  },
  owner: {
    madeOn: "Créé le {date}",
    profile: "Profil",
    openProfile: "Ouvrir le profil de {name}",
    someone: "Un utilisateur FitVen",
  },
  stats: {
    users: "L'utilisent",
    gymUsers: "Dans ta salle",
    noGym: "Pas de salle",
    noGymLabel: "Dans ta salle : tu n'as pas choisi de salle",
    typical: "Habituel",
    unknown: "pas encore connu",
  },
  steps: {
    title: "Comment le faire",
    step: "Étape {number} : {text}",
  },
  distribution: {
    title: "Ce que soulèvent les autres",
    typicalWeightReps: {
      one: "en général {weight} kg pour {reps} rép.",
      other: "en général {weight} kg pour {reps} rép.",
    },
    typicalWeight: "en général {weight} kg",
    typicalReps: { one: "en général {reps} rép.", other: "en général {reps} rép." },
    rangeUnder: "moins de {to} kg",
    rangeOver: "{from} kg ou plus",
    rangeBetween: "de {from} à {to} kg",
    summary: {
      one: "Ce que soulèvent les autres : le plus souvent {range}, d'après {sets} série enregistrée.",
      other: "Ce que soulèvent les autres : le plus souvent {range}, d'après {sets} séries enregistrées.",
    },
  },
  actions: {
    add: "Ajouter à mes exercices",
    adding: "Ajout…",
    added: "Ajouté",
    edit: "Modifier ton exercice",
    save: "Enregistrer",
    saved: "Enregistré",
  },
  nameTaken: "Tu as déjà un exercice nommé {name}, celui-ci ne peut donc pas être ajouté.",
  addFailed: "Impossible de l'ajouter. Réessaie.",
  saveFailed: "Ça n'a pas fonctionné. Réessaie.",
  footnote: "Le nom, le matériel et le groupe musculaire sont copiés dans tes exercices – pas les séries du créateur.",
  footnoteMine: "Quiconque l'ajoute reçoit le nom, le matériel et le groupe musculaire – jamais tes séries.",
  unavailable: {
    title: "Cet exercice n'est plus disponible",
    body: "Il a peut-être été supprimé, ou il n'est plus partagé.",
  },
  error: {
    title: "Impossible de charger l'exercice",
    body: "Un problème est survenu en chemin. Réessaie dans un instant.",
  },
  offline: {
    title: "Tu es hors ligne",
    body: "Connecte-toi à internet pour voir cet exercice.",
  },
  report: {
    title: "Signaler l'exercice",
    message:
      "Dis-nous ce qui ne va pas. Les signalements sont lus par le développeur, et le créateur n'est jamais informé de qui en a envoyé un.",
    reasons: {
      wrong: "Incorrect ou trompeur",
      offensive: "Choquant",
      duplicate: "Un doublon",
      other: "Autre chose",
    },
    notePlaceholder: "Autre chose à nous dire ? (facultatif)",
    send: "Envoyer le signalement",
    thanks: "Merci – nous allons y jeter un œil.",
    failed: "Impossible d'envoyer le signalement. Réessaie.",
  },
};
