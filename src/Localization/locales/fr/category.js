// Les quatre catégories de classement des salles et les mots que partagent tous les écrans à ce sujet : noms, filtres, unités.
export default {
  names: {
    flid: "Régularité",
    powerlifting: "Powerlifting",
    fremgang: "Progression",
    calisthenics: "Calisthenics",
  },
  descriptions: {
    flid: "Le plus de séances · {period}",
    powerlifting: "Développé couché + squat + soulevé de terre · charge la plus lourde",
    fremgang: "Plus forte hausse sur les 30 derniers jours",
    calisthenics: "Tractions × 3 + dips × 2 + pompes",
  },
  gender: {
    all: "Tous",
    men: "Hommes",
    women: "Femmes",
  },
  ageGroups: {
    all: "Tous les âges",
    u23: "Moins de 23 ans",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Semaine",
    month: "Mois",
    year: "Année",
  },
  flidTabs: {
    workouts: "Séances",
    streak: "Semaines d'affilée",
  },
  units: {
    workouts: { one: "séance", other: "séances" },
    weeks: { one: "semaine", other: "semaines" },
    kg: "kg",
    percent: "%",
    points: { one: "point", other: "points" },
  },
  weightClasses: {
    all: "Tous les poids",
  },
  notIn: "pas {where}",
  notInFilter: "Tu n'es pas dans la catégorie {filter}. Choisis Tous pour voir ton rang.",
  countries: {
    DK: "Danemark",
  },
  // « au Danemark » - pour « pas {where} » et « Chercher une salle {where} ».
  countriesWhere: {
    DK: "au Danemark",
  },

  // La page de la catégorie (5a-5d). Les nombres dans les règles ({count}, {days},
  // {sets}, {reps}, {activeDays} et les facteurs) viennent de
  // Utils/gymCategories.js.
  page: {
    allCountries: "Tous les pays",
    gymFallback: "La salle",
    friends: "Amis",
  },
  // Sous le titre : comment la catégorie est calculée.
  explanations: {
    flidWorkouts: "Chaque séance terminée de la période, quel qu'en soit le type.",
    flidStreak:
      "Semaines d'affilée avec au moins {count} séances terminées, du lundi au dimanche. La semaine en cours compte dès qu'elle atteint {count}. Une semaine de maladie interrompt l'enchaînement.",
    powerlifting:
      "La charge la plus lourde que tu aies soulevée au développé couché, au squat et au soulevé de terre, additionnées. Une série compte pour chaque nombre de répétitions inférieur : 90 kg × 3, c'est aussi 90 kg pour 1. Un mouvement manquant compte pour 0.",
    fremgang:
      "Plus forte hausse du 1RM estimé sur les {days} derniers jours par rapport aux {days} précédents, à partir de séries de 1 à {reps} répétitions. Au moins {sets} séries dans les deux périodes.",
    calisthenics:
      "Le plus de répétitions en une série sans charge ajoutée, multiplié par la difficulté : tractions × {pullups}, dips × {dips}, pompes × {pushups}. Le tout additionné.",
  },
  empty: {
    title: "Personne dans le classement pour l'instant",
    friendsTitle: "Aucune personne que tu suis n'est encore dans le classement",
    members: "Toutes les personnes qui se sont entraînées dans une salle d'ici au cours des {activeDays} derniers jours participent.",
    membersGym: "Toutes les personnes qui se sont entraînées ici au cours des {activeDays} derniers jours participent.",
    flidWorkouts: "Chaque séance terminée de la période compte.",
    flidStreak: "Une semaine compte dès qu'elle a au moins {count} séances terminées.",
    powerlifting: "Une seule série de développé couché, de squat ou de soulevé de terre te donne un total.",
    fremgang: "Il faut au moins {sets} séries du même exercice dans chacune des deux périodes de {days} jours.",
    calisthenics: "Une série de tractions, de dips ou de pompes sans charge ajoutée rapporte des points.",
  },
  errors: {
    title: "Impossible de charger le classement",
    body: "Vérifie ta connexion et réessaie.",
    refreshFailed: "Le classement n'a pas pu être mis à jour.",
  },
  unavailable: {
    title: "Pas encore disponible",
    body: "Les classements par catégorie ne sont pas encore activés. Reviens plus tard.",
  },
  // Ta propre ligne, en bas.
  me: {
    gap: "{gap} pour la #{rank}",
    tied: "À égalité avec la #{rank}",
    leading: "Tu es en tête",
    homeGymRank: "#{rank} dans ta salle",
    notOnListTitle: "Tu n'es pas dans ce classement",
    noValueTitle: "Tu n'es pas encore dans le classement",
    notOnListBody: "Il compte les personnes qui se sont entraînées dans une salle d'ici au cours des {activeDays} derniers jours.",
    notOnListBodyGym: "Il compte les personnes qui se sont entraînées ici au cours des {activeDays} derniers jours.",
  },
  // La ligne sous un nom : dans le classement, et sous la #1 sur la carte d'une salle.
  rows: {
    streak: { one: "{count} semaine d'affilée", other: "{count} semaines d'affilée" },
    last: "dernière séance {when}",
    powerlifting: "DC {bench} · S {squat} · SDT {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Tract. {pullups} · Dips {dips} · Pompes {pushups}",
  },
  // « Ta progression » et « Tes points ».
  personal: {
    progress: "Ta progression",
    progressEmpty:
      "Fais au moins {sets} séries du même exercice au cours des {days} derniers jours et des {days} jours précédents, et ta progression s'affichera ici.",
    points: "Tes points",
    pullups: "Tract.",
    dips: "Dips",
    pushups: "Pompes",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Période",
    age: "Âge",
    ageHint: "D'après l'année de naissance de ton profil. Sans elle, tu n'es que dans Tous les âges.",
    weightClass: "Catégorie de poids",
    weightClassStatic: "Le poids de corps ne peut pas encore être renseigné : tout le monde est dans Tous les poids.",
  },
  // Les trois boutons du powerlifting en bas - et le mouvement dans lequel une hausse de Progression a eu lieu.
  lifts: {
    title: "Chaque mouvement séparément",
    bench: "Développé couché",
    squat: "Squat",
    deadlift: "Soulevé de terre",
    gymHint: "Ouvre le classement de la salle pour ce mouvement",
    nationalHint: "Ouvre le classement national pour ce mouvement",
  },
};
