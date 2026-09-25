// The Train tab's library tiles, Your form and the tools. Keep in step with
// ../da/trainLibrary.js.
export default {
  // The grid's four tiles.
  workouts: "Workouts",
  records: "Records",
  exercises: "Exercises",
  programs: "Programs",
  // Beside the number of programs; left out when none is active.
  activePrograms: { one: "{count} active", other: "{count} active" },

  // "Your form". The streak number is drawn on its own, bigger, so the words
  // beside it carry no number.
  form: {
    weeksInRow: { one: "week in a row", other: "weeks in a row" },
    threshold: {
      one: "with at least {count} workout",
      other: "with at least {count} workouts",
    },
    perWeek: "per week",
  },

  tools: {
    oneRepMax: "1RM calculator",
    sickDays: "Sick days",
    thisYear: "this year",
    // The 1RM tool with no set to estimate from.
    noLifts: { one: "No lifts in {count} day", other: "No lifts in {count} days" },
  },

  // What a screen reader says for each tile.
  a11y: {
    workouts: "Workouts: {total} in total, {week} this week",
    records: "Records: {total} in total, {week} this week",
    exercises: "Exercises: {count} in the catalog",
    programs: "Programs: {count} in total, {active}",
    form: "Your form: {streak} {weeks}, {threshold}, {average} per week",
    oneRepMax: "1RM calculator: {value} kg estimated from {exercise}, {weight} kg for {reps}",
    oneRepMaxEmpty: "1RM calculator: {detail}",
    sickDays: "Sick days: {count} this year",
  },
};
