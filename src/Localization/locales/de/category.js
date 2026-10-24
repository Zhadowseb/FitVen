// Die vier Kategorien, in denen Gyms gerankt werden, und die gemeinsamen Wörter.
export default {
  names: {
    flid: "Konstanz",
    powerlifting: "Powerlifting",
    fremgang: "Fortschritt",
    calisthenics: "Calisthenics",
  },
  descriptions: {
    flid: "Meiste Workouts · {period}",
    powerlifting: "Bankdrücken + Kniebeuge + Kreuzheben · schwerste Last",
    fremgang: "Größter Anstieg in den letzten 30 Tagen",
    calisthenics: "Klimmzüge × 3 + Dips × 2 + Liegestütze",
  },
  gender: {
    all: "Alle",
    men: "Männer",
    women: "Frauen",
  },
  ageGroups: {
    all: "Alle Altersgruppen",
    u23: "Unter 23",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Woche",
    month: "Monat",
    year: "Jahr",
  },
  flidTabs: {
    workouts: "Workouts",
    streak: "Wochen in Folge",
  },
  units: {
    workouts: { one: "Workout", other: "Workouts" },
    weeks: { one: "Woche", other: "Wochen" },
    kg: "kg",
    percent: "%",
    points: { one: "Punkt", other: "Punkte" },
  },
  weightClasses: {
    all: "Alle Gewichte",
  },
  notIn: "nicht {where}",
  notInFilter: "Du bist nicht in {filter}. Wähle „Alle“, um deinen Rang zu sehen.",
  countries: {
    DK: "Dänemark",
  },
  countriesWhere: {
    DK: "in Dänemark",
  },

  page: {
    allCountries: "Alle Länder",
    gymFallback: "Das Gym",
    friends: "Freunde",
  },
  explanations: {
    flidWorkouts: "Jedes abgeschlossene Workout im Zeitraum, egal welcher Art.",
    flidStreak:
      "Wochen in Folge mit mindestens {count} abgeschlossenen Workouts, Montag bis Sonntag. Die aktuelle Woche zählt, sobald sie {count} erreicht. Eine Krankheitswoche unterbricht die Serie.",
    powerlifting:
      "Das schwerste Gewicht, das du bei Bankdrücken, Kniebeuge und Kreuzheben bewegt hast, zusammengerechnet. Ein Satz zählt für jede niedrigere Wiederholungszahl: 90 kg × 3 sind auch 90 kg für 1. Eine fehlende Übung zählt als 0.",
    fremgang:
      "Größter Anstieg des geschätzten 1RM in den letzten {days} Tagen gegenüber den {days} Tagen davor, aus Sätzen mit 1–{reps} Wdh. Mindestens {sets} Sätze in beiden Zeiträumen.",
    calisthenics:
      "Die meisten Wiederholungen in einem Satz ohne Zusatzgewicht, mal Schwierigkeit: Klimmzüge × {pullups}, Dips × {dips}, Liegestütze × {pushups}. Zusammengerechnet.",
  },
  empty: {
    title: "Noch niemand in der Liste",
    friendsTitle: "Noch niemand, dem du folgst, ist in der Liste",
    members: "Alle, die in den letzten {activeDays} Tagen in einem Gym hier trainiert haben, sind dabei.",
    membersGym: "Alle, die in den letzten {activeDays} Tagen hier trainiert haben, sind dabei.",
    flidWorkouts: "Jedes abgeschlossene Workout im Zeitraum zählt.",
    flidStreak: "Eine Woche zählt, sobald sie mindestens {count} abgeschlossene Workouts hat.",
    powerlifting: "Ein Satz Bankdrücken, Kniebeuge oder Kreuzheben ergibt eine Summe.",
    fremgang: "Dafür braucht es mindestens {sets} Sätze derselben Übung in beiden {days}-Tage-Zeiträumen.",
    calisthenics: "Ein Satz Klimmzüge, Dips oder Liegestütze ohne Zusatzgewicht bringt Punkte.",
  },
  errors: {
    title: "Liste konnte nicht geladen werden",
    body: "Prüfe deine Verbindung und versuche es erneut.",
    refreshFailed: "Die Liste konnte nicht aktualisiert werden.",
  },
  unavailable: {
    title: "Noch nicht verfügbar",
    body: "Die Kategorie-Rankings sind noch nicht freigeschaltet. Schau später wieder vorbei.",
  },
  me: {
    gap: "{gap} bis #{rank}",
    tied: "Gleichauf mit #{rank}",
    leading: "Du liegst vorn",
    homeGymRank: "#{rank} in deinem Gym",
    notOnListTitle: "Du bist nicht in dieser Liste",
    noValueTitle: "Du bist noch nicht in der Liste",
    notOnListBody: "Gezählt werden Personen, die in den letzten {activeDays} Tagen in einem Gym hier trainiert haben.",
    notOnListBodyGym: "Gezählt werden Personen, die in den letzten {activeDays} Tagen hier trainiert haben.",
  },
  rows: {
    streak: { one: "{count} Woche in Folge", other: "{count} Wochen in Folge" },
    last: "trainierte {when}",
    powerlifting: "BD {bench} · KB {squat} · KH {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Klimmz. {pullups} · Dips {dips} · Liegest. {pushups}",
  },
  personal: {
    progress: "Dein Fortschritt",
    progressEmpty:
      "Mach mindestens {sets} Sätze derselben Übung in den letzten {days} Tagen und in den {days} Tagen davor, dann siehst du hier deinen Fortschritt.",
    points: "Deine Punkte",
    pullups: "Klimmzug",
    dips: "Dip",
    pushups: "Liegestütz",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Zeitraum",
    age: "Alter",
    ageHint: "Nach dem Geburtsjahr in deinem Profil. Ohne Angabe bist du nur unter „Alle Altersgruppen“.",
    weightClass: "Gewichtsklasse",
    weightClassStatic: "Das Körpergewicht lässt sich noch nicht festlegen, daher sind alle unter „Alle Gewichte“.",
  },
  lifts: {
    title: "Jede Übung einzeln",
    bench: "Bankdrücken",
    squat: "Kniebeuge",
    deadlift: "Kreuzheben",
    gymHint: "Öffnet die Gym-Liste für diese Übung",
    nationalHint: "Öffnet die landesweite Liste für diese Übung",
  },
};
