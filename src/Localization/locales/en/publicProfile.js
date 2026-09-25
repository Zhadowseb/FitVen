// Somebody else's profile - the page you land on from a name - and your own
// seen as others see it. Keep in step with ../da/publicProfile.js.
export default {
  menu: {
    open: "Profile options",
    share: "Share profile",
  },
  following: "Following",
  share: {
    action: "Share",
    // There is no profile on the web to link to, so the username - which finds
    // them in search - is what the message carries.
    message: "{name} on FitVen (@{username})",
  },
  // After the centre's name, when it is the viewer's centre too.
  yourCentre: "· your centre",
  // The hint on a name or a picture that opens somebody's profile.
  opensProfile: "Opens their profile",
  stats: {
    followers: "Followers",
    following: "Following",
    workouts: "Workouts",
  },
  records: {
    title: "Records",
    rankAt: "#{rank} at {gym}",
    rank: "#{rank} at the centre",
    notRanked: "Not ranked",
  },
  activity: {
    title: "Activity",
    perWeek: { one: "workout per week", other: "workouts per week" },
    footnote: "{count} weeks · latest week highlighted",
    // Read out instead of the bars, which carry no numbers of their own.
    barsLabel: "Workouts per week over the last {count} weeks, oldest first: {weeks}",
  },
  posts: {
    title: "Posts",
    seeAll: "See all {count}",
    openPost: "Open the post {title}",
    untitled: "Workout",
    failed: "The posts could not be loaded.",
  },
  preview: {
    title: "How others see you",
    banner: "Preview. This is how your profile looks to someone who doesn't follow you.",
  },
  // Not found and blocked read the same, on purpose.
  unavailable: {
    title: "This profile isn't available",
    body: "It may have been deleted, or it can't be opened right now.",
  },
  error: {
    title: "The profile couldn't be loaded",
    body: "Check your connection and try again.",
  },
  // The full list behind "See all".
  userPosts: {
    eyebrow: "Posts by",
    fallbackTitle: "Posts",
    emptyTitle: "No posts to show",
    emptyBody: "When they post a workout you can see, it shows up here.",
    failed: "The posts could not be loaded. Try again in a moment.",
  },
};
