// Le carrousel « Depuis Explorer » de l'accueil : une rangée de cartes d'Explorer - ta salle,
// les nouveaux exercices, les publications des salles, les plus forts du Danemark - et les accès
// pour quelqu'un qui n'a encore rien de tout ça. Le nom de la bibliothèque est
// explore.customExercises.title et « {n} utilisateurs » est customExercises.users.
export default {
  title: "Depuis Explorer",
  open: "Ouvrir",
  openA11y: "Ouvrir Explorer",
  loadingA11y: "Chargement des cartes d'Explorer",
  // Ce que dit un lecteur d'écran pour une carte : « Ta salle : 3 nouveaux records, Anna, il y a 2 h ».
  cardA11y: "{kicker} : {title}, {meta}",
  cardA11yShort: "{kicker} : {title}",
  // Un record : « Développé couché · 120 kg ».
  liftTitle: "{exercise} · {weight} kg",
  // La ligne au-dessus de chaque titre : quel genre de carte c'est.
  kickers: {
    gymRecords: "Ta salle",
    exercise: "Nouvel exercice",
    centrePost: "Publication",
    strongest: "Les plus forts du Danemark",
    findGym: "Salles",
    customExercises: "Exercices",
  },
  gymRecords: {
    newRecords: { one: "{value} nouveau record", other: "{value} nouveaux records" },
    seeRecords: "Voir les records de la salle",
  },
  findGym: {
    title: "Trouve ta salle",
    meta: "Records et publications là où tu t'entraînes",
  },
  customExercises: {
    meta: "Partage un des tiens",
  },
};
