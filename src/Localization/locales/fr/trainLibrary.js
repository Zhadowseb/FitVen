// Les tuiles de la bibliothèque de l'onglet Entraînement, Ta forme et les outils.
export default {
  // Les quatre tuiles de la grille.
  workouts: "Séances",
  records: "Records",
  exercises: "Exercices",
  programs: "Programmes",
  // À côté du nombre de programmes ; omis quand aucun n'est actif.
  activePrograms: { one: "{count} actif", other: "{count} actifs" },

  // « Ta forme ». Le nombre de la régularité est dessiné à part, plus grand, donc les mots
  // à côté n'ont pas de nombre.
  form: {
    weeksInRow: { one: "semaine d'affilée", other: "semaines d'affilée" },
    threshold: {
      one: "avec au moins {count} séance",
      other: "avec au moins {count} séances",
    },
    perWeek: "par semaine",
  },

  tools: {
    oneRepMax: "Calculateur de 1RM",
    sickDays: "Jours de maladie",
    thisYear: "cette année",
    // L'outil 1RM sans série à partir de laquelle estimer.
    noLifts: { one: "Aucune charge depuis {count} jour", other: "Aucune charge depuis {count} jours" },
  },

  // Ce que dit un lecteur d'écran pour chaque tuile.
  a11y: {
    workouts: "Séances : {total} au total, {week} cette semaine",
    records: "Records : {total} au total, {week} cette semaine",
    exercises: "Exercices : {count} dans le catalogue",
    programs: "Programmes : {count} au total, {active}",
    form: "Ta forme : {streak} {weeks}, {threshold}, {average} par semaine",
    oneRepMax: "Calculateur de 1RM : {value} kg estimés à partir de {exercise}, {weight} kg pour {reps}",
    oneRepMaxEmpty: "Calculateur de 1RM : {detail}",
    sickDays: "Jours de maladie : {count} cette année",
  },
};
