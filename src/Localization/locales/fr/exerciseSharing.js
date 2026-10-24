// Ce que dit le service d'exercices quand un partage, un ajout ou un signalement échoue.
export default {
  // Levés par src/Services/exerciseService.js et affichés comme error.message.
  errors: {
    offline: "Tu es hors ligne. Réessaie quand tu auras une connexion.",
    signedOut: "Connecte-toi pour partager et ajouter des exercices.",
    notAvailable: "Les exercices partagés ne sont pas encore disponibles. Réessaie plus tard.",
    notFound: "Cet exercice n'est pas sur ce téléphone.",
    exerciseGone: "Cet exercice n'est plus partagé.",
    copyCannotBeShared: "C'est une copie de l'exercice de quelqu'un d'autre, il ne peut donc pas être partagé.",
    nameTaken: "Tu as déjà un exercice portant ce nom.",
    blockedTerms:
      "Un élément du nom, de la description ou des étapes ne peut pas être partagé. Modifie la formulation et réessaie.",
    videoTooLong: "Le clip peut durer {seconds} secondes au maximum.",
    videoTooLarge: "Le clip peut peser {megabytes} Mo au maximum.",
    uploadFailed: "Impossible d'envoyer le clip. Réessaie.",
    generic: "Une erreur est survenue. Réessaie.",
  },
};
