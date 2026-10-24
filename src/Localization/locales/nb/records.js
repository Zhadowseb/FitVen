// Rekordsiden - trofé-rommet - og siden til én øvelse.
export default {
  eyebrow: "Bibliotek",
  title: "Rekorder",
  // Trofé-rommet: hele historikken, ingenting å sammenligne den med.
  trophy: {
    recordCount: { one: "rekord satt", other: "rekorder satt" },
    heaviest: "Tyngste løft",
    heaviestValue: "{weight} kg × {reps} · {name}",
    heaviestValuePerSide: "{weight} kg per side × {reps} · {name}",
    since: "Siden {date}",
    emptyTitle: "Din første rekord venter",
    emptyBody: "Fullfør en styrkeøkt, så starter samlingen din her.",
    podium: {
      title: "Dine sterkeste løft",
      meta: "× {reps} · {date}",
      label: "Plass {rank}: {name}, {weight} kg × {reps}",
      labelPerSide: "Plass {rank}: {name}, {weight} kg per side × {reps}",
      nextGoal: "Neste mål: {goal} kg i {name}",
      toGo: "{value} kg igjen",
    },
    recent: {
      title: "Nye rekorder",
      new: "Ny",
      label: "{name}, {weight} kg × {reps}, {when}",
      labelPerSide: "{name}, {weight} kg per side × {reps}, {when}",
    },
    milestones: {
      title: "Milepæler",
      workouts: { one: "{value} økt", other: "{value} økter" },
      tonnes: { one: "{value} tonn løftet", other: "{value} tonn løftet" },
      records: { one: "{value} rekord", other: "{value} rekorder" },
      weekStreak: { one: "{value} uke på rad", other: "{value} uker på rad" },
      nextUp: "Neste: {label}",
      notYet: "Ikke ennå",
      maxed: "Øverst på stigen",
    },
    statistics: {
      title: "Se statistikken din",
      body: "Volum, frekvens, intensitet og løpeturer",
    },
  },
  exercise: {
    overline: "Rekorder",
    estimate: "Estimert 1RM",
    changeInPeriod: "{change} % i perioden",
    gapDays: "{count} dager",
    nextStep: "Neste steg ved {reps} reps",
    repsShort: "{reps} REPS",
    noSets: "Ingen sett med vekt i denne perioden.",
    bestSet: "Beste sett {when} · {lift}",
    tryNext: "prøv {target} · du tok {current}",
    repLadder: "Rekord per reps",
    noSet: "ingen sett",
    // Under en plass et lengre sett fyller: 90 kg × 3 er også 90 kg for 1 og 2 reps.
    // Aldri en ny rekord.
    fromReps: "fra {reps} reps",
    latestSets: "Siste sett",
    pr: "PR",
    periods: {
      "1m": "1 mnd.",
      "3m": "3 mnd.",
      "6m": "6 mnd.",
      "1y": "1 år",
      all: "Alt",
    },
  },
};
