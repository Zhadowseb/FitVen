// De fire kategorier, centre rangeres i, og de ord alle skærme om dem deler:
// navnene, filtrene, enhederne. Hold i trit med ../en/category.js.
export default {
  names: {
    flid: "Flid",
    powerlifting: "Powerlifting",
    fremgang: "Fremgang",
    calisthenics: "Calisthenics",
  },
  descriptions: {
    flid: "Flest træninger · {period}",
    powerlifting: "Bænk + squat + dødløft · kun 1 rep",
    fremgang: "Største stigning de sidste 30 dage",
    calisthenics: "Pull-ups × 3 + dips × 2 + armstrækninger",
  },
  gender: {
    all: "Alle",
    men: "Mænd",
    women: "Kvinder",
  },
  ageGroups: {
    all: "Alle aldre",
    u23: "Under 23",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Uge",
    month: "Måned",
    year: "År",
  },
  flidTabs: {
    workouts: "Træninger",
    streak: "Uger i træk",
  },
  fremgangTabs: {
    all: "Alle løft",
    bench: "Bænk",
    squat: "Squat",
    deadlift: "Dødløft",
  },
  units: {
    workouts: { one: "træning", other: "træninger" },
    weeks: { one: "uge", other: "uger" },
    kg: "kg",
    percent: "%",
    points: { one: "point", other: "point" },
  },
  weightClasses: {
    all: "Alle vægte",
  },
  onlyVideo: "Kun video",
  notIn: "ikke {where}",
  notInFilter: "Du er ikke med under {filter}. Vælg Alle for at se din placering.",
  countries: {
    DK: "Danmark",
  },
  // "i Danmark" - til "ikke {where}" og "Søg efter et center {where}".
  countriesWhere: {
    DK: "i Danmark",
  },

  // Kategorisiden (5a-5d). Tallene i reglerne ({count}, {days}, {sets},
  // {reps}, {activeDays} og faktorerne) kommer fra Utils/gymCategories.js.
  page: {
    allCountries: "Alle lande",
    gymFallback: "Centret",
    friends: "Venner",
  },
  // Under titlen: hvordan kategorien tælles.
  explanations: {
    flidWorkouts: "Alle gennemførte træninger i perioden, uanset type.",
    flidStreak:
      "Uger i træk med mindst {count} gennemførte træninger, mandag til søndag. Denne uge tæller med, når den når {count}. En sygeuge bryder rækken her.",
    powerlifting:
      "Bedste løft med 1 gentagelse i bænkpres, squat og dødløft, lagt sammen. Et løft, du mangler, tæller 0. Afviste løft tæller ikke.",
    powerliftingVideo:
      "Kun løft med bekræftet video: bedste løft med 1 gentagelse i bænkpres, squat og dødløft, lagt sammen. Et løft, du mangler, tæller 0.",
    fremgang:
      "Største stigning i estimeret 1RM de sidste {days} dage mod de {days} før, ud fra sæt med 1–{reps} gentagelser. Mindst {sets} sæt i begge perioder.",
    calisthenics:
      "Flest gentagelser i ét sæt uden ekstra vægt, gange sværhedsgrad: pull-ups × {pullups}, dips × {dips}, armstrækninger × {pushups}. Lagt sammen.",
  },
  empty: {
    title: "Ingen på listen endnu",
    friendsTitle: "Ingen, du følger, er på listen endnu",
    members: "Med er alle, der har trænet i et center her de sidste {activeDays} dage.",
    membersGym: "Med er alle, der har trænet her de sidste {activeDays} dage.",
    flidWorkouts: "Hver gennemført træning i perioden tæller.",
    flidStreak: "En uge tæller, når den har mindst {count} gennemførte træninger.",
    powerlifting: "Ét løft med 1 gentagelse i bænkpres, squat eller dødløft giver en total.",
    powerliftingVideo: "Her tæller kun løft med bekræftet video.",
    fremgang: "Det kræver mindst {sets} sæt i samme løft i begge perioder på {days} dage.",
    calisthenics: "Et sæt pull-ups, dips eller armstrækninger uden ekstra vægt giver point.",
  },
  errors: {
    title: "Listen kunne ikke hentes",
    body: "Tjek din forbindelse, og prøv igen.",
    refreshFailed: "Listen kunne ikke opdateres.",
  },
  unavailable: {
    title: "Ikke klar endnu",
    body: "Kategorilisterne er ikke slået til endnu. Kig forbi igen senere.",
  },
  // Din egen række, nederst.
  me: {
    gap: "{gap} til #{rank}",
    tied: "Lige med #{rank}",
    leading: "Du fører listen",
    homeGymRank: "#{rank} i dit center",
    notOnListTitle: "Du er ikke på listen her",
    noValueTitle: "Du er ikke på listen endnu",
    notOnListBody: "Listen tæller dem, der har trænet i et center her de sidste {activeDays} dage.",
    notOnListBodyGym: "Listen tæller dem, der har trænet her de sidste {activeDays} dage.",
  },
  // Linjen under et navn på listen.
  rows: {
    streak: { one: "{count} uge i træk", other: "{count} uger i træk" },
    last: "sidst {when}",
    powerlifting: "B {bench} · S {squat} · D {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Pull {pullups} · Dip {dips} · Arm {pushups}",
  },
  // "Din fremgang" og "Dine point".
  personal: {
    progress: "Din fremgang",
    points: "Dine point",
    pullups: "Pull",
    dips: "Dip",
    pushups: "Arm",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Periode",
    age: "Alder",
    ageHint: "Ud fra fødselsåret i din profil. Uden fødselsår er du kun med under Alle aldre.",
    weightClass: "Vægtklasse",
    weightClassStatic: "Kropsvægt kan ikke angives endnu, så alle er med under Alle vægte.",
    onlyVideoHint: "Viser kun løft med bekræftet video",
  },
  // Powerliftings tre knapper nederst.
  lifts: {
    title: "Hvert løft for sig",
    bench: "Bænkpres",
    squat: "Squat",
    deadlift: "Dødløft",
    gymHint: "Åbner centrets liste for løftet",
    nationalHint: "Åbner hele landets liste for løftet",
  },
};
