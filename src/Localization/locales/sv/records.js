// The Records page - the trophy room - and one exercise's page.
export default {
  eyebrow: "Bibliotek",
  title: "Rekord",
  // The trophy room: the whole history, nothing to compare it with.
  trophy: {
    recordCount: { one: "rekord satt", other: "rekord satta" },
    heaviest: "Tyngsta lyft",
    heaviestValue: "{weight} kg × {reps} · {name}",
    heaviestValuePerSide: "{weight} kg per sida × {reps} · {name}",
    since: "Sedan {date}",
    emptyTitle: "Ditt första rekord väntar",
    emptyBody: "Avsluta ett styrkepass så börjar din samling här.",
    podium: {
      title: "Dina starkaste lyft",
      meta: "× {reps} · {date}",
      label: "Plats {rank}: {name}, {weight} kg × {reps}",
      labelPerSide: "Plats {rank}: {name}, {weight} kg per sida × {reps}",
      nextGoal: "Nästa mål: {goal} kg i {name}",
      toGo: "{value} kg kvar",
    },
    recent: {
      title: "Nya rekord",
      new: "Ny",
      label: "{name}, {weight} kg × {reps}, {when}",
      labelPerSide: "{name}, {weight} kg per sida × {reps}, {when}",
    },
    milestones: {
      title: "Milstolpar",
      workouts: { one: "{value} pass", other: "{value} pass" },
      tonnes: { one: "{value} ton lyft", other: "{value} ton lyft" },
      records: { one: "{value} rekord", other: "{value} rekord" },
      weekStreak: { one: "{value} vecka i rad", other: "{value} veckor i rad" },
      nextUp: "Nästa: {label}",
      notYet: "Inte än",
      maxed: "Högsta nivån",
    },
    statistics: {
      title: "Se din statistik",
      body: "Volym, frekvens, intensitet och löpning",
    },
  },
  exercise: {
    overline: "Rekord",
    estimate: "Beräknad 1RM",
    changeInPeriod: "{change} % under perioden",
    gapDays: "{count} dagar",
    nextStep: "Nästa steg vid {reps} reps",
    repsShort: "{reps} REPS",
    noSets: "Inga set med vikt under den här perioden.",
    bestSet: "Bästa set {when} · {lift}",
    tryNext: "prova {target} · du gjorde {current}",
    repLadder: "Rekord per antal reps",
    noSet: "inget set",
    // Under a slot a longer set fills: 90 kg × 3 is 90 kg for 1 and 2 reps too.
    // Never a new record.
    fromReps: "från {reps} reps",
    latestSets: "Senaste seten",
    pr: "PR",
    periods: {
      "1m": "1M",
      "3m": "3M",
      "6m": "6M",
      "1y": "1Å",
      all: "Alla",
    },
  },
};
