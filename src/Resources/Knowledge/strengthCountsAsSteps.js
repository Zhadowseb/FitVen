// "Does strength training count as steps?" - the article that explains why a
// finished strength workout is added to the day's steps (Utils/stepZones.js,
// TRAINING_STEPS_PER_MINUTE). The English text is the design's
// (KnowledgeArticle.dc.html), word for word; the Danish is a translation that
// needs a read-through.
//
// A paragraph is a list of parts: text, and { ref: [n, ...] } for the footnote
// numbers that follow it, which point at `sources`.

const sources = [
  {
    title: "Tæl Skridt motionsomregner",
    byline: "Dansk Firmaidrætsforbund · app.taelskridt.dk",
  },
  {
    title: "Time- vs step-based physical activity metrics for health",
    byline: "Hamaya et al. · JAMA Internal Medicine, 2024 · Harvard / Brigham and Women's Hospital",
  },
  {
    title: "Muscle-strengthening activities and risk of death and disease",
    byline: "Momma et al. · British Journal of Sports Medicine, 2022",
  },
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
  id: "strength-counts-as-steps",
  // Shown as "Steps & strength", in the strength colour.
  categories: ["steps", "strength"],
  // The newest article is featured; this one is the one the design features.
  featured: true,
  date: "2026-10-10",
  readMinutes: 3,
  related: [],
  sources,
  content: {
    en: {
      title: "Does strength training count as steps?",
      summary: "Why your workouts are added to your daily steps, and what strength gives that walking can't.",
      inShort: [
        "Minutes of exercise and daily steps are linked to the same lower risk of early death and heart disease.",
        "FitVen adds about 115 steps per minute of hard strength training to your day.",
        "Strength training adds what walking can't: muscle, bone strength and better blood sugar control.",
      ],
      sections: [
        {
          heading: "Minutes or steps?",
          paragraphs: [
            [
              "A large study from Harvard and Brigham and Women's Hospital compared measuring activity in minutes with measuring it in steps. Both were linked to the same drop in risk of early death and heart disease. Time spent training is just as valid a measure as a step count.",
              { ref: [2] },
            ],
          ],
        },
        {
          heading: "How FitVen counts your workouts",
          paragraphs: [
            [
              "A strength session does not move your step counter much, so FitVen converts the time into step equivalents. Hard strength training counts as about 115 steps per minute, so 30 minutes adds about 3,450 steps. The rate comes from the Tæl Skridt calculator, which converts activities to steps based on energy use.",
              { ref: [1] },
              " Walks and runs always use your real steps.",
            ],
          ],
        },
        {
          heading: "What strength gives that walking can't",
          paragraphs: [
            [
              "Walking is a good measure of everyday movement, but it rarely challenges your muscles. Strength training helps keep muscle and bone as you age and improves how your body handles blood sugar. 30 to 60 minutes a week is linked to about 10–20 % lower risk of early death.",
              { ref: [3] },
            ],
          ],
        },
        {
          heading: "The best combination",
          paragraphs: [
            [
              "The lowest risk is seen when everyday walking is combined with a couple of strength sessions a week. The health benefit from steps levels off at around 7,000–10,000 a day, so beyond that, training adds more than extra steps.",
              { ref: [4, 5] },
            ],
          ],
        },
      ],
    },
    da: {
      title: "Tæller styrketræning som skridt?",
      summary: "Hvorfor dine træninger lægges til dine daglige skridt, og hvad styrke giver, som gang ikke gør.",
      inShort: [
        "Minutter med motion og daglige skridt hænger sammen med den samme lavere risiko for tidlig død og hjertesygdom.",
        "FitVen lægger cirka 115 skridt pr. minut hård styrketræning til din dag.",
        "Styrketræning giver det, gang ikke kan: muskler, stærke knogler og bedre kontrol med blodsukkeret.",
      ],
      sections: [
        {
          heading: "Minutter eller skridt?",
          paragraphs: [
            [
              "Et stort studie fra Harvard og Brigham and Women's Hospital sammenlignede at måle aktivitet i minutter med at måle den i skridt. Begge dele hang sammen med det samme fald i risikoen for tidlig død og hjertesygdom. Tid brugt på træning er lige så gyldigt et mål som et skridttal.",
              { ref: [2] },
            ],
          ],
        },
        {
          heading: "Sådan tæller FitVen dine træninger",
          paragraphs: [
            [
              "En styrketræning rykker ikke meget på din skridttæller, så FitVen omregner tiden til skridtækvivalenter. Hård styrketræning tæller som cirka 115 skridt pr. minut, så 30 minutter giver cirka 3.450 skridt. Satsen kommer fra Tæl Skridt-omregneren, som omregner aktiviteter til skridt ud fra energiforbrug.",
              { ref: [1] },
              " Gåture og løb bruger altid dine rigtige skridt.",
            ],
          ],
        },
        {
          heading: "Hvad styrke giver, som gang ikke gør",
          paragraphs: [
            [
              "Gang er et godt mål for hverdagens bevægelse, men det udfordrer sjældent dine muskler. Styrketræning hjælper med at bevare muskler og knogler, når du bliver ældre, og forbedrer, hvordan kroppen håndterer blodsukker. 30 til 60 minutter om ugen hænger sammen med cirka 10–20 % lavere risiko for tidlig død.",
              { ref: [3] },
            ],
          ],
        },
        {
          heading: "Den bedste kombination",
          paragraphs: [
            [
              "Den laveste risiko ses, når hverdagsgang kombineres med et par styrketræninger om ugen. Sundhedsgevinsten ved skridt flader ud omkring 7.000–10.000 om dagen, så ud over det giver træning mere end ekstra skridt.",
              { ref: [4, 5] },
            ],
          ],
        },
      ],
    },
    de: {
      title: "Zählt Krafttraining als Schritte?",
      summary: "Warum deine Workouts zu deinen täglichen Schritten addiert werden und was Kraft bietet, das Gehen nicht kann.",
      inShort: [
        "Trainingsminuten und tägliche Schritte hängen mit demselben geringeren Risiko für frühen Tod und Herzkrankheiten zusammen.",
        "FitVen addiert etwa 115 Schritte pro Minute hartes Krafttraining zu deinem Tag.",
        "Krafttraining bringt, was Gehen nicht kann: Muskeln, Knochenstärke und eine bessere Blutzuckerkontrolle.",
      ],
      sections: [
        {
          heading: "Minuten oder Schritte?",
          paragraphs: [
            [
              "Eine große Studie aus Harvard und dem Brigham and Women's Hospital verglich die Messung von Aktivität in Minuten mit der Messung in Schritten. Beides hing mit demselben Rückgang des Risikos für frühen Tod und Herzkrankheiten zusammen. Die Trainingszeit ist ein ebenso gültiges Maß wie die Schrittzahl.",
              { ref: [2] },
            ],
          ],
        },
        {
          heading: "Wie FitVen deine Workouts zählt",
          paragraphs: [
            [
              "Eine Krafteinheit bewegt deinen Schrittzähler kaum, deshalb rechnet FitVen die Zeit in Schrittäquivalente um. Hartes Krafttraining zählt als etwa 115 Schritte pro Minute, also bringen 30 Minuten etwa 3.450 Schritte. Der Wert stammt vom Rechner von Tæl Skridt, der Aktivitäten anhand des Energieverbrauchs in Schritte umrechnet.",
              { ref: [1] },
              " Spaziergänge und Läufe verwenden immer deine echten Schritte.",
            ],
          ],
        },
        {
          heading: "Was Kraft bietet, das Gehen nicht kann",
          paragraphs: [
            [
              "Gehen ist ein gutes Maß für die Alltagsbewegung, fordert deine Muskeln aber selten heraus. Krafttraining hilft, Muskeln und Knochen im Alter zu erhalten, und verbessert, wie dein Körper mit Blutzucker umgeht. 30 bis 60 Minuten pro Woche hängen mit einem etwa 10–20 % geringeren Risiko für frühen Tod zusammen.",
              { ref: [3] },
            ],
          ],
        },
        {
          heading: "Die beste Kombination",
          paragraphs: [
            [
              "Das niedrigste Risiko zeigt sich, wenn Alltagsgehen mit ein paar Krafteinheiten pro Woche kombiniert wird. Der gesundheitliche Nutzen durch Schritte flacht bei etwa 7.000–10.000 am Tag ab, darüber hinaus bringt Training mehr als zusätzliche Schritte.",
              { ref: [4, 5] },
            ],
          ],
        },
      ],
    },
  },
};
