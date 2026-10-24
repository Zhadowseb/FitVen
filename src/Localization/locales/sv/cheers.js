// Cheers: the quick replies to "X has started a push!".
export default {
  // The three fixed replies. Their ids (good_workout, lets_go, crush_it) are
  // what is stored; the words are shown in the reader's language.
  presets: {
    goodWorkout: "💪 Bra pass!",
    letsGo: "🔥 Nu kör vi!",
    crushIt: "👏 Krossa det!",
  },
  writeMessage: "Skriv ett meddelande…",
  send: "Skicka",
  placeholder: "Säg något snällt",
  // The inbox row for a cheer you received. {name} is the sender.
  title: "{name} hejade på dig",
  someone: "Någon",
  customBody: "💬 {message}",
  youCheered: "Du hejade",
  youCheeredWith: "Du hejade · {text}",
  sent: "Hejarop skickat",
  // The local notification when a cheer sent from a notification did not go
  // through. Shown once, never retried.
  sendFailed: "Ditt hejarop kunde inte skickas",
  rowLabel: "Heja på {name}",
  messageLabel: "Ditt meddelande",
  settingTitle: "När någon hejar på dig",
  settingBody:
    "Få en avisering när en vän hejar på dig under ett pass. När det är avstängt får dina vänner inte heller några svarsknappar på dina passaviseringar.",
  settingUnavailable:
    "Den här inställningen är inte tillgänglig än. Hejarop aviseras inte förrän den är det.",
  settingSaveFailed: "Inställningen för hejarop kunde inte sparas.",
};
