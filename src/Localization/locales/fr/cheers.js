// Les encouragements : réponses rapides à « X a lancé une séance ! ».
export default {
  // Les trois réponses fixes. Leurs identifiants (good_workout, lets_go, crush_it)
  // sont ceux qui sont enregistrés ; les mots s'affichent dans la langue du lecteur.
  presets: {
    goodWorkout: "💪 Bonne séance !",
    letsGo: "🔥 Allez !",
    crushIt: "👏 Éclate-toi !",
  },
  writeMessage: "Écris un message…",
  send: "Envoyer",
  placeholder: "Dis quelque chose de sympa",
  // La ligne de la boîte de réception pour un encouragement reçu. {name} est l'expéditeur.
  title: "{name} t'a envoyé un encouragement",
  someone: "Quelqu'un",
  customBody: "💬 {message}",
  youCheered: "Tu as encouragé",
  youCheeredWith: "Tu as encouragé · {text}",
  sent: "Encouragement envoyé",
  // La notification locale quand un encouragement envoyé depuis une notification
  // n'est pas passé. Affichée une seule fois, jamais renvoyée.
  sendFailed: "Impossible d'envoyer ton encouragement",
  rowLabel: "Encourager {name}",
  messageLabel: "Ton message",
  settingTitle: "Quand quelqu'un t'encourage",
  settingBody:
    "Reçois une notification quand un ami t'encourage pendant une séance. Si c'est désactivé, tes amis n'ont pas non plus de boutons de réponse sur les notifications de tes séances.",
  settingUnavailable:
    "Ce réglage n'est pas encore disponible. Les encouragements ne sont pas annoncés tant qu'il ne l'est pas.",
  settingSaveFailed: "Impossible d'enregistrer le réglage des encouragements.",
};
