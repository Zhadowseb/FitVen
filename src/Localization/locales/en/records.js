// The Records page: the overview and one exercise's detail. Keep in step with
// ../da/records.js.
export default {
  eyebrow: "Library",
  title: "Records",
  periods: {
    "4w": "4 weeks",
    "3m": "3 months",
    "1y": "1 year",
    all: "All",
  },
  // "compared with the {period} before"
  periodsBefore: {
    "4w": "4 weeks",
    "3m": "3 months",
    "1y": "12 months",
  },
  periodNote: "Everything follows the period · compared with the {period} before",
  periodNoteAll: "Your whole history · progress since your first session",
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
    new: "new",
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
  latest: {
    title: "Latest records",
  },
  exercises: {
    title: "All exercises",
    heaviest: "Heaviest: {lift}",
    showAll: "Show all {count}",
    showFewer: "Show fewer",
    up: "Going up",
    down: "Going down",
    flat: "Holding steady",
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
  exercise: {
    back: "Back to Records",
    overline: "Records",
    estimate: "Estimated 1RM",
    changeInPeriod: "{change} % in the period",
    gapDays: "{count} days",
    nextStep: "Next step at {reps} reps",
    repsShort: "{reps} REPS",
    noSets: "No sets with a weight in this period.",
    bestSet: "Best set {when} · {lift}",
    tryNext: "try {target} · you did {current}",
    repLadder: "Record per reps",
    noSet: "no set",
    latestSets: "Latest sets",
    pr: "PR",
    periods: {
      "1m": "1M",
      "3m": "3M",
      "6m": "6M",
      "1y": "1Y",
      all: "All",
    },
  },
};
