// Le bloc calendrier de l'onglet Entraînement : la semaine dernière et cette semaine.
//
// Le reste du bloc réutilise les textes du calendrier lui-même : calendar.title,
// calendar.workoutsHeading et home.weekdays pour la ligne des jours.
export default {
  // La ligne sous « Calendrier ». Avec un programme actif, la semaine est comptée
  // par rapport à ce qui est prévu ; sans programme, seulement ce qui a été fait.
  subtitle: {
    program: {
      zero: "Rien de prévu cette semaine",
      one: "{done} sur {count} séance cette semaine",
      other: "{done} sur {count} séances cette semaine",
    },
    split: {
      one: "{count} séance cette semaine",
      other: "{count} séances cette semaine",
    },
  },
};
