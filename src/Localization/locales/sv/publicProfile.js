// Somebody else's profile - the page you land on from a name - and your own
// seen as others see it.
export default {
  menu: {
    open: "Profilalternativ",
    share: "Dela profil",
  },
  following: "Följer",
  share: {
    action: "Dela",
    // There is no profile on the web to link to, so the username - which finds
    // them in search - is what the message carries.
    message: "{name} på FitVen (@{username})",
  },
  // After the gym's name, when it is the viewer's gym too.
  yourCentre: "· ditt gym",
  // The hint on a name or a picture that opens somebody's profile.
  opensProfile: "Öppnar deras profil",
  stats: {
    followers: "Följare",
    following: "Följer",
    workouts: "Pass",
  },
  records: {
    title: "Rekord",
    rankAt: "#{rank} på {gym}",
    rank: "#{rank} på gymmet",
    notRanked: "Inte rankad",
  },
  activity: {
    title: "Aktivitet",
    perWeek: { one: "pass per vecka", other: "pass per vecka" },
    footnote: "{count} veckor · senaste veckan markerad",
    // Read out instead of the bars, which carry no numbers of their own.
    barsLabel: "Pass per vecka de senaste {count} veckorna, äldst först: {weeks}",
  },
  posts: {
    title: "Inlägg",
    seeAll: "Visa alla {count}",
    openPost: "Öppna inlägget {title}",
    untitled: "Pass",
    failed: "Inläggen kunde inte laddas.",
  },
  preview: {
    title: "Så ser andra dig",
    banner: "Förhandsvisning. Så här ser din profil ut för någon som inte följer dig.",
  },
  // Not found and blocked read the same, on purpose.
  unavailable: {
    title: "Den här profilen är inte tillgänglig",
    body: "Den kan ha tagits bort, eller så går den inte att öppna just nu.",
  },
  error: {
    title: "Profilen kunde inte laddas",
    body: "Kontrollera din anslutning och försök igen.",
  },
  // The full list behind "See all".
  userPosts: {
    eyebrow: "Inlägg av",
    fallbackTitle: "Inlägg",
    emptyTitle: "Inga inlägg att visa",
    emptyBody: "När de lägger upp ett pass som du kan se visas det här.",
    failed: "Inläggen kunde inte laddas. Försök igen om en stund.",
  },
};
