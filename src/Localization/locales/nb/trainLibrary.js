// Bibliotekflisene i Trening-fanen, Din form og verktøyene.
export default {
  // Rutenettets fire fliser.
  workouts: "Økter",
  records: "Rekorder",
  exercises: "Øvelser",
  programs: "Programmer",
  // Ved siden av antall programmer; utelatt når ingen er aktive.
  activePrograms: { one: "{count} aktiv", other: "{count} aktive" },

  // "Din form". Streak-tallet tegnes for seg selv, større, så ordene ved
  // siden av bærer ikke noe tall.
  form: {
    weeksInRow: { one: "uke på rad", other: "uker på rad" },
    threshold: {
      one: "med minst {count} økt",
      other: "med minst {count} økter",
    },
    perWeek: "per uke",
  },

  tools: {
    oneRepMax: "1RM-kalkulator",
    sickDays: "Sykedager",
    thisYear: "i år",
    // 1RM-verktøyet uten noe sett å estimere fra.
    noLifts: { one: "Ingen løft på {count} dag", other: "Ingen løft på {count} dager" },
  },

  // Det en skjermleser sier for hver flis.
  a11y: {
    workouts: "Økter: {total} totalt, {week} denne uken",
    records: "Rekorder: {total} totalt, {week} denne uken",
    exercises: "Øvelser: {count} i katalogen",
    programs: "Programmer: {count} totalt, {active}",
    form: "Din form: {streak} {weeks}, {threshold}, {average} per uke",
    oneRepMax: "1RM-kalkulator: {value} kg estimert fra {exercise}, {weight} kg på {reps}",
    oneRepMaxEmpty: "1RM-kalkulator: {detail}",
    sickDays: "Sykedager: {count} i år",
  },
};
