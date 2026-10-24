// The Train tab's calendar block: last week and this week.
//
// The rest of the block reuses the calendar's own texts: calendar.title,
// calendar.workoutsHeading and the weekday row's home.weekdays.
export default {
  // The line under "Calendar". With an active program the week is counted
  // against what is planned; without one, only what was done.
  subtitle: {
    program: {
      zero: "Inget planerat den här veckan",
      one: "{done} av {count} pass den här veckan",
      other: "{done} av {count} pass den här veckan",
    },
    split: {
      one: "{count} pass den här veckan",
      other: "{count} pass den här veckan",
    },
  },
};
