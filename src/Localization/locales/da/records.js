// Rekorder-siden - pokalrummet - og én øvelses side. Holdes i trit med
// ../en/records.js.
export default {
  eyebrow: "Bibliotek",
  title: "Rekorder",
  // Pokalrummet: hele historikken, intet at sammenligne med.
  trophy: {
    recordCount: { one: "rekord sat", other: "rekorder sat" },
    heaviest: "Tungeste løft",
    heaviestValue: "{weight} kg × {reps} · {name}",
    since: "Siden {date}",
    emptyTitle: "Din første rekord venter",
    emptyBody: "Afslut en styrketræning, så begynder din samling her.",
    podium: {
      title: "Dine stærkeste løft",
      meta: "× {reps} · {date}",
      label: "Nummer {rank}: {name}, {weight} kg × {reps}",
      nextGoal: "Næste mål: {goal} kg i {name}",
      toGo: "{value} kg tilbage",
    },
    recent: {
      title: "Nye rekorder",
      new: "Ny",
      label: "{name}, {weight} kg × {reps}, {when}",
    },
    milestones: {
      title: "Milepæle",
      workouts: { one: "{value} træning", other: "{value} træninger" },
      tonnes: { one: "{value} ton løftet", other: "{value} ton løftet" },
      records: { one: "{value} rekord", other: "{value} rekorder" },
      weekStreak: { one: "{value} uge i træk", other: "{value} uger i træk" },
      nextUp: "Næste: {label}",
      notYet: "Ikke endnu",
      maxed: "Øverste trin nået",
    },
    statistics: {
      title: "Se din statistik",
      body: "Volumen, frekvens, intensitet og løb",
    },
  },
  exercise: {
    overline: "Rekorder",
    estimate: "Estimeret 1RM",
    changeInPeriod: "{change} % i perioden",
    gapDays: "{count} dage",
    nextStep: "Næste skridt ved {reps} reps",
    repsShort: "{reps} REPS",
    noSets: "Ingen sæt med vægt i perioden.",
    bestSet: "Bedste sæt {when} · {lift}",
    tryNext: "prøv {target} · du løftede {current}",
    repLadder: "Rekord pr. reps",
    noSet: "intet sæt",
    latestSets: "Seneste sæt",
    pr: "PR",
    periods: {
      "1m": "1M",
      "3m": "3M",
      "6m": "6M",
      "1y": "1Å",
      all: "Alt",
    },
  },
};
