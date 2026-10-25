// Eine geteilte Übung (Screen 1b) und das Melden.
export default {
  added: "{name} zu deinen Übungen hinzugefügt",
  menu: {
    open: "Weitere Optionen",
    report: "Übung melden",
  },
  video: {
    play: "Video abspielen",
    pause: "Video pausieren",
    unavailable: "Das Video kann gerade nicht abgespielt werden",
    needsUpdate: "Aktualisiere die App, um das Video abzuspielen",
  },
  owner: {
    madeOn: "Erstellt am {date}",
    profile: "Profil",
    openProfile: "Profil von {name} öffnen",
    someone: "Ein FitVen-Mitglied",
  },
  stats: {
    users: "Nutzen sie",
    gymUsers: "In deinem Gym",
    noGym: "Kein Gym",
    noGymLabel: "In deinem Gym: Du hast kein Gym gewählt",
    typical: "Üblich",
    unknown: "noch nicht bekannt",
  },
  steps: {
    title: "So geht's",
    step: "Schritt {number}: {text}",
  },
  distribution: {
    title: "Was andere heben",
    typicalWeightReps: {
      one: "üblich: {weight} kg für {reps} Wdh.",
      other: "üblich: {weight} kg für {reps} Wdh.",
    },
    typicalWeight: "üblich: {weight} kg",
    typicalReps: { one: "üblich: {reps} Wdh.", other: "üblich: {reps} Wdh." },
    rangeUnder: "unter {to} kg",
    rangeOver: "{from} kg oder mehr",
    rangeBetween: "{from} bis {to} kg",
    summary: {
      one: "Was andere heben: am häufigsten {range}, aus {sets} geloggtem Satz.",
      other: "Was andere heben: am häufigsten {range}, aus {sets} geloggten Sätzen.",
    },
  },
  actions: {
    add: "Zu meinen Übungen hinzufügen",
    adding: "Wird hinzugefügt…",
    added: "Hinzugefügt",
    edit: "Deine Übung bearbeiten",
    save: "Speichern",
    saved: "Gespeichert",
  },
  nameTaken: "Du hast bereits eine Übung namens {name}, deshalb kann diese nicht hinzugefügt werden.",
  addFailed: "Sie konnte nicht hinzugefügt werden. Versuche es erneut.",
  saveFailed: "Das hat nicht geklappt. Versuche es erneut.",
  footnote: "Name, Equipment und Muskelgruppe werden in deine Übungen kopiert – nicht die Sätze des Erstellers.",
  footnoteMine: "Wer sie hinzufügt, erhält Name, Equipment und Muskelgruppe – nie deine Sätze.",
  unavailable: {
    title: "Diese Übung ist nicht mehr verfügbar",
    body: "Sie wurde möglicherweise entfernt oder wird nicht mehr geteilt.",
  },
  error: {
    title: "Die Übung konnte nicht geladen werden",
    body: "Unterwegs ist etwas schiefgelaufen. Versuche es gleich noch einmal.",
  },
  offline: {
    title: "Du bist offline",
    body: "Verbinde dich mit dem Internet, um diese Übung zu sehen.",
  },
  report: {
    title: "Übung melden",
    message:
      "Sag uns, was nicht stimmt. Meldungen werden vom Entwickler gelesen, und der Ersteller erfährt nie, wer eine gesendet hat.",
    reasons: {
      wrong: "Falsch oder irreführend",
      offensive: "Anstößig",
      duplicate: "Ein Duplikat",
      other: "Etwas anderes",
    },
    notePlaceholder: "Noch etwas, das wir wissen sollten? (optional)",
    send: "Meldung senden",
    thanks: "Danke – wir schauen es uns an.",
    failed: "Die Meldung konnte nicht gesendet werden. Versuche es erneut.",
  },
};
