// The Explore tab: the front page, its search and the ways in. Keep in step
// with ../da/explore.js.
export default {
  title: "Explore",
  searchPlaceholder: "Search centres and people",
  openSocial: "Followers and friends",
  openSocialNew: { one: "Followers and friends, {count} new follower", other: "Followers and friends, {count} new followers" },
  tiles: {
    gyms: "Centres",
    gymsSub: "Find your centre",
    gymsCount: { one: "{value} in Denmark", other: "{value} in Denmark" },
    records: "Records",
    recordsSub: "Denmark's top 100",
  },
  sections: {
    yourGym: "Your centre",
    open: "Open",
  },
  yourGym: {
    newRecords: { one: "{value} new record", other: "{value} new records" },
    noNewRecords: "No new records since your last visit",
    latestLabel: "Newest record: {name}, {exercise}, {weight} kg",
    pick: "Choose your centre",
    pickDetail: "See its records and who trains there",
  },
  search: {
    hint: "Type at least two letters to search centres and people.",
    failed: "The search didn't go through. Try again in a moment.",
    nothing: "Nothing found for “{query}”.",
    clear: "Clear the search",
    gyms: "Centres",
    people: "People",
    following: "You follow them",
    allPeople: "See everyone and follow",
  },
};
