// Profil -> Réglages -> Musique, et les erreurs du service de musique visibles par l'utilisateur.
export default {
  settings: {
    eyebrow: "Réglages",
    title: "Musique",
    note: "Ta connexion Spotify reste sur ce téléphone. Seuls les noms des titres et des artistes en sortent, et seulement pendant une séance.",
    couldNotLoad: "Impossible de charger les réglages de musique.",
  },
  status: {
    checking: "Vérification…",
    connectedAs: "Connecté en tant que {name}",
    connected: "Connecté",
    notConnected: "Non connecté",
    notAvailable: "Indisponible dans cette version",
  },
  connect: "Connecter",
  disconnect: "Déconnecter",
  connection: {
    connectedAs: "Connecté à Spotify en tant que {name}.",
    connected: "Connecté à Spotify.",
    couldNotConnect: "Impossible de connecter Spotify.",
    disconnected: "Spotify déconnecté. Plus rien n'est partagé.",
    couldNotDisconnect: "Impossible de déconnecter Spotify.",
  },
  shareWithFriends: {
    title: "Partager ta musique avec tes amis",
    body: "Les personnes que tu suis en retour voient le titre en cours pendant que tu t'entraînes, puis le dernier ensuite. Désactiver supprime ce qui a été partagé.",
    signInToShare: "Connecte-toi pour partager ta musique.",
    turnedOn: "Tes abonnés voient maintenant ce qui passe pendant que tu t'entraînes.",
    turnedOff: "Le partage est désactivé et ce qui avait été partagé a été supprimé.",
    couldNotChange: "Impossible de modifier le partage de musique.",
  },
  errors: {
    notInBuild:
      "Cette version de l'app n'inclut pas les modules dont Spotify a besoin. Installe la version de développement 2.0.",
    signInToChangeSharing: "Tu dois être connecté pour modifier le partage de musique.",
    failed: "Échec de la musique.",
  },
};
