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
    de: {
      title: "Wie viele Schritte brauchst du wirklich?",
      summary: "Der gesundheitliche Nutzen des Gehens ist keine gerade Linie. Die ersten paar tausend Schritte des Tages zählen am meisten.",
      inShort: [
        "Der gesundheitliche Nutzen des Gehens ist keine gerade Linie. Die ersten paar tausend Schritte des Tages zählen am meisten.",
        "Der größte Teil des langfristigen Nutzens ist bei etwa 7.000 Schritten am Tag erreicht.",
        "Über 10.000 Schritten gibt es kaum zusätzlichen Nutzen für das langfristige Risiko, aber es hilft weiterhin bei Fitness, Energie und Stimmung.",
      ],
      zoneNotes: {
        inactive: "Überwiegend Sitzen. Das ist die Basis, mit der die Studien vergleichen.",
        moving: "Der steilste Teil der Kurve. Jeder zusätzliche Spaziergang tut hier am meisten für deine Gesundheit.",
        active: "Der Nutzen wächst weiter in gleichmäßigem Tempo.",
        sweetSpot: "Hier wird der größte Teil des langfristigen Nutzens für Herzgesundheit, Krebsrisiko und Lebensdauer erreicht.",
        bonus: "Zusätzlich für Fitness, Energie und Stimmung, aber sehr wenig zusätzlich für das langfristige Risiko.",
      },
      sections: [
        {
          heading: "Die Kurve flacht ab",
          paragraphs: [
            [
              "Der gesundheitliche Nutzen wächst nicht in einer geraden Linie. Die ersten Schritte des Tages zählen am meisten, und die Kurve flacht nach etwa 7.000–10.000 ab.",
              { ref: [1, 2] },
            ],
          ],
          block: "curve",
        },
        {
          heading: "Die Schrittzonen von FitVen",
          paragraphs: [
            ["FitVen teilt den Tag in fünf Zonen ein, damit du immer einen nächsten Schritt als Ziel hast statt einer festen Zahl."],
          ],
          block: "zones",
        },
        {
          heading: "Das Alter spielt eine Rolle",
          paragraphs: [
            [
              "Ältere Erwachsene erreichen das Plateau tendenziell etwas früher (etwa 6.000–8.000), jüngere Erwachsene etwas später (etwa 8.000–10.000).",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
  },
};
