// "How many steps do you really need?" - the article behind the step zones
// (Utils/stepZones.js). The English text is the design's
// (KnowledgeZones.dc.html), word for word; the Danish is a translation that
// needs a read-through.
//
// Two sections carry a block the page draws itself: "curve" (the benefit by
// daily steps) and "zones" (the five zone rows, whose names, ranges and colours
// come from stepZones.js so they cannot drift from the rest of the app - only
// the one line under each is written here, as `zoneNotes`).

const sources = [
  {
    title: "Daily steps and health outcomes in adults",
    byline: "Ding et al. · The Lancet Public Health, 2025",
  },
  {
    title: "Daily steps and all-cause mortality",
    byline: "Paluch et al. · The Lancet Public Health, 2022",
  },
];

export default {
  id: "step-zones",
  categories: ["steps"],
  date: "2026-10-10",
  readMinutes: 4,
  // "Read the science" at the end of the article.
  related: ["strength-counts-as-steps"],
  sources,
  content: {
    en: {
      title: "How many steps do you really need?",
      // The list shows no summary for this one; the first bullet stands in for
      // the search.
      summary: "The health benefit of walking is not a straight line. The first few thousand steps of the day count the most.",
      inShort: [
        "The health benefit of walking is not a straight line. The first few thousand steps of the day count the most.",
        "Most of the long-term benefit is reached at around 7,000 steps a day.",
        "Above 10,000 steps there is little extra benefit for long-term risk, but it still helps fitness, energy and mood.",
      ],
      zoneNotes: {
        inactive: "Mostly sitting. This is the baseline the studies compare against.",
        moving: "The steepest part of the curve. Every extra walk here does the most for your health.",
        active: "The benefit keeps growing at a steady pace.",
        sweetSpot: "Most of the long-term benefit for heart health, cancer risk and lifespan is reached here.",
        bonus: "Extra for fitness, energy and mood, but very little extra for long-term risk.",
      },
      sections: [
        {
          heading: "The curve flattens out",
          paragraphs: [
            [
              "Health benefit does not grow in a straight line. The first steps of the day count the most, and the curve flattens out after around 7,000–10,000.",
              { ref: [1, 2] },
            ],
          ],
          block: "curve",
        },
        {
          heading: "FitVen's step zones",
          paragraphs: [
            ["FitVen splits the day into five zones, so you always have a next step to aim for instead of one fixed number."],
          ],
          block: "zones",
        },
        {
          heading: "Age matters",
          paragraphs: [
            [
              "Older adults tend to reach the plateau a little sooner (around 6,000–8,000), younger adults a little later (around 8,000–10,000).",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
    da: {
      title: "Hvor mange skridt har du egentlig brug for?",
      summary: "Sundhedsgevinsten ved at gå er ikke en lige linje. De første par tusind skridt på dagen tæller mest.",
      inShort: [
        "Sundhedsgevinsten ved at gå er ikke en lige linje. De første par tusind skridt på dagen tæller mest.",
        "Det meste af den langsigtede gevinst er nået ved omkring 7.000 skridt om dagen.",
        "Over 10.000 skridt er der kun lidt ekstra gevinst for den langsigtede risiko, men det hjælper stadig på kondition, energi og humør.",
      ],
      zoneNotes: {
        inactive: "Mest siddende. Det er udgangspunktet, som studierne sammenligner med.",
        moving: "Den stejleste del af kurven. Hver ekstra gåtur her gør mest for dit helbred.",
        active: "Gevinsten bliver ved med at vokse i et jævnt tempo.",
        sweetSpot: "Det meste af den langsigtede gevinst for hjertet, kræftrisiko og levetid nås her.",
        bonus: "Ekstra for kondition, energi og humør, men meget lidt ekstra for den langsigtede risiko.",
      },
      sections: [
        {
          heading: "Kurven flader ud",
          paragraphs: [
            [
              "Sundhedsgevinsten vokser ikke i en lige linje. De første skridt på dagen tæller mest, og kurven flader ud efter omkring 7.000–10.000.",
              { ref: [1, 2] },
            ],
          ],
          block: "curve",
        },
        {
          heading: "FitVens skridtzoner",
          paragraphs: [
            ["FitVen deler dagen op i fem zoner, så du altid har et næste skridt at sigte efter i stedet for ét fast tal."],
          ],
          block: "zones",
        },
        {
          heading: "Alder betyder noget",
          paragraphs: [
            [
              "Ældre voksne når typisk toppunktet lidt tidligere (omkring 6.000–8.000), yngre voksne lidt senere (omkring 8.000–10.000).",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
  },
};
