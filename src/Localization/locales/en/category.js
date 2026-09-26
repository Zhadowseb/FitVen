// The four categories centres are ranked in, and the words every screen about
// them shares: the names, the filters, the units. Keep in step with
// ../da/category.js.
export default {
  names: {
    flid: "Consistency",
    powerlifting: "Powerlifting",
    fremgang: "Progress",
    calisthenics: "Calisthenics",
  },
  descriptions: {
    flid: "Most workouts · {period}",
    powerlifting: "Bench + squat + deadlift · 1 rep only",
    fremgang: "Biggest rise over the last 30 days",
    calisthenics: "Pull-ups × 3 + dips × 2 + push-ups",
  },
  gender: {
    all: "All",
    men: "Men",
    women: "Women",
  },
  ageGroups: {
    all: "All ages",
    u23: "Under 23",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Week",
    month: "Month",
    year: "Year",
  },
  flidTabs: {
    workouts: "Workouts",
    streak: "Weeks in a row",
  },
  fremgangTabs: {
    all: "All lifts",
    bench: "Bench",
    squat: "Squat",
    deadlift: "Deadlift",
  },
  units: {
    workouts: { one: "workout", other: "workouts" },
    weeks: { one: "week", other: "weeks" },
    kg: "kg",
    percent: "%",
    points: { one: "point", other: "points" },
  },
  weightClasses: {
    all: "All weights",
  },
  onlyVideo: "Video only",
  notIn: "not {where}",
  notInFilter: "You're not in {filter}. Choose All to see your rank.",
  countries: {
    DK: "Denmark",
  },
  // "in Denmark" - for "not {where}" and "Search for a gym {where}".
  countriesWhere: {
    DK: "in Denmark",
  },

  // The category page (5a-5d). The numbers in the rules ({count}, {days},
  // {sets}, {reps}, {activeDays} and the factors) come from
  // Utils/gymCategories.js.
  page: {
    allCountries: "All countries",
    gymFallback: "The centre",
    friends: "Friends",
  },
  // Under the title: how the category is counted.
  explanations: {
    flidWorkouts: "Every finished workout in the period, of any type.",
    flidStreak:
      "Weeks in a row with at least {count} finished workouts, Monday to Sunday. This week counts once it reaches {count}. A sick week breaks the run here.",
    powerlifting:
      "Best single-rep bench press, squat and deadlift, added up. A missing lift counts as 0, and rejected lifts don't count.",
    powerliftingVideo:
      "Only lifts with a verified video: best single-rep bench press, squat and deadlift, added up. A missing lift counts as 0.",
    fremgang:
      "Biggest rise in estimated 1RM over the last {days} days against the {days} before, from sets of 1–{reps} reps. At least {sets} sets in both.",
    calisthenics:
      "Most reps in one set without added weight, times difficulty: pull-ups × {pullups}, dips × {dips}, push-ups × {pushups}. Added up.",
  },
  empty: {
    title: "Nobody on the list yet",
    friendsTitle: "Nobody you follow is on the list yet",
    members: "Everyone who trained at a centre here in the last {activeDays} days takes part.",
    membersGym: "Everyone who trained here in the last {activeDays} days takes part.",
    flidWorkouts: "Every finished workout in the period counts.",
    flidStreak: "A week counts once it has at least {count} finished workouts.",
    powerlifting: "One single-rep bench press, squat or deadlift gives you a total.",
    powerliftingVideo: "Only lifts with a verified video count here.",
    fremgang: "It takes at least {sets} sets of the same lift in both {days}-day periods.",
    calisthenics: "A set of pull-ups, dips or push-ups without added weight earns points.",
  },
  errors: {
    title: "Couldn't load the list",
    body: "Check your connection and try again.",
    refreshFailed: "The list couldn't be updated.",
  },
  unavailable: {
    title: "Not available yet",
    body: "Category rankings aren't switched on yet. Check back later.",
  },
  // Your own row, at the bottom.
  me: {
    gap: "{gap} to #{rank}",
    tied: "Level with #{rank}",
    leading: "You're in the lead",
    homeGymRank: "#{rank} at your centre",
    notOnListTitle: "You're not on this list",
    noValueTitle: "You're not on the list yet",
    notOnListBody: "It counts people who trained at a centre here in the last {activeDays} days.",
    notOnListBodyGym: "It counts people who trained here in the last {activeDays} days.",
  },
  // The line under a name: on the list, and under #1 on a centre's card.
  rows: {
    streak: { one: "{count} week in a row", other: "{count} weeks in a row" },
    last: "trained {when}",
    powerlifting: "B {bench} · S {squat} · D {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Pull {pullups} · Dip {dips} · Push {pushups}",
  },
  // "Your progress" and "Your points".
  personal: {
    progress: "Your progress",
    points: "Your points",
    pullups: "Pull",
    dips: "Dip",
    pushups: "Push",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Period",
    age: "Age",
    ageHint: "From the birth year in your profile. Without one you're only under All ages.",
    weightClass: "Weight class",
    weightClassStatic: "Body weight can't be set yet, so everyone is under All weights.",
    onlyVideoHint: "Shows only lifts with a verified video",
  },
  // Powerlifting's three buttons at the bottom.
  lifts: {
    title: "Each lift on its own",
    bench: "Bench press",
    squat: "Squat",
    deadlift: "Deadlift",
    gymHint: "Opens the centre's list for the lift",
    nationalHint: "Opens the national list for the lift",
  },
};
