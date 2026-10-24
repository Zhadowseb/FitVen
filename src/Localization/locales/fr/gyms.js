// Les salles : les écrans Salles (tous les pays, un pays, une région), la page d'une
// salle, le classement d'un exercice (dans une salle et dans tout le Danemark), la
// feuille Changer de salle et les erreurs du service de salles visibles par l'utilisateur.
export default {
  // Mots partagés par plusieurs de ces écrans.
  centre: "Salle",
  yourCentre: "ta salle",
  weightKg: "{weight} kg",
  noLiftsYet: "Pas encore de charges",
  searchFailed: "Échec de la recherche.",
  searchCentresA11y: "Rechercher des salles",

  // Les écrans Salles : tous les pays, un pays, une région.
  global: "Monde",
  title: "Salles",
  chooseCountry: "Choisir un pays",
  search: "Chercher une salle",
  // {where} apporte sa préposition : « en Seeland ».
  searchIn: "Chercher une salle {where}",
  myGym: "Ta salle",
  members: {
    one: "{count} personne s'entraîne ici · tu en suis {following}",
    other: "{count} personnes s'entraînent ici · tu en suis {following}",
  },
  allCountries: "Tous les pays",
  fromLocation: "d'après ta position",
  countriesWithLifts: "Pays avec des charges",
  onlyWithLifts: "Seuls les pays avec des charges enregistrées sont affichés.",
  regionsIn: "Régions {where}",
  gymsIn: "Salles {where}",
  categories: "Catégories",
  sortedByActivity: "les plus actives d'abord",
  // Une salle comme lieu, pour « pas à {gym} ».
  atGym: "à {gym}",
  // Un lieu sans formule propre.
  inPlace: "à {place}",
  // Les quatre régions du Danemark avec leurs prépositions, pour quand le serveur
  // envoie une région sans. Les clés sont gym.region_key.
  regionsWhere: {
    sjaelland: "en Seeland",
    jylland: "au Jutland",
    fyn: "à Fionie",
    bornholm: "à Bornholm",
  },

  counts: {
    centres: { one: "{value} salle", other: "{value} salles" },
    lifters: { one: "{value} athlète", other: "{value} athlètes" },
  },

  // Tous les pays : le pays où tu te trouves, au-dessus de la liste.
  location: {
    title: "Ta position",
    noLifts: "Pas encore de charges enregistrées ici",
  },

  // Ce que dit un niveau quand il ne peut pas s'afficher.
  levels: {
    loadFailed: "Impossible de charger les salles.",
    unavailableTitle: "Salles indisponibles",
    notYetTitle: "Bientôt là",
    notYetBody:
      "Les catégories et les régions ne sont pas encore prêtes. Tu peux quand même chercher une salle et ouvrir la tienne.",
    cardsNotYet: "Les catégories ne sont pas encore prêtes.",
    cardsFailed: "Impossible de charger les catégories.",
    noCountries: "Aucun pays n'a encore de charges enregistrées.",
    noRegions: "Les salles d'ici ne sont pas encore réparties en régions.",
    noGyms: "Pas encore de salle {where}.",
  },

  // Résultats de recherche, à la place du niveau.
  results: {
    title: "Résultats",
    count: "Résultats : {count}",
    noMatchTitle: "Aucune salle ne correspond",
    noMatchBody: "Essaie la chaîne, la ville ou une partie du nom de la salle.",
  },

  // Une catégorie sur une carte : sur un niveau et dans une salle.
  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    // {where} apporte sa préposition : « #4 en Seeland ».
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} sur {total}",
    notRanked: "pas encore classé",
    empty: "Personne n'est encore dans le classement.",
    a11yTop: "Numéro 1 : {name}, {value}",
    a11yHint: "Ouvre tout le classement",
  },

  scope: {
    centre: "Salle",
    friends: "Amis",
    centreWithCount: "Salle · {count}",
    friendsWithCount: "Amis · {count}",
  },

  unit: {
    bodyweight: "×PDC",
  },

  // Une ligne d'un classement.
  row: {
    yourCentre: "· ta salle",
  },

  // Une salle : bandeau, son lieu, les quatre catégories, chaque exercice.
  overview: {
    notFound: "Cette salle est introuvable.",
    loadFailed: "Impossible de charger la salle.",
    unavailableTitle: "Salle indisponible",
    changeCentre: "Changer de salle",
    yourCentre: "Ta salle",
    membersTrainHere: { one: "{count} personne s'entraîne ici", other: "{count} personnes s'entraînent ici" },
    youFollow: "tu en suis {count}",
    allExercises: "Tous les exercices",
  },

  // Les exercices de la salle sur sa page : la recherche, la section et « Tous les exercices ».
  centreExercises: {
    title: "Exercices",
    sortedByLifters: "les plus pratiqués d'abord",
    searchPlaceholder: "Chercher parmi les exercices de cette salle",
    clearSearch: "Effacer la recherche",
    resultsTitle: "Exercices ici",
    noMatchTitle: "Aucun exercice ne correspond",
    noMatchBody: "Ce sont les exercices faits dans cette salle. Essaie une partie du nom.",
    searchLoading: "Chargement de tous les exercices de cette salle…",
    searchFailedTitle: "Impossible de charger tous les exercices",
    searchFailedBody: "Pour l'instant, la recherche ne couvre que les plus soulevés.",
    topLine: "#1 {name} {weight} kg",
    yourRank: "#{rank}",
    yourRankA11y: "tu es numéro {rank}",
    openHint: "Ouvre le classement de l'exercice dans cette salle",
    emptyBody: "Termine une séance ici et tes charges apparaissent dans les classements.",
    allDetail: { one: "{count} exercice classé ici", other: "{count} exercices classés ici" },
    allHint: "Ouvre les classements, avec un bouton par exercice",
  },

  // La feuille Changer de salle.
  change: {
    body: "Ta salle est celle où tu t'es le plus entraîné ces 90 derniers jours, sauf si tu en choisis une ici.",
    searchPlaceholder: "Chercher parmi toutes les salles",
    loadFailed: "Impossible de charger tes salles.",
    saveFailed: "Impossible de changer ta salle.",
    resultCount: { one: "{count} résultat", other: "{count} résultats" },
    automatic: "Automatique",
    automaticMeta: "Là où tu t'entraînes le plus",
    trainedHere: "Où tu as déjà fait une séance",
    emptyBody: "Termine une séance dans une salle et elle apparaît ici. Ou cherche ci-dessus.",
    gymMeta: { one: "{chain} · {count} séance", other: "{chain} · {count} séances" },
  },

  // Un exercice classé, dans une salle ou dans tout le Danemark.
  exercise: {
    titleFallback: "Exercice",
    nationalEyebrow: "Toutes les salles · Danemark",
    unavailableTitle: "Classement indisponible",
    loadFailed: "Impossible de charger le classement.",
    loadMoreFailed: "Impossible d'en charger plus.",
    pickExercise: "Choisis un exercice.",
    empty: {
      noBodyweightTitle: "Aucun poids de corps enregistré",
      noBodyweightBody:
        "Le classement par poids de corps nécessite un poids de corps sur la charge, ce que personne ici n'a enregistré.",
      noFriendsTitle: "Aucun de tes amis ne s'entraîne encore ici",
      noLiftsBody: "Termine une séance avec cet exercice dans la salle et la première charge est à toi.",
    },
  },

  // Erreurs levées par le service de salles ; les écrans affichent error.message tel quel.
  errors: {
    generic: "Un problème est survenu avec les salles.",
    signInToChoose: "Tu dois être connecté pour choisir une salle.",
  },
};
