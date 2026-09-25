// The Statistics page and its deep dives: the period, the numbers, volume,
// muscle groups, intensity, frequency, set types and runs. Keep in step with
// ../da/statistics.js.
export default {
  eyebrow: "Library",
  title: "Statistics",

  // The overview at the top of the page. It came from Records, and so did
  // these texts.
  periods: {
    "4w": "4 weeks",
    "3m": "3 months",
    "1y": "1 year",
    all: "All",
  },
  kpi: {
    workouts: "Workouts",
    records: "Records",
    volume: "Volume",
    tonnes: "t",
    same: "same",
  },
  strength: {
    up: "You are getting stronger",
    flat: "Holding steady",
    down: "A little behind",
    detail: {
      one: "{improving} of {count} exercise improving · estimated 1RM",
      other: "{improving} of {count} exercises improving · estimated 1RM",
    },
    empty: "Train an exercise a few times and your progress shows up here.",
  },
  gains: {
    title: "Biggest gains",
    showAll: "Show all {count}",
    showFewer: "Show fewer",
    empty: "Nothing to measure yet in this period.",
    open: "Open {name}",
  },
  volume: {
    weekTitle: "Volume per week",
    monthTitle: "Volume per month",
    weekAverage: "The dashed line is the 4-week average",
    monthAverage: "The dashed line is the 3-month average",
  },
  muscles: {
    title: "Sets per muscle group",
    summary: {
      one: "{group} gets the least · {count} set in the period",
      other: "{group} gets the least · {count} sets in the period",
    },
  },
  empty: {
    title: "No records yet",
    body: "Finish a strength workout and your progress shows up here.",
  },

  // "Go deeper" and the five deep dives. A deep dive's `title` names its row
  // on the page and heads its own screen; its `teaser` is the row's number.
  deeper: {
    title: "Go deeper",
  },
  detail: {
    tryLonger: "Try a longer period.",
  },
  units: {
    km: "km",
    percent: "{value}%",
    pace: "{pace} /km",
    perKm: "/km",
    reps: "reps",
    hours: "{hours} h",
    duration: "{hours} h {minutes} min",
    minutes: "{minutes} min",
  },
  intensity: {
    title: "Intensity",
    teaser: "{value}% of 1RM on average",
    average: "Average intensity",
    caption: "Each set's weight against your best estimated 1RM in the exercise up to that day.",
    sets: "Working sets",
    heavy: "Heavy sets",
    heavyNote: "85% of 1RM or more",
    zonesTitle: "Sets by intensity",
    zones: {
      below60: "Under 60%",
      from60: "60–70%",
      from70: "70–80%",
      from80: "80–90%",
      from90: "90% or more",
    },
    rpe: {
      title: "RPE",
      average: "Average RPE",
      bands: {
        upTo7: "7 or less",
        rpe8: "8",
        rpe9: "9",
        rpe10: "10",
      },
      basis: {
        one: "From {count} set with an RPE",
        other: "From {count} sets with an RPE",
      },
    },
    empty: "No working sets in this period.",
  },
  frequency: {
    title: "Frequency and consistency",
    teaser: {
      one: "{value} workout per week",
      other: "{value} workouts per week",
    },
    perWeek: "Per week",
    workouts: "Workouts",
    streak: "Weeks in a row",
    streakThisWeek: "Up to this week",
    streakLastWeek: "Up to last week",
    streakNone: "Train this week to start again",
    longest: "Most weeks in a row",
    longestNote: "All time",
    weekTitle: "Workouts per week",
    monthTitle: "Workouts per month",
    weekdaysTitle: "Weekdays",
    timeTitle: "Training time",
    total: "Total",
    average: "Average workout",
    timeBasis: {
      one: "From {count} workout with a time",
      other: "From {count} workouts with a time",
    },
    typesTitle: "By type",
    types: {
      strength: "Strength",
      run: "Runs",
      walk: "Walks",
    },
    empty: "No workouts in this period.",
  },
  setTypes: {
    title: "Set types",
    teaser: {
      warmup: "{value}% warm-ups",
      drop: "{value}% drop sets",
      amrap: "{value}% AMRAP sets",
    },
    onlyWorking: "Only working sets",
    splitTitle: "Sets by type",
    total: { one: "{count} set", other: "{count} sets" },
    types: {
      warmup: "Warm-ups",
      working: "Working sets",
      drop: "Drop sets",
      amrap: "AMRAP sets",
    },
    dropVolume: "Drop set volume",
    dropVolumeNote: "Share of the kilos you lifted",
    amrapOver: "AMRAP over target",
    amrapBasis: {
      one: "Average of {count} set with a target",
      other: "Average of {count} sets with a target",
    },
    empty: "No sets in this period.",
  },
  runs: {
    title: "Runs",
    teaser: {
      one: "{km} km · {count} run",
      other: "{km} km · {count} runs",
    },
    count: "Runs",
    distance: "Distance",
    time: "Time",
    pace: "Average pace",
    bestTitle: "Best runs",
    fastest: "Fastest run",
    fastestDetail: "{km} km · {date}",
    fastestNone: "Needs a run of at least 1 km",
    longest: "Longest run",
    longestDetail: "{time} · {date}",
    weekTitle: "Kilometres per week",
    monthTitle: "Kilometres per month",
    walks: {
      one: "Also {count} walk · {km} km",
      other: "Also {count} walks · {km} km",
    },
    empty: "No runs in this period.",
  },
  exercises: {
    title: "All exercises",
    listTitle: "Trained in the period",
    heaviest: "Heaviest: {lift}",
    up: "Going up",
    down: "Going down",
    flat: "Holding steady",
    open: "Open {name}",
    empty: "No exercises trained in this period.",
  },
};
