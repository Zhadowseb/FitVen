// The Train tab's library tiles, Your form and the tools.
export default {
  // The grid's four tiles.
  workouts: "Pass",
  records: "Rekord",
  exercises: "Övningar",
  programs: "Program",
  // Beside the number of programs; left out when none is active.
  activePrograms: { one: "{count} aktivt", other: "{count} aktiva" },

  // "Your form". The streak number is drawn on its own, bigger, so the words
  // beside it carry no number.
  form: {
    weeksInRow: { one: "vecka i rad", other: "veckor i rad" },
    threshold: {
      one: "med minst {count} pass",
      other: "med minst {count} pass",
    },
    perWeek: "per vecka",
  },

  tools: {
    oneRepMax: "1RM-kalkylator",
    sickDays: "Sjukdagar",
    thisYear: "i år",
    // The 1RM tool with no set to estimate from.
    noLifts: { one: "Inga lyft på {count} dag", other: "Inga lyft på {count} dagar" },
  },

  // What a screen reader says for each tile.
  a11y: {
    workouts: "Pass: {total} totalt, {week} den här veckan",
    records: "Rekord: {total} totalt, {week} den här veckan",
    exercises: "Övningar: {count} i katalogen",
    programs: "Program: {count} totalt, {active}",
    form: "Din form: {streak} {weeks}, {threshold}, {average} per vecka",
    oneRepMax: "1RM-kalkylator: {value} kg beräknat från {exercise}, {weight} kg i {reps}",
    oneRepMaxEmpty: "1RM-kalkylator: {detail}",
    sickDays: "Sjukdagar: {count} i år",
  },
};
