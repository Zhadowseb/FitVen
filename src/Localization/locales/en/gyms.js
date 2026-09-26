// Centres: the Centres screens (all countries, a country, a region), one
// centre's page, one exercise's ranking (in a centre and across Denmark), the
// Change centre sheet, the lift verification sheet and the gym service's
// user-facing errors. Keep in step with ../da/gyms.js.
export default {
  // Words several of these screens share.
  centre: "Centre",
  yourCentre: "your centre",
  weightKg: "{weight} kg",
  noLiftsYet: "No lifts yet",
  searchFailed: "Search failed.",
  searchCentresA11y: "Search centres",

  // The Centres screens: all countries, a country, a region.
  global: "Global",
  title: "Centres",
  chooseCountry: "Choose country",
  search: "Search for a centre",
  // {where} carries its preposition: "on Zealand".
  searchIn: "Search for a centre {where}",
  myGym: "Your centre",
  members: {
    one: "{count} person trains here · you follow {following} of them",
    other: "{count} people train here · you follow {following} of them",
  },
  allCountries: "All countries",
  fromLocation: "from your location",
  countriesWithLifts: "Countries with lifts",
  onlyWithLifts: "Only countries with logged lifts are shown.",
  regionsIn: "Regions {where}",
  gymsIn: "Centres {where}",
  categories: "Categories",
  sortedByActivity: "by what's trained most here",
  // A centre as a place, for "not at {gym}".
  atGym: "at {gym}",
  // A place with no phrase of its own.
  inPlace: "in {place}",
  // Denmark's four regions with their prepositions, for when the server
  // sends a region without one. Keys are gym.region_key.
  regionsWhere: {
    sjaelland: "on Zealand",
    jylland: "in Jutland",
    fyn: "on Funen",
    bornholm: "on Bornholm",
  },

  counts: {
    centres: { one: "{value} centre", other: "{value} centres" },
    lifters: { one: "{value} lifter", other: "{value} lifters" },
  },

  // All countries: the country you are in, above the list.
  location: {
    title: "Your location",
    noLifts: "No lifts logged here yet",
  },

  // What a level says when it cannot show itself.
  levels: {
    loadFailed: "Could not load centres.",
    unavailableTitle: "Centres unavailable",
    notYetTitle: "On its way",
    notYetBody:
      "Categories and regions aren't set up yet. You can still search for a centre and open your own.",
    cardsNotYet: "Categories aren't set up yet.",
    cardsFailed: "Could not load the categories.",
    noCountries: "No country has logged lifts yet.",
    noRegions: "The centres here aren't split into regions yet.",
    noGyms: "No centres {where} yet.",
  },

  // Search results, in place of the level.
  results: {
    title: "Results",
    count: "{count} found",
    noMatchTitle: "No centres match",
    noMatchBody: "Try the chain, the city or part of the centre's name.",
  },

  // One category on a card: on a level and in one centre.
  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    // {where} carries its preposition: "#4 on Zealand".
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} of {total}",
    notRanked: "not on the list yet",
    empty: "Nobody is on the list yet.",
    a11yTop: "Number 1: {name}, {value}",
    a11yHint: "Opens the whole list",
  },

  scope: {
    centre: "Centre",
    friends: "Friends",
    centreWithCount: "Centre · {count}",
    friendsWithCount: "Friends · {count}",
  },

  unit: {
    bodyweight: "×BW",
  },

  // The pill on a lift: verified, pending, none, and the owner-only rejected badge.
  status: {
    verified: "Video verified · {count}",
    pending: "Video pending · {count}/{required}",
    noVideo: "No video",
    rejected: "Rejected {count}",
  },

  // One line of a ranked list.
  row: {
    yourCentre: "· your centre",
    reviewA11y: "Review this lift's video",
  },

  // One centre: hero, its place, the four categories, every exercise.
  overview: {
    notFound: "That centre could not be found.",
    loadFailed: "Could not load the centre.",
    unavailableTitle: "Centre unavailable",
    changeCentre: "Change centre",
    yourCentre: "Your centre",
    membersTrainHere: { one: "{count} person trains here", other: "{count} people train here" },
    youFollow: "you follow {count} of them",
    reviewQueue: {
      one: "{count} lift is waiting for a verdict",
      other: "{count} lifts are waiting for a verdict",
    },
    reviewHint: "Watch the video and approve or reject it.",
    allExercises: "All exercises",
    // The three featured lifts, and how many more the centre ranks.
    allExercisesDetail: {
      zero: "Bench, squat and deadlift",
      one: "Bench, squat, deadlift and {count} more",
      other: "Bench, squat, deadlift and {count} more",
    },
  },

  // The Change centre sheet.
  change: {
    body: "Your centre is where you have trained most in the last 90 days, unless you pick one here.",
    searchPlaceholder: "Search every centre",
    loadFailed: "Could not load your centres.",
    saveFailed: "Could not change your centre.",
    resultCount: { one: "{count} result", other: "{count} results" },
    automatic: "Automatic",
    automaticMeta: "Where you train most",
    trainedHere: "Where you have trained",
    emptyBody: "Finish a workout inside a centre and it shows up here. Or search above.",
    gymMeta: { one: "{chain} · {count} workout", other: "{chain} · {count} workouts" },
  },

  // One exercise ranked, in a centre or across Denmark.
  exercise: {
    titleFallback: "Exercise",
    nationalEyebrow: "All centres · Denmark",
    nationalNote: "Across centres a lift needs an approved video to count.",
    unavailableTitle: "Ranking unavailable",
    loadFailed: "Could not load the ranking.",
    loadMoreFailed: "Could not load more.",
    pickExercise: "Pick an exercise.",
    legend:
      "Video verified: three members of the centre approved the video. Video pending: a video is attached and waiting for votes. No video: the lift counts at the centre but not across Denmark.",
    empty: {
      noBodyweightTitle: "No bodyweight on record",
      noBodyweightBody:
        "Ranking by bodyweight needs a bodyweight on the lift, which nobody here has recorded.",
      noFriendsTitle: "None of your friends lift here yet",
      noVerifiedTitle: "No verified lifts yet",
      noVerifiedBody: "Attach a video to a lift and have three members of your centre approve it.",
      noLiftsBody: "Finish a workout with this exercise inside the centre and the first lift is yours.",
    },
    pinned: {
      pendingTitle: "Not ranked · your video is waiting for votes",
      noVideoTitle: "Not ranked · your lift needs a video",
      body: "{weight} kg at {gym}",
    },
  },

  // Attaching a video to one's own lift.
  video: {
    attachTitle: "Attach a video",
    attachBody:
      "Up to {seconds} seconds. Members of the centre watch it and vote; three approvals verify the lift.",
    attachA11y: "Attach a video to your lift",
    recordNow: "Record now",
    recordNowBody: "Open the camera.",
    chooseLibrary: "Choose from library",
    chooseLibraryBody: "A video you already have.",
    confirmTitle: "Use this video?",
    confirmBody: "It replaces any video already on this lift and resets its votes.",
    confirmBodyWithDuration: {
      one: "{count} second. It replaces any video already on this lift and resets its votes.",
      other: "{count} seconds. It replaces any video already on this lift and resets its votes.",
    },
    use: "Use",
    cameraPermission: "Camera access is needed to record a video.",
    libraryPermission: "Photo library access is needed to pick a video.",
    pickerFailed: "Could not open the video picker.",
    attached: "Video attached. Members of the centre can now verify it.",
    attachedNotified: {
      one: "Video attached. {count} member has been asked to verify it.",
      other: "Video attached. {count} members have been asked to verify it.",
    },
    attachFailed: "Could not attach the video.",
  },

  // The verification sheet.
  review: {
    eyebrow: "VERIFY LIFT",
    queueTitle: "Lifts to review",
    title: "{exercise} · {weight} kg",
    counter: "{index} of {total}",
    loadFailed: "Could not load lifts to review.",
    voteFailed: "Could not record your vote.",
    allSeen: "Thanks, you have seen them all.",
    emptyTitle: "Nothing waiting for review",
    emptyBody: "When somebody at this centre attaches a video to a lift, it shows up here.",
    playVideo: "Play video",
    pauseVideo: "Pause video",
    videoUnavailable: "Video unavailable",
    videoNeedsBuild: "Video playback needs the 2.0 development build",
    fromPrevious: "From {previous} kg · +{gain} kg",
    becomesRank: "becomes #{rank} at the centre",
    approvedCount: "{count} approved",
    rejectedCount: "· {count} rejected",
    toGo: "{count} to go",
    ownLiftWaiting: {
      one: "Your lift is waiting for {count} more approval.",
      other: "Your lift is waiting for {count} more approvals.",
    },
    cannotVote: "Only people who have trained at this centre in the last 90 days can vote.",
    whyReject: "Why reject it?",
    reject: "Reject",
    approve: "Approve lift",
    rules:
      "{approvals} approvals from other members verify a lift. {rejections} rejections remove it from the ranking. You cannot vote on your own lifts.",
  },

  // Keys are the `value` fields of REJECTION_REASONS in Services/gymService.js.
  rejectReasons: {
    depth: "Not deep enough",
    lockout: "No lockout",
    assist: "Assisted or spotted",
    weight: "Weight does not match",
    other: "Something else",
  },

  // Errors the gym service throws; screens show error.message as it is.
  errors: {
    generic: "Something went wrong with centres.",
    signInToChoose: "You need to be signed in to choose a centre.",
    signInToVote: "You need to be signed in to vote.",
    signInToAttach: "You need to be signed in to attach a video.",
    pickVideoFirst: "Pick a video first.",
    videoTooLong: "Keep the video under {seconds} seconds.",
    videoTooLarge: "The video must stay under 50 MB.",
    videoUnreadable: "Could not read the selected video.",
    videoEmpty: "The selected video was empty.",
  },
};
