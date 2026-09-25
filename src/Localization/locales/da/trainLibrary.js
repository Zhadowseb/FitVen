// Træn-fanens biblioteksfliser, Din form og værktøjerne. Holdes i trit med
// ../en/trainLibrary.js.
export default {
  // Gitterets fire fliser.
  workouts: "Træninger",
  records: "Rekorder",
  exercises: "Øvelser",
  programs: "Programmer",
  // Ved siden af antallet af programmer; udelades når intet er aktivt.
  activePrograms: { one: "{count} aktivt", other: "{count} aktive" },

  // "Din form". Streak-tallet tegnes for sig og større, så ordene ved siden
  // af har intet tal.
  form: {
    weeksInRow: { one: "uge i træk", other: "uger i træk" },
    threshold: {
      one: "med mindst {count} træning",
      other: "med mindst {count} træninger",
    },
    perWeek: "pr. uge",
  },

  tools: {
    oneRepMax: "1RM-beregner",
    sickDays: "Sygdomsdage",
    thisYear: "i år",
    // 1RM-værktøjet, når der ikke er et sæt at regne ud fra.
    noLifts: { one: "Ingen løft i {count} dag", other: "Ingen løft i {count} dage" },
  },

  // Det, en skærmlæser siger for hver flise.
  a11y: {
    workouts: "Træninger: {total} i alt, {week} denne uge",
    records: "Rekorder: {total} i alt, {week} denne uge",
    exercises: "Øvelser: {count} i kataloget",
    programs: "Programmer: {count} i alt, {active}",
    form: "Din form: {streak} {weeks}, {threshold}, {average} pr. uge",
    oneRepMax: "1RM-beregner: {value} kg anslået ud fra {exercise}, {weight} kg i {reps}",
    oneRepMaxEmpty: "1RM-beregner: {detail}",
    sickDays: "Sygdomsdage: {count} i år",
  },
};
