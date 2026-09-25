// The Explore tab: the front page, its search and the ways in. Keep in step
// with ../da/explore.js.
export default {
  title: "Explore",
  searchPlaceholder: "Search centres and people",
  tiles: {
    gyms: "Centres",
    gymsSub: "Find your centre",
    gymsCount: { one: "{value} in Denmark", other: "{value} in Denmark" },
    programs: "Programs",
    programsCount: { one: "{value} to choose from", other: "{value} to choose from" },
    exercises: "Exercises",
    exercisesCount: { one: "{value} from users", other: "{value} from users" },
    records: "Records",
    recordsSub: "Denmark's top 100",
  },
  programs: {
    title: "Programs",
    emptyTitle: "No programs to choose from yet",
    emptyBody: "Hand-picked programs will be here to follow as they are.",
  },
  customExercises: {
    title: "Exercises others have made",
    emptyTitle: "No shared exercises yet",
    emptyBody: "When people share the exercises they have made, you can find them and add them to your own here.",
  },
  sections: {
    yourGym: "Your centre",
    change: "Change",
    centerPosts: "Posts from centres",
  },
  centerPostLabel: "{name}: {title}, at {gym}",
  centerPosts: {
    eyebrow: "Posts from",
    fallbackTitle: "A centre",
    emptyTitle: "No posts from this centre yet",
    emptyBody: "When people you can see post a workout done here, it shows up here.",
    failed: "The posts could not be loaded. Try again in a moment.",
  },
  yourGym: {
    newRecords: { one: "{value} new record", other: "{value} new records" },
    noNewRecords: "No new records since your last visit",
    latestLabel: "Newest record: {name}, {exercise}, {weight} kg",
    pick: "Choose your centre",
    pickDetail: "See its records and who trains there",
  },
  search: {
    hint: {
      all: "Type at least two letters to search centres and people.",
      gyms: "Type at least two letters to search centres.",
      people: "Type at least two letters to search for people.",
    },
    placeholder: {
      all: "Search centres and people",
      gyms: "Search centres",
      people: "Search people",
    },
    scope: {
      all: "Both",
      gyms: "Centres",
      people: "People",
    },
    failed: "The search didn't go through. Try again in a moment.",
    nothing: "Nothing found for “{query}”.",
    clear: "Clear the search",
    gyms: "Centres",
    people: "People",
    following: "You follow them",
    allPeople: "See everyone and follow",
  },
};
