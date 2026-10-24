// "Health Connect: one place for your steps" - a guide, not a study: why it is
// worth setting up on Android and how, for the phone that has no health app
// FitVen can read yet. It is told like the other articles (an "In short",
// sections, footnotes, sources), but is marked `kind: "guide"` so the link to
// it says "Guide" and never "Read the science".
//
// Nothing in it is a number from a study. What it says about Health Connect is
// what Google's own pages say; that the steps start from the day the health app
// was connected is how Samsung Health behaves, and the text says "usually".

const sources = [
  {
    title: "Get started with Health Connect",
    byline: "Android Help · Google",
  },
  {
    title: "Health Connect overview",
    byline: "Android Developers · Google",
  },
];

export default {
  id: "health-connect",
  kind: "guide",
  categories: ["steps"],
  date: "2026-10-11",
  readMinutes: 3,
  related: ["step-zones"],
  sources,
  content: {
    en: {
      title: "Health Connect: one place for your steps",
      summary: "Health Connect lets your phone's health apps share your steps. Why it is worth setting up, and how.",
      inShort: [
        "Health Connect is Android's shared place for health data. Samsung Health, your watch's app and FitVen can all read from it and write to it.",
        "With it, FitVen shows the same steps as your health app, your watch included. Without it, FitVen only counts the steps the phone itself takes.",
        "It is free, built into Android 14 and newer, and you decide which app may read what.",
      ],
      sections: [
        {
          heading: "Why it is worth it - for more than FitVen",
          paragraphs: [
            [
              "When every app counts on its own, no two of them agree. Health Connect gives your apps one set of numbers: the steps your watch counted reach every app you allow, and when you change app or watch, the history stays where it was.",
              { ref: [1, 2] },
            ],
            [
              "You stay in charge. Health Connect lists which apps may read and write what, and you can take any of them away, or delete the data, at any time.",
              { ref: [1] },
            ],
          ],
        },
        {
          heading: "How to set it up",
          paragraphs: [
            [
              "1. Get Health Connect. On Android 14 and newer it is already part of the phone: search your settings for \"Health Connect\". On Android 13 and older, install \"Health Connect by Android\" from Google Play. It is free.",
              { ref: [1] },
            ],
            [
              "2. Let your health app share. In Samsung Health, open Settings → Health Connect and allow it to write steps. Other health apps have a similar switch.",
            ],
            ["3. Open the steps card in FitVen, tap Allow and allow reading steps."],
          ],
        },
        {
          heading: "What to expect",
          paragraphs: [
            [
              "Health Connect usually only has the steps your health app has sent since it was connected. Earlier days do not appear on their own. From the day you connect, FitVen and your health app show the same number.",
            ],
            [
              "FitVen only reads your steps and never writes anything to Health Connect. You can see and remove its access in Health Connect.",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
    da: {
      title: "Health Connect: ét sted til dine skridt",
      summary: "Health Connect lader telefonens sundhedsapps dele dine skridt. Hvorfor det er værd at sætte op, og hvordan.",
      inShort: [
        "Health Connect er Androids fælles sted til sundhedsdata. Samsung Health, dit urs app og FitVen kan alle læse fra det og skrive til det.",
        "Med det viser FitVen de samme skridt som din sundhedsapp, urets med. Uden det tæller FitVen kun de skridt, telefonen selv tager.",
        "Det er gratis, indbygget i Android 14 og nyere, og du bestemmer, hvilken app der må læse hvad.",
      ],
      sections: [
        {
          heading: "Hvorfor det er værd - også ud over FitVen",
          paragraphs: [
            [
              "Når hver app tæller for sig, er der ikke to, der er enige. Health Connect giver dine apps ét sæt tal: de skridt, dit ur har talt, når frem til alle de apps, du giver lov, og skifter du app eller ur, bliver historikken, hvor den var.",
              { ref: [1, 2] },
            ],
            [
              "Du bestemmer selv. Health Connect viser, hvilke apps der må læse og skrive hvad, og du kan til enhver tid fjerne en af dem eller slette dataene.",
              { ref: [1] },
            ],
          ],
        },
        {
          heading: "Sådan sætter du det op",
          paragraphs: [
            [
              "1. Hent Health Connect. På Android 14 og nyere er det allerede en del af telefonen: søg efter \"Health Connect\" i indstillingerne. På Android 13 og ældre installerer du \"Health Connect by Android\" fra Google Play. Det er gratis.",
              { ref: [1] },
            ],
            [
              "2. Lad din sundhedsapp dele. I Samsung Health åbner du Indstillinger → Health Connect og tillader, at den skriver skridt. Andre sundhedsapps har en lignende kontakt.",
            ],
            ["3. Åbn skridtkortet i FitVen, tryk Allow og tillad, at skridt læses."],
          ],
        },
        {
          heading: "Det kan du forvente",
          paragraphs: [
            [
              "Health Connect har som regel kun de skridt, din sundhedsapp har sendt, siden den blev forbundet. Tidligere dage dukker ikke op af sig selv. Fra den dag, du forbinder, viser FitVen og din sundhedsapp det samme tal.",
            ],
            [
              "FitVen læser kun dine skridt og skriver aldrig noget til Health Connect. Du kan se og fjerne dens adgang i Health Connect.",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
    es: {
      title: "Health Connect: un solo lugar para tus pasos",
      summary: "Health Connect permite que las apps de salud de tu teléfono compartan tus pasos. Por qué conviene configurarlo y cómo hacerlo.",
      inShort: [
        "Health Connect es el lugar compartido de Android para los datos de salud. Samsung Health, la app de tu reloj y FitVen pueden leer de él y escribir en él.",
        "Con él, FitVen muestra los mismos pasos que tu app de salud, incluidos los de tu reloj. Sin él, FitVen solo cuenta los pasos que da el propio teléfono.",
        "Es gratis, viene integrado en Android 14 y posteriores, y tú decides qué app puede leer qué.",
      ],
      sections: [
        {
          heading: "Por qué merece la pena, y no solo para FitVen",
          paragraphs: [
            [
              "Cuando cada app cuenta por su cuenta, no hay dos que coincidan. Health Connect da a tus apps un único conjunto de cifras: los pasos que contó tu reloj llegan a todas las apps que permitas, y si cambias de app o de reloj, el historial se queda donde estaba.",
              { ref: [1, 2] },
            ],
            [
              "Tú mantienes el control. Health Connect muestra qué apps pueden leer y escribir qué, y puedes quitar el permiso a cualquiera de ellas, o borrar los datos, en cualquier momento.",
              { ref: [1] },
            ],
          ],
        },
        {
          heading: "Cómo configurarlo",
          paragraphs: [
            [
              "1. Consigue Health Connect. En Android 14 y posteriores ya forma parte del teléfono: busca \"Health Connect\" en los ajustes. En Android 13 y anteriores, instala \"Health Connect by Android\" desde Google Play. Es gratis.",
              { ref: [1] },
            ],
            [
              "2. Haz que tu app de salud comparta. En Samsung Health, abre Ajustes → Health Connect y permite que escriba pasos. Otras apps de salud tienen un interruptor parecido.",
            ],
            ["3. Abre la tarjeta de pasos en FitVen, toca Permitir y permite la lectura de pasos."],
          ],
        },
        {
          heading: "Qué esperar",
          paragraphs: [
            [
              "Health Connect normalmente solo tiene los pasos que tu app de salud ha enviado desde que se conectó. Los días anteriores no aparecen por sí solos. Desde el día en que conectas, FitVen y tu app de salud muestran la misma cifra.",
            ],
            [
              "FitVen solo lee tus pasos y nunca escribe nada en Health Connect. Puedes ver y quitar su acceso en Health Connect.",
              { ref: [2] },
            ],
          ],
        },
      ],
    },
  },
};
