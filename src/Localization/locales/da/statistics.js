// Statistiksiden og dens fordybelser: perioden, tallene, volumen,
// muskelgrupper, intensitet, frekvens, sættyper og løb. Holdes i trit med
// ../en/statistics.js.
export default {
  eyebrow: "Bibliotek",
  title: "Statistik",

  // Overblikket øverst på siden. Det kom fra Rekorder, og det gjorde
  // teksterne også.
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

  // "Gå i dybden" og de fem fordybelser. En fordybelses `title` står på dens
  // række på siden og øverst på dens egen skærm; `teaser` er rækkens tal.
  deeper: {
    title: "Gå i dybden",
  },
  detail: {
    tryLonger: "Prøv en længere periode.",
  },
  units: {
    km: "km",
    percent: "{value} %",
    pace: "{pace} /km",
    perKm: "/km",
    reps: "reps",
    hours: "{hours} t",
    duration: "{hours} t {minutes} min",
    minutes: "{minutes} min",
  },
  intensity: {
    title: "Intensitet",
    teaser: "{value} % af 1RM i snit",
    average: "Gennemsnitlig intensitet",
    caption: "Hvert sæts vægt målt mod din bedste estimerede 1RM i øvelsen op til den dag.",
    sets: "Arbejdssæt",
    heavy: "Tunge sæt",
    heavyNote: "85 % af 1RM eller mere",
    zonesTitle: "Sæt fordelt på intensitet",
    zones: {
      below60: "Under 60 %",
      from60: "60–70 %",
      from70: "70–80 %",
      from80: "80–90 %",
      from90: "Mindst 90 %",
    },
    rpe: {
      title: "RPE",
      average: "Gennemsnitlig RPE",
      bands: {
        upTo7: "7 eller under",
        rpe8: "8",
        rpe9: "9",
        rpe10: "10",
      },
      basis: {
        one: "Ud fra {count} sæt med RPE",
        other: "Ud fra {count} sæt med RPE",
      },
    },
    empty: "Ingen arbejdssæt i perioden.",
  },
  frequency: {
    title: "Frekvens og stabilitet",
    teaser: {
      one: "{value} træning pr. uge",
      other: "{value} træninger pr. uge",
    },
    perWeek: "Pr. uge",
    workouts: "Træninger",
    streak: "Uger i træk",
    streakThisWeek: "Til og med denne uge",
    streakLastWeek: "Til og med sidste uge",
    streakNone: "Træn i denne uge for at komme i gang igen",
    longest: "Flest uger i træk",
    longestNote: "Nogensinde",
    weekTitle: "Træninger pr. uge",
    monthTitle: "Træninger pr. måned",
    weekdaysTitle: "Ugedage",
    timeTitle: "Træningstid",
    total: "I alt",
    average: "Gennemsnitlig træning",
    timeBasis: {
      one: "Ud fra {count} træning med tid",
      other: "Ud fra {count} træninger med tid",
    },
    typesTitle: "Fordelt på type",
    types: {
      strength: "Styrke",
      run: "Løb",
      walk: "Gåture",
    },
    empty: "Ingen træninger i perioden.",
  },
  setTypes: {
    title: "Sættyper",
    teaser: {
      warmup: "{value} % opvarmning",
      drop: "{value} % dropsæt",
      amrap: "{value} % AMRAP-sæt",
    },
    onlyWorking: "Kun arbejdssæt",
    splitTitle: "Sæt fordelt på type",
    total: { one: "{count} sæt", other: "{count} sæt" },
    types: {
      warmup: "Opvarmning",
      working: "Arbejdssæt",
      drop: "Dropsæt",
      amrap: "AMRAP",
    },
    dropVolume: "Volumen i dropsæt",
    dropVolumeNote: "Andel af de kilo, du løftede",
    amrapOver: "AMRAP over målet",
    amrapBasis: {
      one: "Snit af {count} sæt med et mål",
      other: "Snit af {count} sæt med et mål",
    },
    empty: "Ingen sæt i perioden.",
  },
  runs: {
    title: "Løb",
    teaser: {
      one: "{km} km · {count} løb",
      other: "{km} km · {count} løb",
    },
    count: "Løb",
    distance: "Distance",
    time: "Tid",
    pace: "Gennemsnitstempo",
    bestTitle: "Bedste løb",
    fastest: "Hurtigste løb",
    fastestDetail: "{km} km · {date}",
    fastestNone: "Kræver et løb på mindst 1 km",
    longest: "Længste løb",
    longestDetail: "{time} · {date}",
    weekTitle: "Kilometer pr. uge",
    monthTitle: "Kilometer pr. måned",
    walks: {
      one: "Desuden {count} gåtur · {km} km",
      other: "Desuden {count} gåture · {km} km",
    },
    empty: "Ingen løb i perioden.",
  },
  exercises: {
    title: "Alle øvelser",
    listTitle: "Trænet i perioden",
    heaviest: "Tungeste: {lift}",
    up: "Går frem",
    down: "Går tilbage",
    flat: "Holder niveauet",
    open: "Åbn {name}",
    empty: "Ingen øvelser trænet i perioden.",
  },
};
