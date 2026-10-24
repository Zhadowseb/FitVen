// En annens profil - siden du havner på fra et navn - og din egen
// sett slik andre ser den.
export default {
  menu: {
    open: "Valg for profil",
    share: "Del profil",
  },
  following: "Følger",
  share: {
    action: "Del",
    // Det finnes ingen profil på nettet å lenke til, så brukernavnet - som
    // finner dem i søk - er det meldingen bærer.
    message: "{name} på FitVen (@{username})",
  },
  // Etter navnet på senteret, når det også er seerens senter.
  yourCentre: "· senteret ditt",
  // Hintet på et navn eller et bilde som åpner noens profil.
  opensProfile: "Åpner profilen deres",
  stats: {
    followers: "Følgere",
    following: "Følger",
    workouts: "Økter",
  },
  records: {
    title: "Rekorder",
    rankAt: "#{rank} på {gym}",
    rank: "#{rank} på senteret",
    notRanked: "Ikke rangert",
  },
  activity: {
    title: "Aktivitet",
    perWeek: { one: "økt per uke", other: "økter per uke" },
    footnote: "{count} uker · siste uke utheves",
    // Leses opp i stedet for stolpene, som ikke har egne tall.
    barsLabel: "Økter per uke de siste {count} ukene, eldste først: {weeks}",
  },
  posts: {
    title: "Innlegg",
    seeAll: "Se alle {count}",
    openPost: "Åpne innlegget {title}",
    untitled: "Økt",
    failed: "Innleggene kunne ikke lastes.",
  },
  preview: {
    title: "Slik ser andre deg",
    banner: "Forhåndsvisning. Slik ser profilen din ut for noen som ikke følger deg.",
  },
  // Ikke funnet og blokkert leses likt, med vilje.
  unavailable: {
    title: "Denne profilen er ikke tilgjengelig",
    body: "Den kan ha blitt slettet, eller den kan ikke åpnes akkurat nå.",
  },
  error: {
    title: "Profilen kunne ikke lastes",
    body: "Sjekk tilkoblingen din og prøv igjen.",
  },
  // Hele listen bak "Se alle".
  userPosts: {
    eyebrow: "Innlegg av",
    fallbackTitle: "Innlegg",
    emptyTitle: "Ingen innlegg å vise",
    emptyBody: "Når de legger ut en økt du kan se, dukker den opp her.",
    failed: "Innleggene kunne ikke lastes. Prøv igjen om litt.",
  },
};
