// La page Records - la salle des trophées - et la page d'un exercice.
export default {
  eyebrow: "Bibliothèque",
  title: "Records",
  // La salle des trophées : tout l'historique, rien à comparer.
  trophy: {
    recordCount: { one: "record battu", other: "records battus" },
    heaviest: "Charge la plus lourde",
    heaviestValue: "{weight} kg × {reps} · {name}",
    heaviestValuePerSide: "{weight} kg par côté × {reps} · {name}",
    since: "Depuis le {date}",
    emptyTitle: "Ton premier record t'attend",
    emptyBody: "Termine une séance de force et ta collection commence ici.",
    podium: {
      title: "Tes plus grosses charges",
      meta: "× {reps} · {date}",
      label: "Place {rank} : {name}, {weight} kg × {reps}",
      labelPerSide: "Place {rank} : {name}, {weight} kg par côté × {reps}",
      nextGoal: "Prochain objectif : {goal} kg en {name}",
      toGo: "encore {value} kg",
    },
    recent: {
      title: "Nouveaux records",
      new: "Nouveau",
      label: "{name}, {weight} kg × {reps}, {when}",
      labelPerSide: "{name}, {weight} kg par côté × {reps}, {when}",
    },
    milestones: {
      title: "Jalons",
      workouts: { one: "{value} séance", other: "{value} séances" },
      tonnes: { one: "{value} tonne soulevée", other: "{value} tonnes soulevées" },
      records: { one: "{value} record", other: "{value} records" },
      weekStreak: { one: "{value} semaine d'affilée", other: "{value} semaines d'affilée" },
      nextUp: "Prochain : {label}",
      notYet: "Pas encore",
      maxed: "Tout en haut de l'échelle",
    },
    statistics: {
      title: "Voir tes statistiques",
      body: "Volume, fréquence, intensité et courses",
    },
  },
  exercise: {
    overline: "Records",
    estimate: "1RM estimé",
    changeInPeriod: "{change} % sur la période",
    gapDays: "{count} jours",
    nextStep: "Prochain palier à {reps} rép.",
    repsShort: "{reps} RÉPS",
    noSets: "Aucune série avec une charge sur cette période.",
    bestSet: "Meilleure série {when} · {lift}",
    tryNext: "essaie {target} · tu as fait {current}",
    repLadder: "Record par nombre de rép.",
    noSet: "aucune série",
    // Sous un emplacement qu'une série plus longue remplit : 90 kg × 3, c'est aussi 90 kg pour 1 et 2 rép.
    // Jamais un nouveau record.
    fromReps: "à partir de {reps} rép.",
    latestSets: "Dernières séries",
    pr: "PR",
    periods: {
      "1m": "1M",
      "3m": "3M",
      "6m": "6M",
      "1y": "1A",
      all: "Tout",
    },
  },
};
