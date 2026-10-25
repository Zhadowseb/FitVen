// De fyra kategorier som gym rankas i, och de ord som alla skärmar om dem delar.
export default {
  names: {
    flid: "Kontinuitet",
    powerlifting: "Powerlifting",
    fremgang: "Framsteg",
    calisthenics: "Calisthenics",
  },
  descriptions: {
    flid: "Flest pass · {period}",
    powerlifting: "Bänkpress + knäböj + marklyft · tyngsta lyft",
    fremgang: "Största ökningen de senaste 30 dagarna",
    calisthenics: "Pull-ups × 3 + dips × 2 + armhävningar",
  },
  gender: {
    all: "Alla",
    men: "Män",
    women: "Kvinnor",
  },
  ageGroups: {
    all: "Alla åldrar",
    u23: "Under 23",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Vecka",
    month: "Månad",
    year: "År",
  },
  flidTabs: {
    workouts: "Pass",
    streak: "Veckor i rad",
  },
  units: {
    workouts: { one: "pass", other: "pass" },
    weeks: { one: "vecka", other: "veckor" },
    kg: "kg",
    percent: "%",
    points: { one: "poäng", other: "poäng" },
  },
  weightClasses: {
    all: "Alla viktklasser",
  },
  notIn: "inte {where}",
  notInFilter: "Du finns inte i {filter}. Välj Alla för att se din placering.",
  countries: {
    DK: "Danmark",
  },
  // "in Denmark" - for "not {where}" and "Search for a gym {where}".
  countriesWhere: {
    DK: "i Danmark",
  },

  // The category page. The numbers in the rules ({count}, {days}, {sets},
  // {reps}, {activeDays} and the factors) come from Utils/gymCategories.js.
  page: {
    allCountries: "Alla länder",
    gymFallback: "Gymmet",
    friends: "Vänner",
  },
  // Under the title: how the category is counted.
  explanations: {
    flidWorkouts: "Varje avslutat pass under perioden, oavsett typ.",
    flidStreak:
      "Veckor i rad med minst {count} avslutade pass, måndag till söndag. Den här veckan räknas när den når {count}. En sjukvecka bryter serien här.",
    powerlifting:
      "Den tyngsta vikt du har lyft i bänkpress, knäböj och marklyft, sammanlagt. Ett set räknas för varje lägre antal reps: 90 kg × 3 är också 90 kg för 1. Ett lyft som saknas räknas som 0.",
    fremgang:
      "Största ökningen i beräknad 1RM de senaste {days} dagarna jämfört med de {days} dagarna före, från set med 1–{reps} reps. Minst {sets} set i båda perioderna.",
    calisthenics:
      "Flest reps i ett set utan extra vikt, gånger svårighetsgrad: pull-ups × {pullups}, dips × {dips}, armhävningar × {pushups}. Summerat.",
  },
  empty: {
    title: "Ingen på listan än",
    friendsTitle: "Ingen du följer är på listan än",
    members: "Alla som har tränat på ett gym här de senaste {activeDays} dagarna är med.",
    membersGym: "Alla som har tränat här de senaste {activeDays} dagarna är med.",
    flidWorkouts: "Varje avslutat pass under perioden räknas.",
    flidStreak: "En vecka räknas när den har minst {count} avslutade pass.",
    powerlifting: "Ett set bänkpress, knäböj eller marklyft ger dig en summa.",
    fremgang: "Det krävs minst {sets} set av samma övning i båda perioderna på {days} dagar.",
    calisthenics: "Ett set pull-ups, dips eller armhävningar utan extra vikt ger poäng.",
  },
  errors: {
    title: "Listan kunde inte laddas",
    body: "Kontrollera din anslutning och försök igen.",
    refreshFailed: "Listan kunde inte uppdateras.",
  },
  unavailable: {
    title: "Inte tillgängligt än",
    body: "Kategorirankingarna är inte påslagna än. Titta tillbaka senare.",
  },
  // Your own row, at the bottom.
  me: {
    gap: "{gap} till #{rank}",
    tied: "Jämsides med #{rank}",
    leading: "Du leder",
    homeGymRank: "#{rank} på ditt gym",
    notOnListTitle: "Du finns inte på den här listan",
    noValueTitle: "Du är inte på listan än",
    notOnListBody: "Den räknar personer som har tränat på ett gym här de senaste {activeDays} dagarna.",
    notOnListBodyGym: "Den räknar personer som har tränat här de senaste {activeDays} dagarna.",
  },
  // The line under a name: on the list, and under #1 on a gym's card.
  rows: {
    streak: { one: "{count} vecka i rad", other: "{count} veckor i rad" },
    last: "tränade {when}",
    powerlifting: "B {bench} · K {squat} · M {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Pull {pullups} · Dips {dips} · Armh. {pushups}",
  },
  // "Your progress" and "Your points".
  personal: {
    progress: "Dina framsteg",
    progressEmpty:
      "Gör minst {sets} set av samma övning de senaste {days} dagarna och under de {days} dagarna före, så visas dina framsteg här.",
    points: "Dina poäng",
    pullups: "Pull",
    dips: "Dips",
    pushups: "Armh.",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Period",
    age: "Ålder",
    ageHint: "Utifrån födelseåret i din profil. Utan det finns du bara under Alla åldrar.",
    weightClass: "Viktklass",
    weightClassStatic: "Kroppsvikt kan inte anges än, så alla ligger under Alla viktklasser.",
  },
  // Powerlifting's three buttons at the bottom - and the lift a rise on Progress was in.
  lifts: {
    title: "Varje lyft för sig",
    bench: "Bänkpress",
    squat: "Knäböj",
    deadlift: "Marklyft",
    gymHint: "Öppnar gymmets lista för lyftet",
    nationalHint: "Öppnar den nationella listan för lyftet",
  },
};
