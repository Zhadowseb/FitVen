// Viden: listen under Udforsk, artikelsiden, linket "Læs videnskaben" og
// Viden-kortet på Udforsk. Artiklernes egne tekster ligger sammen med dem i
// src/Resources/Knowledge. Hold den i takt med ../en/knowledge.js. Den danske
// ordlyd er et forslag og skal gennemlæses.
export default {
  title: "Viden",
  eyebrow: "Udforsk",
  searchLabel: "Søg i viden",
  searchPlaceholder: "Søg i træningsemner",
  noResults: "Ingen artikler matcher din søgning.",
  articles: "Artikler",
  featured: "Fremhævet · {category}",
  new: "Ny",
  read: "Læst",
  minRead: "{minutes} min læsning",
  sourceCount: {
    one: "{count} kilde",
    other: "{count} kilder",
  },
  written: "Skrevet {date}",
  sourceRef: "kilde {numbers}",
  categories: {
    all: "Alle",
    steps: "Skridt",
    strength: "Styrke",
    cardio: "Kondition",
    recovery: "Restitution",
    stepsStrength: "Skridt og styrke",
  },
  article: {
    eyebrow: "Viden",
    title: "Artikel",
    inShort: "Kort sagt",
    sources: "Kilder",
    aiTitle: "Skrevet med AI.",
    aiBody: "Kilderne er læst, og artiklen er skrevet af AI. Tjek kilderne ovenfor, hvis du vil have alle detaljerne.",
    aiFooter: "Skrevet af AI den {date}. Generel vejledning, ikke lægelig rådgivning.",
    missing: "Artiklen er ikke tilgængelig.",
  },
  // Altid "Læs videnskaben" - ikke "Læs artiklen".
  scienceLink: {
    label: "Læs videnskaben · {minutes} min",
    a11y: "Læs videnskaben: {title}, {minutes} min læsning",
  },
  curve: {
    benefit: "Sundhedsgevinst",
    a11y: "Kurve over sundhedsgevinst efter daglige skridt: stejl op til 4.000, flader ud efter 7.000 til 10.000",
  },
  zoneRange: {
    under: "under {max}",
    between: "{min}–{max}",
    from: "{min}+",
  },
  explore: {
    title: "Viden",
    new: "Ny",
    subtitle: "Videnskaben bag skridt, styrke og restitution",
    a11y: "Viden: lær videnskaben bag skridt, styrke og restitution",
  },
};
