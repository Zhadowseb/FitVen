// Pages de réglages : types de séance, publications, musique.
export default {
  eyebrow: "Réglages",

  workoutTypes: {
    title: "Types de séance",
    availableEyebrow: "DISPONIBLES",
    sectionTitle: "Types de séance",
    typesCount: "{count} TYPES",
    available: "Disponibles",
    types: {
      strength: {
        title: "Musculation",
        category: "FORCE",
        metrics: "SÉRIES  /  RÉPS  /  CHARGE",
      },
      run: {
        title: "Course",
        category: "CARDIO",
        metrics: "DISTANCE  /  ALLURE  /  TEMPS",
      },
    },
    exerciseCards: "Cartes d'exercice",
    exerciseCardsSubtitle: "Choisis la disposition et les détails des séries pour les exercices repliés",
    cardLayout: "Disposition de la carte",
    setSummary: "Résumé des séries",
    preview: "Aperçu",
    previewExercise: "Développé couché",
    views: {
      cells: "Standard",
      compact: "Compact",
      progressOnly: "Progression seule",
    },
    cardLayouts: {
      compact: "Disposition compacte",
      classic: "Disposition classique",
    },
    birthDate: "Date de naissance",
    birthDateWithAge: "{date}  /  {age} ans",
    setBirthDate: "Définir la date de naissance",
    birthDatePickerTitle: "Date de naissance pour la course",
    maxHeartRate: "Fréquence cardiaque max",
    maxHeartRateEmpty: "Définis ta date de naissance ou saisis la valeur à la main",
    bpm: "{value} bpm",
    howWorkedOut: "Comment c'est calculé",
    manualValue: "Valeur manuelle",
    clearManualValue: "Effacer la valeur manuelle",
    maxBpmPlaceholder: "bpm max",
    currentBpmPlaceholder: "Actuelle : {value} bpm",
    wholeNumberError: "Utilise un nombre entier de {min} à {max}.",
    saving: "Enregistrement…",
    sources: {
      auto: {
        title: "Auto",
        detail: "Manuelle, puis calculée, puis mesurée",
      },
      manual: {
        title: "Manuelle",
        missing: "Saisis et enregistre d'abord une valeur manuelle",
      },
      calculated: {
        title: "Calculée",
        missing: "Définis d'abord ta date de naissance",
        fromAge: "{value} bpm d'après l'âge",
      },
      measured: {
        title: "Mesurée",
        missing: "Aucune valeur mesurée disponible",
      },
    },
    errors: {
      signIn: "Connecte-toi pour gérer les réglages de course.",
      load: "Impossible de charger les réglages de course.",
      saveBirthDate: "Impossible d'enregistrer la date de naissance.",
      saveMaxHeartRate: "Impossible d'enregistrer la fréquence cardiaque max.",
      saveSource: "Impossible d'enregistrer la source de la fréquence cardiaque max.",
    },
  },

  socialPosts: {
    title: "Publications",
    scopeNote: "S'applique à toutes les séances",
    summariesTitle: "Résumés de séance",
    summariesBody: "Comportement de publication actuel pour les séances terminées.",
    modes: {
      fullInfo: "Infos complètes",
      summaryOnly: "Résumé seul",
      off: "Désactivé",
    },
    nothingPosted: "Rien n'est publié.",
    preview: {
      duration: "48 min",
      benchPress: "Développé couché",
      barbellRow: "Rowing barre",
    },
    visibilityEyebrow: "Visibilité",
    visibility: {
      everyone: "Tout le monde",
      following: "Les personnes que je suis",
      private: "Moi seul",
    },
    visibilityNote:
      "Décide qui peut voir les publications de résumé de ta séance. Moi seul les garde hors de tous les autres fils.",
    exercisesEyebrow: "Exercices",
    walksEyebrow: "Marches",
    shareWalkRoute: "Partager l'itinéraire d'une marche",
    shareWalkRouteNote: "La valeur par défaut du bouton Partager l'itinéraire quand tu publies une marche. Le début et la fin de l'itinéraire sont toujours omis, et l'itinéraire exact ne quitte jamais ton téléphone.",
    exerciseVisibility: "Visibilité des exercices",
    exerciseVisibilityBody: "Choisis quels exercices peuvent apparaître dans les meilleures séries et les badges de record.",
    errors: {
      load: "Impossible de charger les réglages de publication.",
      save: "Impossible d'enregistrer les réglages de publication.",
      saveVisibility: "Impossible d'enregistrer la visibilité des publications.",
    },
  },

  oneRepMax: {
    eyebrow: "Entraînement",
    title: "Calculateur de 1RM",
    weight: "Charge",
    reps: "Rép.",
    weightPlaceholder: "ex. 100",
    repsPlaceholder: "ex. 5",
    repsSuffix: "rép.",
    resultLabel: "1RM ESTIMÉ",
    roundedNote: "Arrondi au 0,5 kg le plus proche.",
    calculate: "Calculer le 1RM estimé",
    loadsEyebrow: "CHARGES D'ENTRAÎNEMENT",
    loadsTitle: "Pourcentage du 1RM estimé",
    aboutTitle: "À propos de l'estimation",
    aboutBody:
      "Le résultat utilise la même formule de Brzycki que tes records perso automatiques, et la même plage de 1 à {max} répétitions sur laquelle ces records sont suivis. Au-delà, la formule s'éloigne beaucoup de ce que quelqu'un soulève réellement. La fatigue, la technique et le choix de l'exercice modifient aussi le résultat : considère-le donc comme une estimation.",
    reset: "Réinitialiser le calculateur",
    errors: {
      weight: "Saisis une charge supérieure à 0.",
      reps: "Saisis un nombre entier entre 1 et {max}.",
    },
  },
};
