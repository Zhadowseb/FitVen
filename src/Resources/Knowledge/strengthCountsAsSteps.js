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
    sv: {
      title: "Räknas styrketräning som steg?",
      summary: "Varför dina pass läggs till dina dagliga steg, och vad styrka ger som promenader inte gör.",
      inShort: [
        "Minuter av motion och dagliga steg hänger ihop med samma lägre risk för tidig död och hjärtsjukdom.",
        "FitVen lägger till ungefär 115 steg per minut hård styrketräning på din dag.",
        "Styrketräning ger det promenader inte kan: muskler, starka ben och bättre kontroll över blodsockret.",
      ],
      sections: [
        {
          heading: "Minuter eller steg?",
          paragraphs: [
            [
              "En stor studie från Harvard och Brigham and Women's Hospital jämförde att mäta aktivitet i minuter med att mäta den i steg. Båda hängde ihop med samma minskning av risken för tidig död och hjärtsjukdom. Tid som läggs på träning är ett lika giltigt mått som ett stegantal.",
    nb: {
      title: "Teller styrketrening som skritt?",
      summary: "Hvorfor øktene dine legges til de daglige skrittene, og hva styrke gir som gåing ikke kan.",
      inShort: [
        "Minutter med trening og daglige skritt henger sammen med den samme lavere risikoen for tidlig død og hjertesykdom.",
        "FitVen legger til omtrent 115 skritt per minutt hard styrketrening i dagen din.",
        "Styrketrening gir det gåing ikke kan: muskler, sterkere skjelett og bedre blodsukkerkontroll.",
      ],
      sections: [
        {
          heading: "Minutter eller skritt?",
          paragraphs: [
            [
              "En stor studie fra Harvard og Brigham and Women's Hospital sammenlignet det å måle aktivitet i minutter med å måle den i skritt. Begge var knyttet til den samme nedgangen i risiko for tidlig død og hjertesykdom. Tid brukt på trening er et like gyldig mål som antall skritt.",
              { ref: [2] },
            ],
          ],
        },
        {
          heading: "Så räknar FitVen dina pass",
          paragraphs: [
            [
              "Ett styrkepass påverkar inte din stegräknare särskilt mycket, så FitVen räknar om tiden till stegekvivalenter. Hård styrketräning räknas som ungefär 115 steg per minut, så 30 minuter ger ungefär 3 450 steg. Satsen kommer från Tæl Skridt-omräknaren, som räknar om aktiviteter till steg utifrån energiförbrukning.",
              { ref: [1] },
              " Promenader och löpning använder alltid dina verkliga steg.",
          heading: "Slik teller FitVen øktene dine",
          paragraphs: [
            [
              "En styrkeøkt flytter ikke skritttelleren din mye, så FitVen regner om tiden til skrittekvivalenter. Hard styrketrening teller som omtrent 115 skritt per minutt, så 30 minutter legger til omtrent 3 450 skritt. Satsen kommer fra Tæl Skridt-kalkulatoren, som regner om aktiviteter til skritt basert på energibruk.",
              { ref: [1] },
              " Gåturer og løpeturer bruker alltid dine faktiske skritt.",
            ],
          ],
        },
        {
          heading: "Vad styrka ger som promenader inte gör",
          paragraphs: [
            [
              "Att gå är ett bra mått på vardagsrörelse, men det utmanar sällan dina muskler. Styrketräning hjälper till att bevara muskler och skelett när du blir äldre och förbättrar hur kroppen hanterar blodsocker. 30 till 60 minuter i veckan hänger ihop med ungefär 10–20 % lägre risk för tidig död.",
          heading: "Hva styrke gir som gåing ikke kan",
          paragraphs: [
            [
              "Gåing er et godt mål på hverdagsbevegelse, men den utfordrer sjelden musklene dine. Styrketrening bidrar til å bevare muskler og skjelett med alderen og forbedrer hvordan kroppen håndterer blodsukker. 30 til 60 minutter i uken er knyttet til omtrent 10–20 % lavere risiko for tidlig død.",
              { ref: [3] },
            ],
          ],
        },
        {
          heading: "Den bästa kombinationen",
          paragraphs: [
            [
              "Den lägsta risken ses när vardagsgång kombineras med ett par styrkepass i veckan. Hälsovinsten av steg planar ut vid omkring 7 000–10 000 om dagen, så utöver det ger träning mer än extra steg.",
          heading: "Den beste kombinasjonen",
          paragraphs: [
            [
              "Den laveste risikoen ses når hverdagsgåing kombineres med et par styrkeøkter i uken. Helsegevinsten fra skritt flater ut ved rundt 7 000–10 000 om dagen, så utover det gir trening mer enn ekstra skritt.",
              { ref: [4, 5] },
            ],
          ],
        },
      ],
    },
  },
};
