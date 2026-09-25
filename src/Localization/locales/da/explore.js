// Udforsk-fanen: forsiden, dens søgning og vejene ind. Holdes i trit med
// ../en/explore.js.
export default {
  title: "Udforsk",
  searchPlaceholder: "Søg centre og personer",
  tiles: {
    gyms: "Centre",
    gymsSub: "Find dit center",
    gymsCount: { one: "{value} i Danmark", other: "{value} i Danmark" },
    programs: "Programmer",
    programsCount: { one: "{value} at vælge imellem", other: "{value} at vælge imellem" },
    exercises: "Øvelser",
    exercisesCount: { one: "{value} fra brugere", other: "{value} fra brugere" },
    records: "Rekorder",
    recordsSub: "Danmarks top 100",
  },
  programs: {
    title: "Programmer",
    emptyTitle: "Ingen programmer at vælge imellem endnu",
    emptyBody: "Udvalgte programmer kommer her, så du kan følge dem, som de er.",
  },
  customExercises: {
    title: "Øvelser andre har lavet",
    emptyTitle: "Ingen delte øvelser endnu",
    emptyBody: "Når folk deler de øvelser, de selv har lavet, kan du finde dem her og tilføje dem til dine egne.",
  },
  sections: {
    yourGym: "Dit center",
    change: "Skift",
    centerPosts: "Opslag fra centre",
  },
  centerPostLabel: "{name}: {title}, i {gym}",
  centerPosts: {
    eyebrow: "Opslag fra",
    fallbackTitle: "Et center",
    emptyTitle: "Ingen opslag fra dette center endnu",
    emptyBody: "Når folk, du kan se, deler en træning lavet her, dukker den op her.",
    failed: "Opslagene kunne ikke hentes. Prøv igen om lidt.",
  },
  yourGym: {
    newRecords: { one: "{value} ny rekord", other: "{value} nye rekorder" },
    noNewRecords: "Ingen nye rekorder siden sidst",
    latestLabel: "Nyeste rekord: {name}, {exercise}, {weight} kg",
    pick: "Vælg dit center",
    pickDetail: "Se dets rekorder, og hvem der træner der",
  },
  search: {
    hint: {
      all: "Skriv mindst to bogstaver for at søge i centre og personer.",
      gyms: "Skriv mindst to bogstaver for at søge i centre.",
      people: "Skriv mindst to bogstaver for at søge efter personer.",
    },
    placeholder: {
      all: "Søg centre og personer",
      gyms: "Søg centre",
      people: "Søg personer",
    },
    scope: {
      all: "Begge",
      gyms: "Centre",
      people: "Personer",
    },
    failed: "Søgningen gik ikke igennem. Prøv igen om lidt.",
    nothing: "Intet fundet for “{query}”.",
    clear: "Ryd søgningen",
    gyms: "Centre",
    people: "Personer",
    following: "Du følger dem",
    allPeople: "Se alle og følg",
  },
};
