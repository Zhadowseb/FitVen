// De fire kategoriene sentre rangeres i, og ordene alle skjermene om dem deler:
// navnene, filtrene og enhetene.
export default {
  names: {
    flid: "Jevn innsats",
    powerlifting: "Styrkeløft",
    fremgang: "Fremgang",
    calisthenics: "Kroppsvekt",
  },
  descriptions: {
    flid: "Flest økter · {period}",
    powerlifting: "Benkpress + knebøy + markløft · tyngste løft",
    fremgang: "Størst økning siste 30 dager",
    calisthenics: "Pull-ups × 3 + dips × 2 + push-ups",
  },
  gender: {
    all: "Alle",
    men: "Menn",
    women: "Kvinner",
  },
  ageGroups: {
    all: "Alle aldre",
    u23: "Under 23",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Uke",
    month: "Måned",
    year: "År",
  },
  flidTabs: {
    workouts: "Økter",
    streak: "Uker på rad",
  },
  units: {
    workouts: { one: "økt", other: "økter" },
    weeks: { one: "uke", other: "uker" },
    kg: "kg",
    percent: "%",
    points: { one: "poeng", other: "poeng" },
  },
  weightClasses: {
    all: "Alle vekter",
  },
  notIn: "ikke {where}",
  notInFilter: "Du er ikke med i {filter}. Velg Alle for å se plasseringen din.",
  countries: {
    DK: "Danmark",
  },
  // "i Danmark" - til "ikke {where}" og "Søk etter et treningssenter {where}".
  countriesWhere: {
    DK: "i Danmark",
  },

  // Kategorisiden (5a-5d). Tallene i reglene ({count}, {days}, {sets}, {reps},
  // {activeDays} og faktorene) kommer fra Utils/gymCategories.js.
  page: {
    allCountries: "Alle land",
    gymFallback: "Senteret",
    friends: "Venner",
  },
  // Under tittelen: hvordan kategorien telles.
  explanations: {
    flidWorkouts: "Hver fullførte økt i perioden, av alle typer.",
    flidStreak:
      "Uker på rad med minst {count} fullførte økter, mandag til søndag. Denne uken teller så snart den når {count}. En sykeuke bryter rekken her.",
    powerlifting:
      "Den tyngste vekten du har løftet i benkpress, knebøy og markløft, lagt sammen. Et sett teller for alle lavere repetisjonstall: 90 kg × 3 er også 90 kg for 1. Et løft som mangler, teller som 0.",
    fremgang:
      "Størst økning i estimert 1RM de siste {days} dagene sammenlignet med de {days} forrige, fra sett på 1–{reps} reps. Minst {sets} sett i begge periodene.",
    calisthenics:
      "Flest reps i ett sett uten ekstra vekt, ganger vanskelighetsgrad: pull-ups × {pullups}, dips × {dips}, push-ups × {pushups}. Lagt sammen.",
  },
  empty: {
    title: "Ingen på listen ennå",
    friendsTitle: "Ingen du følger er på listen ennå",
    members: "Alle som har trent på et senter her de siste {activeDays} dagene, er med.",
    membersGym: "Alle som har trent her de siste {activeDays} dagene, er med.",
    flidWorkouts: "Hver fullførte økt i perioden teller.",
    flidStreak: "En uke teller så snart den har minst {count} fullførte økter.",
    powerlifting: "Ett sett benkpress, knebøy eller markløft gir deg en sum.",
    fremgang: "Det kreves minst {sets} sett av samme øvelse i begge periodene på {days} dager.",
    calisthenics: "Et sett pull-ups, dips eller push-ups uten ekstra vekt gir poeng.",
  },
  errors: {
    title: "Kunne ikke laste listen",
    body: "Sjekk tilkoblingen din og prøv igjen.",
    refreshFailed: "Listen kunne ikke oppdateres.",
  },
  unavailable: {
    title: "Ikke tilgjengelig ennå",
    body: "Kategorirangeringene er ikke slått på ennå. Prøv igjen senere.",
  },
  // Din egen rad, nederst.
  me: {
    gap: "{gap} til #{rank}",
    tied: "Likt med #{rank}",
    leading: "Du leder",
    homeGymRank: "#{rank} på senteret ditt",
    notOnListTitle: "Du er ikke på denne listen",
    noValueTitle: "Du er ikke på listen ennå",
    notOnListBody: "Den teller folk som har trent på et senter her de siste {activeDays} dagene.",
    notOnListBodyGym: "Den teller folk som har trent her de siste {activeDays} dagene.",
  },
  // Linjen under et navn: på listen, og under #1 på et senterkort.
  rows: {
    streak: { one: "{count} uke på rad", other: "{count} uker på rad" },
    last: "trente {when}",
    powerlifting: "B {bench} · K {squat} · M {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Pull {pullups} · Dip {dips} · Push {pushups}",
  },
  // "Din fremgang" og "Poengene dine".
  personal: {
    progress: "Din fremgang",
    progressEmpty:
      "Gjør minst {sets} sett av samme øvelse de siste {days} dagene og i de {days} dagene før, så vises fremgangen din her.",
    points: "Poengene dine",
    pullups: "Pull",
    dips: "Dip",
    pushups: "Push",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Periode",
    age: "Alder",
    ageHint: "Fra fødselsåret i profilen din. Uten det er du bare med under Alle aldre.",
    weightClass: "Vektklasse",
    weightClassStatic: "Kroppsvekt kan ikke settes ennå, så alle er med under Alle vekter.",
  },
  // Styrkeløftets tre knapper nederst - og løftet en økning under Fremgang kom i.
  lifts: {
    title: "Hvert løft for seg",
    bench: "Benkpress",
    squat: "Knebøy",
    deadlift: "Markløft",
    gymHint: "Åpner senterets liste for løftet",
    nationalHint: "Åpner den nasjonale listen for løftet",
  },
};
