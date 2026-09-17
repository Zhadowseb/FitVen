// Centres: the Centres list, one centre's leaderboard, one exercise's ranking
// (in a centre and across Denmark), the Change centre sheet, the lift
// verification sheet and the gym service's user-facing errors. Keep in step
// with ../da/gyms.js.
export default {
  // Words several of these screens share.
  centre: "Centre",
  yourCentre: "your centre",
  weightKg: "{weight} kg",
  noLiftsYet: "No lifts yet",
  searchFailed: "Search failed.",
  searchCentresA11y: "Search centres",
  gymLineYourCentre: "{gym} · your centre",

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

  // The Centres screen: map, search, strongest in Denmark, nearest.
  list: {
    eyebrow: "Social",
    title: "Centres",
    centreCount: { one: "{count} centre", other: "{count} centres" },
    searchPlaceholder: "Search centre, chain or city",
    nearbyCount: { one: "{count} centre nearby", other: "{count} centres nearby" },
    expandMap: "Expand map",
    shrinkMap: "Shrink map",
    locateMe: "Centre the map on your location",
    locationUnavailable: "Could not find your location. Check that location is on for FitVen.",
    yoursBadge: "YOURS",
    unavailableTitle: "Centres unavailable",
    signInToSee: "Sign in to see centres.",
    loadFailed: "Could not load centres.",
    results: "Results",
    nearest: "Nearest",
    foundCount: "{count} found",
    membersEyebrow: "members · 90 days",
    trainedEyebrow: "workouts · 90 days",
    noMatchTitle: "No centres match",
    noMatchBody: "Try the chain, the city or part of the centre's name.",
    noCentresTitle: "No centres yet",
    noCentresBody: "Centres appear here once they have been imported.",
    showAllNearby: "Show all nearby",
  },

  strongest: {
    title: "Strongest in Denmark",
    verifiedOnly: "Verified only",
    seeAll: "See all of Denmark",
  },

  // One centre: hero, the big three, more exercises.
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
    exerciseLeaderboardA11y: "{exercise} leaderboard",
    recordHolders: {
      one: "{count} person has a record here",
      other: "{count} people have a record here",
    },
    noRecordYet:
      "Nobody has a record here yet. Finish a workout with this exercise inside the centre and yours is first.",
    myRank: "· #{rank} of {total}",
    notRanked: "· not ranked",
    gapToTop: "{gap} to #1",
    notOnList: "You · not on the list",
    moreExercises: "More exercises",
    moreHint: "#1 at the centre · your place",
    topLine: "{name} · {weight} kg",
    showAllExercises: "Show all {count} exercises",
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
