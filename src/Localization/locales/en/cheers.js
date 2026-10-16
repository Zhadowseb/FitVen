// Cheers: the quick replies to "X has started a push!". Keep in step with
// ../da/cheers.js.
export default {
  // The three fixed replies. Their ids (good_workout, lets_go, crush_it) are
  // what is stored; the words are shown in the reader's language.
  presets: {
    goodWorkout: "💪 Good workout!",
    letsGo: "🔥 Let's go!",
    crushIt: "👏 Crush it!",
  },
  writeMessage: "Write a message…",
  send: "Send",
  placeholder: "Say something nice",
  // The inbox row for a cheer you received. {name} is the sender.
  title: "{name} cheered you on",
  someone: "Someone",
  customBody: "💬 {message}",
  youCheered: "You cheered",
  youCheeredWith: "You cheered · {text}",
  sent: "Cheer sent",
  // The local notification when a cheer sent from a notification did not go
  // through. Shown once, never retried.
  sendFailed: "Couldn't send your cheer",
  rowLabel: "Cheer {name} on",
  messageLabel: "Your message",
  settingTitle: "When someone cheers you on",
  settingBody:
    "Get a notification when a friend cheers you on during a workout. With it off, your friends also get no reply buttons on your workout notifications.",
  settingUnavailable:
    "This setting is not available yet. Cheers are not announced until it is.",
  settingSaveFailed: "Could not save the setting for cheers.",
};
