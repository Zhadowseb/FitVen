// Was der Übungs-Service sagt, wenn Teilen, Hinzufügen oder Melden scheitert.
export default {
  errors: {
    offline: "Du bist offline. Versuche es erneut, sobald du Verbindung hast.",
    signedOut: "Melde dich an, um Übungen zu teilen und hinzuzufügen.",
    notAvailable: "Geteilte Übungen sind noch nicht verfügbar. Versuche es später erneut.",
    notFound: "Diese Übung ist nicht auf diesem Handy.",
    exerciseGone: "Diese Übung wird nicht mehr geteilt.",
    copyCannotBeShared: "Das ist eine Kopie der Übung einer anderen Person und kann deshalb nicht geteilt werden.",
    nameTaken: "Du hast bereits eine Übung mit diesem Namen.",
    blockedTerms:
      "Etwas im Namen, in der Beschreibung oder in den Schritten kann nicht geteilt werden. Ändere die Formulierung und versuche es erneut.",
    videoTooLong: "Der Clip darf höchstens {seconds} Sekunden lang sein.",
    videoTooLarge: "Der Clip darf höchstens {megabytes} MB groß sein.",
    uploadFailed: "Der Clip konnte nicht hochgeladen werden. Versuche es erneut.",
    generic: "Etwas ist schiefgelaufen. Versuche es erneut.",
  },
};
