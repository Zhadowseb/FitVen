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
    sv: {
      title: "Hur många steg behöver du egentligen?",
      summary: "Hälsovinsten med att gå är inte en rät linje. De första tusentals stegen på dagen räknas mest.",
      inShort: [
        "Hälsovinsten med att gå är inte en rät linje. De första tusentals stegen på dagen räknas mest.",
        "Det mesta av den långsiktiga vinsten nås vid omkring 7 000 steg om dagen.",
        "Över 10 000 steg är den extra vinsten för den långsiktiga risken liten, men det hjälper fortfarande kondition, energi och humör.",
      ],
      zoneNotes: {
        inactive: "Mest stillasittande. Det är utgångsläget som studierna jämför med.",
        moving: "Den brantaste delen av kurvan. Varje extra promenad här gör mest för din hälsa.",
        active: "Vinsten fortsätter att växa i jämn takt.",
        sweetSpot: "Det mesta av den långsiktiga vinsten för hjärtat, cancerrisken och livslängden nås här.",
        bonus: "Extra för kondition, energi och humör, men mycket lite extra för den långsiktiga risken.",
      },
      sections: [
        {
          heading: "Kurvan planar ut",
          paragraphs: [
            [
              "Hälsovinsten växer inte i en rät linje. De första stegen på dagen räknas mest, och kurvan planar ut efter omkring 7 000–10 000.",
    nb: {
      title: "Hvor mange skritt trenger du egentlig?",
      // Listen viser ikke noe sammendrag for denne; første punkt står i for
      // søket.
      summary: "Helsegevinsten ved å gå er ikke en rett linje. De første par tusen skrittene hver dag teller mest.",
      inShort: [
        "Helsegevinsten ved å gå er ikke en rett linje. De første par tusen skrittene hver dag teller mest.",
        "Mesteparten av langtidsgevinsten nås ved rundt 7 000 skritt om dagen.",
        "Over 10 000 skritt er det liten ekstra gevinst for langtidsrisikoen, men det hjelper fortsatt på form, energi og humør.",
      ],
      zoneNotes: {
        inactive: "For det meste sitting. Dette er utgangspunktet studiene sammenligner mot.",
        moving: "Den bratteste delen av kurven. Hver ekstra tur her gjør mest for helsen din.",
        active: "Gevinsten fortsetter å vokse i jevnt tempo.",
        sweetSpot: "Mesteparten av langtidsgevinsten for hjertehelse, kreftrisiko og levetid nås her.",
        bonus: "Ekstra for form, energi og humør, men svært lite ekstra for langtidsrisikoen.",
      },
      sections: [
        {
          heading: "Kurven flater ut",
          paragraphs: [
            [
              "Helsegevinsten vokser ikke i en rett linje. De første skrittene hver dag teller mest, og kurven flater ut etter rundt 7 000–10 000.",
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
    fr: {
      title: "De combien de pas as-tu vraiment besoin\u00A0?",
      summary: "Le bénéfice santé de la marche n'est pas une ligne droite. Les premiers milliers de pas de la journée comptent le plus.",
      inShort: [
        "Le bénéfice santé de la marche n'est pas une ligne droite. Les premiers milliers de pas de la journée comptent le plus.",
        "L'essentiel du bénéfice à long terme est atteint autour de 7 000 pas par jour.",
        "Au-delà de 10 000 pas, le bénéfice supplémentaire pour le risque à long terme est faible, mais cela aide encore la forme, l'énergie et l'humeur.",
      ],
      zoneNotes: {
        inactive: "Surtout assis. C'est la référence à laquelle les études comparent.",
        moving: "La partie la plus raide de la courbe. Chaque marche supplémentaire ici fait le plus pour ta santé.",
        active: "Le bénéfice continue de croître à un rythme régulier.",
        sweetSpot: "L'essentiel du bénéfice à long terme pour le cœur, le risque de cancer et la durée de vie est atteint ici.",
        bonus: "Un plus pour la forme, l'énergie et l'humeur, mais très peu de bénéfice supplémentaire pour le risque à long terme.",
      },
      sections: [
        {
          heading: "La courbe s'aplatit",
          paragraphs: [
            [
              "Le bénéfice santé ne croît pas en ligne droite. Les premiers pas de la journée comptent le plus, et la courbe s'aplatit après environ 7 000–10 000.",
    es: {
      title: "¿Cuántos pasos necesitas realmente?",
      summary: "El beneficio para la salud de caminar no es una línea recta. Los primeros miles de pasos del día son los que más cuentan.",
      inShort: [
        "El beneficio para la salud de caminar no es una línea recta. Los primeros miles de pasos del día son los que más cuentan.",
        "La mayor parte del beneficio a largo plazo se alcanza en torno a los 7.000 pasos al día.",
        "Por encima de los 10.000 pasos hay poco beneficio adicional para el riesgo a largo plazo, pero sigue ayudando a la forma física, la energía y el estado de ánimo.",
      ],
      zoneNotes: {
        inactive: "Casi todo sentado. Es la referencia con la que comparan los estudios.",
        moving: "El tramo más empinado de la curva. Cada paseo extra aquí es el que más hace por tu salud.",
        active: "El beneficio sigue creciendo a un ritmo constante.",
        sweetSpot: "Aquí se alcanza la mayor parte del beneficio a largo plazo para la salud del corazón, el riesgo de cáncer y la esperanza de vida.",
        bonus: "Extra para la forma física, la energía y el estado de ánimo, pero muy poco extra para el riesgo a largo plazo.",
      },
      sections: [
        {
          heading: "La curva se aplana",
          paragraphs: [
            [
              "El beneficio para la salud no crece en línea recta. Los primeros pasos del día son los que más cuentan, y la curva se aplana a partir de unos 7.000–10.000.",
              { ref: [1, 2] },
            ],
          ],
          block: "curve",
        },
        {
          heading: "FitVens stegzoner",
          paragraphs: [
            ["FitVen delar in dagen i fem zoner, så att du alltid har ett nästa steg att sikta mot i stället för ett fast tal."],
          heading: "FitVens skrittsoner",
          paragraphs: [
            ["FitVen deler dagen inn i fem soner, så du alltid har et neste steg å sikte mot i stedet for ett fast tall."],
          heading: "Die Schrittzonen von FitVen",
          paragraphs: [
            ["FitVen teilt den Tag in fünf Zonen ein, damit du immer einen nächsten Schritt als Ziel hast statt einer festen Zahl."],
          heading: "Les zones de pas de FitVen",
          paragraphs: [
            ["FitVen découpe la journée en cinq zones, pour que tu aies toujours un prochain palier à viser plutôt qu'un seul chiffre fixe."],
          heading: "Las zonas de pasos de FitVen",
          paragraphs: [
            ["FitVen divide el día en cinco zonas, para que siempre tengas un siguiente paso al que apuntar en lugar de una cifra fija."],
          ],
          block: "zones",
        },
        {
          heading: "Åldern spelar roll",
          paragraphs: [
            [
              "Äldre vuxna når typiskt platån lite tidigare (omkring 6 000–8 000), yngre vuxna lite senare (omkring 8 000–10 000).",
          heading: "Alder spiller en rolle",
          paragraphs: [
            [
              "Eldre voksne når platået gjerne litt tidligere (rundt 6 000–8 000), yngre voksne litt senere (rundt 8 000–10 000).",
          heading: "Das Alter spielt eine Rolle",
          paragraphs: [
            [
              "Ältere Erwachsene erreichen das Plateau tendenziell etwas früher (etwa 6.000–8.000), jüngere Erwachsene etwas später (etwa 8.000–10.000).",
          heading: "L'âge compte",
          paragraphs: [
            [
              "Les adultes plus âgés atteignent généralement le plateau un peu plus tôt (autour de 6 000–8 000), les plus jeunes un peu plus tard (autour de 8 000–10 000).",
          heading: "La edad importa",
          paragraphs: [
            [
              "Los adultos mayores tienden a alcanzar la meseta un poco antes (en torno a 6.000–8.000), los adultos más jóvenes un poco después (en torno a 8.000–10.000).",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
  },
};
