// Keep in step with ../en/social.js.
export default {
  todaysActivity: "Dagens aktivitet",
  discover: "Opdag",
  findFriends: "Find venner",
  searchForFriends: "Søg efter venner",
  centres: "Centre",
  centresAndLeaderboards: "Centre og ranglister",
  leaderboardsAt: "Ranglister · {gym}",
  leaderboardsWhereYouTrain: "Ranglister hvor du træner",
  yourWorkoutPosts: "Dine træningsopslag",
  heroPosts: {
    eyebrow: "Din træning",
    title: "Opslag",
  },

  followersLabel: { one: "følger", other: "følgere" },
  followingLabel: "følger",
  followersCount: { one: "{count} følger", other: "{count} følgere" },
  followingCount: "{count} følger",

  relationship: {
    followers: "Følgere",
    following: "Følger",
    blocked: "Blokeret",
    titleWithCount: "{title} ({count})",
    loadingFollowers: "Indlæser følgere...",
    loadingFollowing: "Indlæser dem, du følger...",
    loadingBlocked: "Indlæser blokerede...",
    loadFollowersFailed: "Kunne ikke indlæse følgere.",
    loadFollowingFailed: "Kunne ikke indlæse dem, du følger.",
    loadBlockedFailed: "Kunne ikke indlæse blokerede konti.",
    noFollowers: "Ingen følger dig endnu.",
    noFollowing: "Du følger ikke nogen endnu.",
    noBlocked: "Du har ikke blokeret nogen.",
    backToFollowers: "Tilbage til følgere",
    blockedAccounts: "Blokerede konti",
  },

  follow: "Følg",
  followingCheck: "Følger ✓",
  saving: "Gemmer...",
  block: "Bloker",
  unblock: "Fjern blokering",
  blockNamed: "Bloker {name}",
  unblockNamed: "Fjern blokering af {name}",
  thisPerson: "denne person",
  thisPersonSubject: "Denne person",

  unfollowConfirm: {
    title: "Følg ikke længere?",
    message:
      "{name} vises ikke længere i dit feed. Du kan følge dem igen senere.",
    confirm: "Følg ikke længere",
    cancel: "Følg stadig",
  },
  blockConfirm: {
    title: "Bloker denne person?",
    message:
      "{name} vil ikke længere følge dig, og du vil ikke længere følge dem. De får ikke besked, og de kan ikke følge dig igen eller finde dig i søgningen.",
  },
  unblockConfirm: {
    title: "Fjern blokering af denne person?",
    message:
      "{name} vil kunne finde dig og følge dig igen. Ingen af jer begynder at følge den anden.",
  },

  report: {
    action: "Anmeld",
    reportNamed: "Anmeld {name}",
    title: "Anmeld {name}?",
    message:
      "Fortæl os, hvad der er galt. Anmeldelser læses af udvikleren og vises ikke for den person, du anmelder.",
    send: "Send anmeldelse",
    notePlaceholder: "Er der andet, vi bør vide? (valgfrit)",
    sentTitle: "Anmeldelse sendt",
    sentMessage:
      "Tak. Vi kigger på {name}. Hvis du helst slet ikke vil se dem, så bloker dem også — en anmeldelse gør ikke det af sig selv.",
    thatAccount: "den konto",
    reasons: {
      spam: "Spam eller reklame",
      harassment: "Chikane eller mobning",
      inappropriate: "Upassende indhold",
      impersonation: "Udgiver sig for at være en anden",
      other: "Noget andet",
    },
  },

  search: {
    placeholder: "Søg på navn eller brugernavn",
    signInToSearch: "Log ind for at søge efter andre brugere.",
    loadFailed: "Kunne ikke indlæse brugersøgningen lige nu.",
    unavailable: "Søgning ikke tilgængelig",
    loadingPeople: "Indlæser personer...",
    noMatch: 'Ingen match for "{query}"',
    noMatchBody: "Tjek stavningen, eller søg efter brugernavnet i stedet.",
    emptyTitle: "Søg efter nogen",
    emptyBody:
      "Skriv mindst {count} tegn af et navn eller brugernavn. Brugernavne ser sådan ud: navn#1234.",
  },

  posts: {
    title: "Dine træninger",
    filters: {
      all: "Alle",
      posted: "Lagt op",
      notPosted: "Ikke lagt op",
    },
    postedOf: "{posted} af {total} lagt op",
    statusUnavailable: "Opslagsstatus ikke tilgængelig",
    statusIsUnavailable: "Opslagsstatus er ikke tilgængelig",
    statusUnavailablePull:
      "Opslagsstatus er ikke tilgængelig. Træk ned for at prøve igen.",
    loadFailed: "Dine træninger kunne ikke indlæses.",
    postFailed: "Træningen kunne ikke lægges op.",
    deleteFailed: "Opslaget kunne ikke slettes.",
    emptyTitle: "Ingen afsluttede træninger endnu",
    emptyBody:
      "Afslut en styrketræning, så vises den her, klar til at blive lagt op.",
    noPostedWorkouts: "Ingen træninger lagt op",
    noUnpostedWorkouts: "Ingen træninger, der ikke er lagt op",
    switchFilter: "Skift filter for at se resten.",
    workoutFallback: "Træning",
    postedToFeed: "Lagt op i dit feed",
    notPostedYet: "Ikke lagt op endnu",
    postToFeed: "Læg op i feed",
    editNote: "Rediger note",
    updatePostData: "Opdater opslagets data",
    openWorkout: "Åbn træning",
    removeFromFeed: "Fjern fra feed",
    removeConfirm: {
      title: "Fjern fra feed?",
      message: "Træningen bliver i din log. Kun opslaget fjernes.",
      confirm: "Fjern opslag",
      removing: "Fjerner...",
    },
  },

  errors: {
    loadActivityFailed: "Kunne ikke indlæse dagens aktivitet.",
    updateBlockFailed: "Kunne ikke opdatere blokeringen.",
    sendReportFailed: "Kunne ikke sende anmeldelsen.",
    updateFollowFailed: "Kunne ikke opdatere følgestatus.",
    signInToLoadSocial: "Du skal være logget ind for at indlæse sociale data.",
    signInToUpdateProfile: "Du skal være logget ind for at opdatere din profil.",
    signInToUpdateBirthDate:
      "Du skal være logget ind for at opdatere din fødselsdato.",
    signInToUpdateMaxHeartRate:
      "Du skal være logget ind for at opdatere din makspuls.",
    signInToUpdatePhoto:
      "Du skal være logget ind for at opdatere dit profilbillede.",
    signInToSearch: "Du skal være logget ind for at søge efter brugere.",
    signInToLoadCircle: "Du skal være logget ind for at indlæse din kreds.",
    signInToSeeBlocked:
      "Du skal være logget ind for at se, hvem du har blokeret.",
    signInToAcceptPrivacy:
      "Du skal være logget ind for at acceptere privatlivspolitikken.",
    missingPrivacyVersion: "Privatlivspolitikkens version mangler.",
    birthDateInvalid: "Fødselsdatoen er ugyldig.",
    birthDateFuture: "Fødselsdatoen kan ikke ligge i fremtiden.",
    birthDateTooEarly: "Fødselsdatoen skal være den 01.01.1900 eller senere.",
    usernameBaseInvalid: "Brugernavnets basis er ugyldig.",
    usernameBaseExhausted:
      'Brugernavnet "{usernameBase}" har ikke flere ledige 4-cifrede koder.',
    usernameTagUnavailable:
      "Kunne ikke reservere en brugernavnskode lige nu. Prøv igen.",
    displayNameEmpty: "Visningsnavnet kan ikke være tomt.",
    displayNameTooLong: "Visningsnavnet må højst være {count} tegn.",
    bioTooLong: "Biografien må højst være {count} tegn.",
    maxHeartRateRange: "Makspuls skal være et helt tal fra 60 til 250.",
    maxHeartRateSourceInvalid: "Vælg en gyldig kilde til makspuls.",
    pickImageFirst: "Vælg et billede, før du uploader et profilbillede.",
    photoTooLarge: "Profilbilledet må højst være 3 MB.",
    imageReadFailed: "Kunne ikke læse det valgte billede.",
    imageEmpty: "Det valgte billede var tomt.",
    privateSettingsUnavailable:
      "Private profilindstillinger er ikke tilgængelige.",
    privateSettingsSaveFailed: "Private profilindstillinger kunne ikke gemmes.",
    missingUserFollowCounts: "Der mangler brugeroplysninger til følgertal.",
    missingUserFollowers: "Der mangler brugeroplysninger til følgere.",
    missingUserFollowing: "Der mangler brugeroplysninger til dem, du følger.",
    missingUserFollow: "Der mangler brugeroplysninger til at følge.",
    missingUserUnfollow:
      "Der mangler brugeroplysninger til at stoppe med at følge.",
    missingUserBlock: "Der mangler brugeroplysninger til blokering.",
    missingUserUnblock:
      "Der mangler brugeroplysninger til at fjerne blokeringen.",
    missingUserReport: "Der mangler brugeroplysninger til anmeldelse.",
    followSelf: "Du kan ikke følge dig selv.",
    blockSelf: "Du kan ikke blokere dig selv.",
    reportSelf: "Du kan ikke anmelde dig selv.",
    reportReasonRequired: "Vælg en grund til anmeldelsen.",
  },
};
