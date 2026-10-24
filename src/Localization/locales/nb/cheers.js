// Heiarop: hurtigsvarene på "X har startet en økt!".
export default {
  // De tre faste svarene. IDene (good_workout, lets_go, crush_it) er det som
  // lagres; ordene vises på leserens språk.
  presets: {
    goodWorkout: "💪 God økt!",
    letsGo: "🔥 Kjør på!",
    crushIt: "👏 Knus det!",
  },
  writeMessage: "Skriv en melding…",
  send: "Send",
  placeholder: "Si noe hyggelig",
  // Innbokslinjen for et heiarop du har fått. {name} er avsenderen.
  title: "{name} heiet på deg",
  someone: "Noen",
  customBody: "💬 {message}",
  youCheered: "Du heiet",
  youCheeredWith: "Du heiet · {text}",
  sent: "Heiarop sendt",
  // Det lokale varselet når et heiarop sendt fra et varsel ikke gikk gjennom.
  // Vises én gang, aldri på nytt.
  sendFailed: "Kunne ikke sende heiaropet ditt",
  rowLabel: "Hei på {name}",
  messageLabel: "Meldingen din",
  settingTitle: "Når noen heier på deg",
  settingBody:
    "Få et varsel når en venn heier på deg under en økt. Er den av, får vennene dine heller ingen svarknapper på øktvarslene dine.",
  settingUnavailable:
    "Denne innstillingen er ikke tilgjengelig ennå. Heiarop varsles ikke før den er det.",
  settingSaveFailed: "Kunne ikke lagre innstillingen for heiarop.",
};
