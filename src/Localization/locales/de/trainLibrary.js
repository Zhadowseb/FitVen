// Die Bibliothekskacheln des Training-Tabs, „Deine Form“ und die Tools.
export default {
  workouts: "Workouts",
  records: "Rekorde",
  exercises: "Übungen",
  programs: "Programme",
  activePrograms: { one: "{count} aktiv", other: "{count} aktiv" },

  form: {
    weeksInRow: { one: "Woche in Folge", other: "Wochen in Folge" },
    threshold: {
      one: "mit mindestens {count} Workout",
      other: "mit mindestens {count} Workouts",
    },
    perWeek: "pro Woche",
  },

  tools: {
    oneRepMax: "1RM-Rechner",
    sickDays: "Krankheitstage",
    thisYear: "dieses Jahr",
    noLifts: { one: "Seit {count} Tag keine Lifts", other: "Seit {count} Tagen keine Lifts" },
  },

  a11y: {
    workouts: "Workouts: {total} insgesamt, {week} diese Woche",
    records: "Rekorde: {total} insgesamt, {week} diese Woche",
    exercises: "Übungen: {count} im Katalog",
    programs: "Programme: {count} insgesamt, {active}",
    form: "Deine Form: {streak} {weeks}, {threshold}, {average} pro Woche",
    oneRepMax: "1RM-Rechner: {value} kg geschätzt aus {exercise}, {weight} kg für {reps}",
    oneRepMaxEmpty: "1RM-Rechner: {detail}",
    sickDays: "Krankheitstage: {count} dieses Jahr",
  },
};
