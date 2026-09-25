// Træn-fanens kalenderblok: sidste uge og denne uge. Holdes i trit med
// ../en/trainCalendar.js.
//
// Resten af blokken genbruger kalenderens egne tekster: calendar.title,
// calendar.workoutsHeading og ugedagsrækkens home.weekdays.
export default {
  // Linjen under "Kalender". Med et aktivt program tælles ugen mod det
  // planlagte; uden et tælles kun det, der er lavet.
  subtitle: {
    program: {
      zero: "Intet planlagt denne uge",
      one: "{done} af {count} træning denne uge",
      other: "{done} af {count} træninger denne uge",
    },
    split: {
      one: "{count} træning denne uge",
      other: "{count} træninger denne uge",
    },
  },
};
