// Start-træning-arket bag midterknappen i navigationen: de nye
// træningsfelter, dagens planlagte træning og gentag-en-træning-listen.
// Holdes i trit med ../en/workoutStart.js.
export default {
  title: "START NY TRÆNING",
  titleForDate: "Hvad skal du lave den {date}?",
  closeSheet: "Luk træningsstarter",
  workoutCalendar: "Træningskalender",
  ready: "Klar",
  recent: "Seneste",
  suggested: "FORESLÅET",
  timesCount: "{count}x",
  types: {
    resistance: "Styrke",
    run: "Løb",
    walk: "Gåtur",
    workout: "Træning",
  },
  planned: {
    promptSingleToday: "Du har en træning planlagt i dag.",
    promptSingleOnDay: "Du har en træning planlagt på denne dag.",
    promptMultipleToday: "Du har flere træninger planlagt i dag.",
    promptMultipleOnDay: "Du har flere træninger planlagt på denne dag.",
    eyebrowToday: "PLANLAGT I DAG",
    eyebrow: "PLANLAGT",
    workoutsPlanned: {
      one: "{count} træning planlagt",
      other: "{count} træninger planlagt",
    },
    countReady: "{count} klar",
    detailWithExercises: {
      one: "{programName} - {count} øvelse",
      other: "{programName} - {count} øvelser",
    },
    detailReady: "{programName} - Klar",
  },
  usual: {
    title: "DINE FASTE TRÆNINGER",
    manage: "Administrer",
    loading: "Finder faste træninger...",
    empty: "Gentag en træning to gange for at se den her.",
  },
  repeat: {
    title: "GENTAG EN TRÆNING",
    loading: "Indlæser seneste træninger...",
    loadingMore: "Indlæser flere træninger...",
    empty: "Gentag en træning to gange for at se den her.",
    showExercises: "Vis øvelser i {title}",
    hideExercises: "Skjul øvelser i {title}",
    noExercises: "Ingen øvelser i denne træning.",
  },
};
