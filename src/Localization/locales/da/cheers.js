// Heppe-råb ("cheers"): de hurtige svar til "X er begyndt at træne". Hold i
// trit med ../en/cheers.js.
export default {
  // De tre faste svar. Deres id'er (good_workout, lets_go, crush_it) er det,
  // der gemmes; ordene vises på læserens sprog.
  presets: {
    goodWorkout: "💪 God træning!",
    letsGo: "🔥 Kom så!",
    crushIt: "👏 Giv den gas!",
  },
  writeMessage: "Skriv en besked…",
  send: "Send",
  placeholder: "Sig noget pænt",
  // Indbakkerækken for et hepperåb, du har fået. {name} er afsenderen.
  title: "{name} hepper på dig",
  someone: "Nogen",
  customBody: "💬 {message}",
  youCheered: "Du heppede",
  youCheeredWith: "Du heppede · {text}",
  sent: "Hepperåb sendt",
  // Den lokale notifikation, når et hepperåb sendt fra en notifikation ikke
  // nåede frem. Vises én gang og prøves ikke igen.
  sendFailed: "Kunne ikke sende dit hepperåb",
  rowLabel: "Hep på {name}",
  messageLabel: "Din besked",
  settingTitle: "Når nogen hepper på dig",
  settingBody:
    "Få besked, når en ven hepper på dig under en træning. Er den slået fra, får dine venner heller ikke svarknapper på dine træningsnotifikationer.",
  settingUnavailable:
    "Indstillingen er ikke klar endnu. Indtil da får du ikke besked om hepperåb.",
  settingSaveFailed: "Kunne ikke gemme indstillingen for hepperåb.",
};
