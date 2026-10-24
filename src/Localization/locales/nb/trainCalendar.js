// Kalenderblokken i Trening-fanen: forrige uke og denne uken.
//
// Resten av blokken bruker kalenderens egne tekster: calendar.title,
// calendar.workoutsHeading og ukedagsraden home.weekdays.
export default {
  // Linjen under "Kalender". Med et aktivt program telles uken mot det som er
  // planlagt; uten, bare det som er gjort.
  subtitle: {
    program: {
      zero: "Ingenting planlagt denne uken",
      one: "{done} av {count} økt denne uken",
      other: "{done} av {count} økter denne uken",
    },
    split: {
      one: "{count} økt denne uken",
      other: "{count} økter denne uken",
    },
  },
};
