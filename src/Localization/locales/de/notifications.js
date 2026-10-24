// Das Benachrichtigungs-Postfach und seine Einstellungen.
export default {
  title: "Benachrichtigungen",
  loading: "Benachrichtigungen werden geladen...",
  unavailable: "Benachrichtigungen nicht verfügbar",
  signInToView: "Melde dich an, um Benachrichtigungen zu sehen.",
  loadFailed: "Benachrichtigungen konnten nicht geladen werden.",
  unread: "Ungelesen",
  itemLabel: "{title}. {body}",
  hints: {
    openActivity: "Öffnet die heutige Aktivität",
    openExercise: "Öffnet deine Übung",
    openPost: "Öffnet deinen Beitrag",
  },
  customExerciseHidden: {
    title: "Deine Übung wurde ausgeblendet",
    body: "{name} wurde von mehreren Personen gemeldet und erscheint nicht mehr in der Bibliothek. Bereits hinzugefügte Kopien bleiben bestehen.",
  },
  postLiked: {
    title: "{name} gefällt dein Beitrag",
    bodyFallback: "Dein Workout-Beitrag",
    someone: "Jemand",
  },
  emptyTitle: "Du bist auf dem neuesten Stand",
  emptyBody: "Wenn jemand ein Workout startet oder einen deiner Beiträge liked, siehst du es hier.",
  openSettings: "Benachrichtigungseinstellungen öffnen",

  settings: {
    eyebrow: "Einstellungen",
    lockScreenTitle: "Workout auf dem Sperrbildschirm zeigen",
    lockScreenBody:
      "Während du Kraft trainierst, sind Satz, Pause und Zeit auf dem Sperrbildschirm und in der Dynamic Island zu sehen, mit Buttons zum Abhaken des Satzes und zum Überspringen der Pause. Ein Ton sagt dir, wann die Pause vorbei ist.",
    lockScreenUnavailable:
      "Dein Handy zeigt die Karte gerade nicht an. Auf dem iPhone braucht es iOS 16.2 oder neuer, mit eingeschalteten Live-Aktivitäten für FitVen in den Einstellungen.",
    signInToManage: "Melde dich an, um Benachrichtigungseinstellungen zu verwalten.",
    loadFailed: "Benachrichtigungseinstellungen konnten nicht geladen werden.",
    saveFailed: "Benachrichtigungseinstellungen konnten nicht gespeichert werden.",
    updateSourcesFailed: "Die eigene Benachrichtigungsliste konnte nicht aktualisiert werden.",
    savedPermissionDenied:
      "Gespeichert. Die Berechtigung für Benachrichtigungen wurde auf diesem Gerät nicht erteilt.",
    savedBlockedByOwner:
      "Gespeichert. Auf diesem Gerät ist noch ein anderes Konto für Benachrichtigungen angemeldet, daher erhält dieses sie noch nicht. Melde das andere Konto ab oder warte eine Woche, bis es freigegeben wird.",
    savedRegistrationFailed:
      "Gespeichert. Dieses Gerät konnte sich nicht für Push-Benachrichtigungen registrieren und erhält sie möglicherweise noch nicht.",
    postLikesTitle: "Wenn jemandem dein Beitrag gefällt",
    postLikesBody:
      "Erhalte eine Benachrichtigung, wenn jemandem einer deiner Workout-Beiträge gefällt. Einmal pro Person und Beitrag.",
    postLikesUnavailable:
      "Diese Einstellung ist noch nicht verfügbar. Likes werden erst angekündigt, wenn die Einstellung verfügbar ist.",
    postLikesSaveFailed: "Die Einstellung für Likes konnte nicht gespeichert werden.",
    workoutStartTitle: "Wenn ein Workout startet",
    workoutStartBody:
      "Wähle, wessen Trainingsstart eine Benachrichtigung auslöst.",
    modes: {
      none: {
        title: "Keine Benachrichtigungen",
        body: "Keine Benachrichtigung, wenn jemand ein Workout startet.",
      },
      following: {
        title: "Alle, denen ich folge",
        body: "Werde benachrichtigt, wenn jemand, dem du folgst, ein Workout startet.",
      },
      custom: {
        title: "Bestimmte Personen wählen",
        body: "Nur die Personen, die du unten auswählst.",
      },
    },
    selectedCount: "AUSGEWÄHLT ({count})",
    removeNamed: "{name} entfernen",
    personFallback: "Person",
    nobodySelected: "Noch niemand ausgewählt. Wähle Personen aus der Liste unten.",
    searchPlaceholder: "Personen suchen, denen du folgst",
    noMatches: "Keine gefolgte Person passt.",
  },

  errors: {
    signInToLoadSettings:
      "Du musst angemeldet sein, um Benachrichtigungseinstellungen zu laden.",
    signInToUpdateSettings:
      "Du musst angemeldet sein, um Benachrichtigungseinstellungen zu ändern.",
    signInToLoad: "Du musst angemeldet sein, um Benachrichtigungen zu laden.",
  },
};
