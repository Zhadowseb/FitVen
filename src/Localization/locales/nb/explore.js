// Utforsk-fanen: forsiden, søket og inngangene.
export default {
  title: "Utforsk",
  searchPlaceholder: "Søk etter sentre og folk",
  tiles: {
    gyms: "Sentre",
    gymsSub: "Finn senteret ditt",
    gymsCount: { one: "{value} i Danmark", other: "{value} i Danmark" },
    programs: "Programmer",
    programsCount: { one: "{value} å velge mellom", other: "{value} å velge mellom" },
    exercises: "Øvelser",
    exercisesCount: { one: "{value} fra brukere", other: "{value} fra brukere" },
    // Mens antallet er ukjent, og mens ingenting er delt.
    exercisesSub: "Laget av brukere",
    exercisesFirst: "Del den første",
    records: "Rekorder",
    recordsSub: "Danmarks topp 100",
  },
  programs: {
    title: "Programmer",
    emptyTitle: "Ingen programmer å velge mellom ennå",
    emptyBody: "Håndplukkede programmer kommer hit, så du kan følge dem som de er.",
  },
  customExercises: {
    title: "Egenlagde øvelser",
    emptyTitle: "Ingen delte øvelser ennå",
    emptyBody: "Når folk deler øvelsene de har laget, kan du finne dem og legge dem til i dine egne her.",
  },
  sections: {
    yourGym: "Senteret ditt",
    change: "Endre",
    customExercises: "Nye øvelser fra andre",
    all: "Alle",
    allCount: { one: "Åpne biblioteket", other: "Alle {value}" },
    allExercisesA11y: {
      one: "Åpne biblioteket med {value} øvelse",
      other: "Se alle {value} øvelser",
    },
    centerPosts: "Innlegg fra sentre",
  },
  centerPostLabel: "{name}: {title}, på {gym}",
  centerPosts: {
    eyebrow: "Innlegg fra",
    fallbackTitle: "Et senter",
    emptyTitle: "Ingen innlegg fra dette senteret ennå",
    emptyBody: "Når folk du kan se, legger ut en økt gjort her, dukker den opp her.",
    failed: "Innleggene kunne ikke lastes. Prøv igjen om litt.",
  },
  yourGym: {
    newRecords: { one: "{value} ny rekord", other: "{value} nye rekorder" },
    noNewRecords: "Ingen nye rekorder siden sist du var innom",
    latestLabel: "Nyeste rekord: {name}, {exercise}, {weight} kg",
    pick: "Velg senteret ditt",
    pickDetail: "Se rekordene og hvem som trener der",
  },
  search: {
    hint: {
      all: "Skriv minst to bokstaver for å søke etter sentre og folk.",
      gyms: "Skriv minst to bokstaver for å søke etter sentre.",
      people: "Skriv minst to bokstaver for å søke etter folk.",
    },
    placeholder: {
      all: "Søk etter sentre og folk",
      gyms: "Søk etter sentre",
      people: "Søk etter folk",
    },
    scope: {
      all: "Begge",
      gyms: "Sentre",
      people: "Folk",
    },
    failed: "Søket gikk ikke gjennom. Prøv igjen om litt.",
    nothing: "Fant ingenting for «{query}».",
    clear: "Tøm søket",
    gyms: "Sentre",
    people: "Folk",
    following: "Du følger dem",
    allPeople: "Se alle og følg",
    // Sentre valgt, ingenting skrevet ennå: senteret ditt, de du har trent på,
    // og de travleste i senterets region ({where} bringer med seg sin
    // preposisjon).
    suggestions: {
      yours: "Senteret ditt",
      trainedIn: "Der du har trent",
      workouts: { one: "{count} økt", other: "{count} økter" },
      busiestIn: "Travleste {where}",
      busiest: "Travleste sentre",
    },
  },
};
