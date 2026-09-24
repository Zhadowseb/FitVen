// Rekorder-siden: overblikket og én øvelses detaljer. Holdes i trit med
// ../en/records.js.
export default {
  eyebrow: "Bibliotek",
  title: "Rekorder",
  periods: {
    "4w": "4 uger",
    "3m": "3 mdr",
    "1y": "1 år",
    all: "Alt",
  },
  kpi: {
    workouts: "Træninger",
    records: "Rekorder",
    volume: "Volumen",
    tonnes: "t",
    same: "samme",
  },
  strength: {
    up: "Du er blevet stærkere",
    flat: "Du holder niveauet",
    down: "Lidt tilbage",
    detail: {
      one: "{improving} af {count} øvelse går frem · estimeret 1RM",
      other: "{improving} af {count} øvelser går frem · estimeret 1RM",
    },
    empty: "Træn en øvelse et par gange, så kan du se din udvikling her.",
  },
  gains: {
    title: "Største fremskridt",
    new: "ny",
    showAll: "Vis alle {count}",
    showFewer: "Vis færre",
    empty: "Intet at måle endnu i perioden.",
    open: "Åbn {name}",
  },
  volume: {
    weekTitle: "Volumen pr. uge",
    monthTitle: "Volumen pr. måned",
    weekAverage: "Den stiplede linje er gennemsnittet over 4 uger",
    monthAverage: "Den stiplede linje er gennemsnittet over 3 måneder",
  },
  latest: {
    title: "Seneste rekorder",
  },
  exercises: {
    title: "Alle øvelser",
    heaviest: "Tungeste: {lift}",
    showAll: "Vis alle {count}",
    showFewer: "Vis færre",
    up: "Går frem",
    down: "Går tilbage",
    flat: "Holder niveauet",
  },
  muscles: {
    title: "Sæt pr. muskelgruppe",
    summary: {
      one: "{group} får mindst · {count} sæt i perioden",
      other: "{group} får mindst · {count} sæt i perioden",
    },
  },
  empty: {
    title: "Ingen rekorder endnu",
    body: "Afslut en styrketræning, så dukker din udvikling op her.",
  },
  exercise: {
    back: "Tilbage til Rekorder",
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
