// Knowledge: the list under Explore, the article page, the "Read the science"
// link and the Knowledge card on Explore. The articles' own texts live with
// them in src/Resources/Knowledge.
export default {
  title: "Kunskap",
  eyebrow: "Utforska",
  searchLabel: "Sök i kunskapsbanken",
  searchPlaceholder: "Sök träningsämnen",
  noResults: "Inga artiklar matchar din sökning.",
  articles: "Artiklar",
  featured: "Utvald · {category}",
  new: "Ny",
  read: "Läs",
  minRead: "{minutes} min läsning",
  sourceCount: {
    one: "{count} källa",
    other: "{count} källor",
  },
  written: "Skriven {date}",
  sourceRef: "källa {numbers}",
  categories: {
    all: "Alla",
    steps: "Steg",
    strength: "Styrka",
    cardio: "Kondition",
    recovery: "Återhämtning",
    stepsStrength: "Steg & styrka",
  },
  article: {
    eyebrow: "Kunskap",
    title: "Artikel",
    inShort: "I korthet",
    sources: "Källor",
    aiTitle: "Skriven med AI.",
    aiBody: "Källorna har lästs och artikeln har skrivits av AI. Kolla källorna ovan om du vill ha alla detaljer.",
    aiFooter: "Skriven av AI den {date}. Allmänna råd, inte medicinsk rådgivning.",
    missing: "Den här artikeln är inte tillgänglig.",
  },
  // Always "Read the science" - not "Read the article".
  scienceLink: {
    label: "Läs forskningen · {minutes} min",
    a11y: "Läs forskningen: {title}, {minutes} min läsning",
  },
  // A how-to, not a study.
  guideLink: {
    label: "Guide · {minutes} min",
    a11y: "Guide: {title}, {minutes} min läsning",
  },
  curve: {
    benefit: "Hälsonytta",
    a11y: "Kurva över hälsonytta efter dagliga steg: brant upp till 4 000, planar ut efter 7 000 till 10 000",
  },
  zoneRange: {
    under: "under {max}",
    between: "{min}–{max}",
    from: "{min}+",
  },
  explore: {
    title: "Kunskap",
    new: "Ny",
    subtitle: "Vetenskapen bakom steg, styrka och återhämtning",
    a11y: "Kunskap: lär dig vetenskapen bakom steg, styrka och återhämtning",
  },
};
