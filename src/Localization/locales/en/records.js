// The Records page - the trophy room - and one exercise's page. Keep in step
// with ../da/records.js.
export default {
  eyebrow: "Library",
  title: "Records",
  // The trophy room: the whole history, nothing to compare it with.
  trophy: {
    recordCount: { one: "record set", other: "records set" },
    heaviest: "Heaviest lift",
    heaviestValue: "{weight} kg × {reps} · {name}",
    since: "Since {date}",
    emptyTitle: "Your first record is waiting",
    emptyBody: "Finish a strength workout and your collection starts here.",
    podium: {
      title: "Your strongest lifts",
      meta: "× {reps} · {date}",
      label: "Place {rank}: {name}, {weight} kg × {reps}",
      nextGoal: "Next goal: {goal} kg in {name}",
      toGo: "{value} kg to go",
    },
    recent: {
      title: "New records",
      new: "New",
      label: "{name}, {weight} kg × {reps}, {when}",
    },
    milestones: {
      title: "Milestones",
      workouts: { one: "{value} workout", other: "{value} workouts" },
      tonnes: { one: "{value} tonne lifted", other: "{value} tonnes lifted" },
      records: { one: "{value} record", other: "{value} records" },
      weekStreak: { one: "{value} week in a row", other: "{value} weeks in a row" },
      nextUp: "Next: {label}",
      notYet: "Not yet",
      maxed: "Top of the ladder",
    },
    statistics: {
      title: "See your statistics",
      body: "Volume, frequency, intensity and runs",
    },
  },
  exercise: {
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
