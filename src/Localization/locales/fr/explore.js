// L'onglet Explorer : la page d'accueil, sa recherche et les accès.
export default {
  title: "Explorer",
  searchPlaceholder: "Chercher des salles et des personnes",
  tiles: {
    gyms: "Salles",
    gymsSub: "Trouve ta salle",
    gymsCount: { one: "{value} au Danemark", other: "{value} au Danemark" },
    programs: "Programmes",
    programsCount: { one: "{value} au choix", other: "{value} au choix" },
    exercises: "Exercices",
    exercisesCount: { one: "{value} d'utilisateurs", other: "{value} d'utilisateurs" },
    // Tant que le nombre est inconnu, et tant que rien n'a été partagé.
    exercisesSub: "Créés par des utilisateurs",
    exercisesFirst: "Partage le premier",
    records: "Records",
    recordsSub: "Top 100 du Danemark",
  },
  programs: {
    title: "Programmes",
    emptyTitle: "Pas encore de programme au choix",
    emptyBody: "Des programmes sélectionnés à la main seront là, à suivre tels quels.",
  },
  customExercises: {
    title: "Exercices créés par les utilisateurs",
    emptyTitle: "Pas encore d'exercice partagé",
    emptyBody: "Quand des gens partageront les exercices qu'ils ont créés, tu pourras les trouver ici et les ajouter aux tiens.",
  },
  sections: {
    yourGym: "Ta salle",
    change: "Changer",
    customExercises: "Nouveaux exercices des autres",
    all: "Tous",
    allCount: { one: "Ouvrir la bibliothèque", other: "Voir les {value}" },
    allExercisesA11y: {
      one: "Ouvrir la bibliothèque de {value} exercice",
      other: "Voir les {value} exercices",
    },
    centerPosts: "Publications des salles",
  },
  centerPostLabel: "{name} : {title}, à {gym}",
  centerPosts: {
    eyebrow: "Publications de",
    fallbackTitle: "Une salle",
    emptyTitle: "Pas encore de publication de cette salle",
    emptyBody: "Quand des personnes que tu peux voir publient une séance faite ici, elle apparaît ici.",
    failed: "Impossible de charger les publications. Réessaie dans un instant.",
  },
  yourGym: {
    newRecords: { one: "{value} nouveau record", other: "{value} nouveaux records" },
    noNewRecords: "Aucun nouveau record depuis ta dernière visite",
    latestLabel: "Dernier record : {name}, {exercise}, {weight} kg",
    pick: "Choisis ta salle",
    pickDetail: "Vois ses records et qui s'y entraîne",
  },
  search: {
    hint: {
      all: "Tape au moins deux lettres pour chercher des salles et des personnes.",
      gyms: "Tape au moins deux lettres pour chercher des salles.",
      people: "Tape au moins deux lettres pour chercher des personnes.",
    },
    placeholder: {
      all: "Chercher des salles et des personnes",
      gyms: "Chercher des salles",
      people: "Chercher des personnes",
    },
    scope: {
      all: "Les deux",
      gyms: "Salles",
      people: "Personnes",
    },
    failed: "La recherche n'a pas abouti. Réessaie dans un instant.",
    nothing: "Rien trouvé pour « {query} ».",
    clear: "Effacer la recherche",
    gyms: "Salles",
    people: "Personnes",
    following: "Tu suis",
    allPeople: "Voir tout le monde et suivre",
    // Salles choisies, rien de saisi : ta salle, celles où tu t'es entraîné,
    // et les plus fréquentées de la région de ta salle ({where} apporte
    // sa préposition).
    suggestions: {
      yours: "Ta salle",
      trainedIn: "Où tu as déjà fait une séance",
      workouts: { one: "{count} séance", other: "{count} séances" },
      busiestIn: "Les plus fréquentées {where}",
      busiest: "Salles les plus fréquentées",
    },
  },
};
