// The Train tab's calendar block: last week and this week. Keep in step with
// ../da/trainCalendar.js.
//
// The rest of the block reuses the calendar's own texts: calendar.title,
// calendar.workoutsHeading and the weekday row's home.weekdays.
export default {
  // The line under "Calendar". With an active program the week is counted
  // against what is planned; without one, only what was done.
  subtitle: {
    program: {
      zero: "Nothing planned this week",
      one: "{done} of {count} workout this week",
      other: "{done} of {count} workouts this week",
    },
    split: {
      one: "{count} workout this week",
      other: "{count} workouts this week",
    },
  },
};
