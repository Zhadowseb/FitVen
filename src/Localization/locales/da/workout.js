// Styrketræningens øvelseskort: historik- og notepanelet, og typearket bag
// et sæts mærke. Holdes i trit med ../en/workout.js.
export default {
  history: {
    title: "Historik",
    lastTimes: {
      one: "Sidste gang",
      other: "{count} seneste gange",
    },
    close: "Luk historik",
    loading: "Henter historik",
    couldNotLoad: "Kunne ikke hente tidligere sæt.",
    empty: "Ingen gennemførte sæt for denne øvelse endnu.",
    // Står efter tallet, som tegnes i sin egen farve.
    setsTotal: {
      one: "sæt i alt",
      other: "sæt i alt",
    },
    records: "Rekorder og udvikling",
    openRecords: "Åbn rekorder for {name}",
  },
  note: {
    title: "Note",
    done: "Færdig",
    placeholder: "Tilføj note",
    edit: "Rediger note",
    lastTime: "Sidste gang",
  },
  setType: {
    overline: "Sæt {label} · {exercise}",
    title: "Type",
    delete: "Slet",
    deleteSet: "Slet sæt {label}",
    badge: "Sæt {label}. Hold for at skifte type",
    types: {
      warmup: {
        title: "Opvarmning",
        detail: "Tæller ikke med i volumen eller rekorder",
      },
      working: {
        title: "Arbejdssæt",
        detail: "Tæller med i volumen og rekorder",
      },
      drop: {
        title: "Dropsæt",
        detail: "Lettere, lige efter sættet over. Ingen rekorder",
      },
      amrap: {
        title: "AMRAP",
        detail: "Så mange gentagelser som muligt",
      },
    },
    amrapTarget: "Mål for reps",
    amrapTargetDetail: "Vises ved siden af reps, som 9/6+",
    amrapTargetPlaceholder: "fx 6",
    note: "Note",
    notePlaceholder: "Tilføj note",
    deleted: "Sæt {label} slettet",
    undo: "Fortryd",
    warmupCount: {
      one: "{count} opvarmningssæt",
      other: "{count} opvarmningssæt",
    },
    foldWarmups: "Fold opvarmningen sammen",
    warmupsFolded: {
      one: "{count} opvarmningssæt. Tryk for at vise",
      other: "{count} opvarmningssæt. Tryk for at vise",
    },
  },
};
