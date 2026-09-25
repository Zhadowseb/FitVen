// En andens profil - siden man lander på fra et navn - og din egen, set
// som andre ser den. Holdes i trit med ../en/publicProfile.js.
export default {
  menu: {
    open: "Profilvalg",
    share: "Del profil",
  },
  following: "Følger",
  share: {
    action: "Del",
    message: "{name} på FitVen (@{username})",
  },
  yourCentre: "· jeres center",
  opensProfile: "Åbner profilen",
  stats: {
    followers: "Følgere",
    following: "Følger",
    workouts: "Træninger",
  },
  records: {
    title: "Rekorder",
    rankAt: "#{rank} i {gym}",
    rank: "#{rank} i centret",
    notRanked: "Ikke rangeret",
  },
  activity: {
    title: "Aktivitet",
    perWeek: { one: "træning pr. uge", other: "træninger pr. uge" },
    footnote: "{count} uger · seneste uge fremhævet",
    barsLabel: "Træninger pr. uge de seneste {count} uger, ældste først: {weeks}",
  },
  posts: {
    title: "Opslag",
    seeAll: "Se alle {count}",
    openPost: "Åbn opslaget {title}",
    untitled: "Træning",
    failed: "Opslagene kunne ikke indlæses.",
  },
  preview: {
    title: "Sådan ser andre dig",
    banner: "Forhåndsvisning. Sådan ser din profil ud for en, der ikke følger dig.",
  },
  unavailable: {
    title: "Profilen er ikke tilgængelig",
    body: "Den kan være slettet, eller den kan ikke åbnes lige nu.",
  },
  error: {
    title: "Profilen kunne ikke indlæses",
    body: "Tjek din forbindelse, og prøv igen.",
  },
  userPosts: {
    eyebrow: "Opslag fra",
    fallbackTitle: "Opslag",
    emptyTitle: "Ingen opslag at vise",
    emptyBody: "Når de deler en træning, du kan se, dukker den op her.",
    failed: "Opslagene kunne ikke indlæses. Prøv igen om lidt.",
  },
};
