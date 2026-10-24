// Le profil de quelqu'un d'autre - la page où tu arrives depuis un nom - et ton propre profil
// tel que les autres le voient.
export default {
  menu: {
    open: "Options du profil",
    share: "Partager le profil",
  },
  following: "Suivi",
  share: {
    action: "Partager",
    // Il n'y a pas de profil sur le web vers lequel faire un lien, donc c'est le nom
    // d'utilisateur - qui le fait trouver dans la recherche - que le message contient.
    message: "{name} sur FitVen (@{username})",
  },
  // Après le nom de la salle, quand c'est aussi la salle du lecteur.
  yourCentre: "· ta salle",
  // L'indication sur un nom ou une photo qui ouvre le profil de quelqu'un.
  opensProfile: "Ouvre son profil",
  stats: {
    followers: "Abonnés",
    following: "Abonnements",
    workouts: "Séances",
  },
  records: {
    title: "Records",
    rankAt: "#{rank} à {gym}",
    rank: "#{rank} dans la salle",
    notRanked: "Non classé",
  },
  activity: {
    title: "Activité",
    perWeek: { one: "séance par semaine", other: "séances par semaine" },
    footnote: "{count} semaines · dernière semaine en évidence",
    // Lu à la place des barres, qui n'ont pas de chiffres.
    barsLabel: "Séances par semaine sur les {count} dernières semaines, de la plus ancienne à la plus récente : {weeks}",
  },
  posts: {
    title: "Publications",
    seeAll: "Voir les {count}",
    openPost: "Ouvrir la publication {title}",
    untitled: "Séance",
    failed: "Impossible de charger les publications.",
  },
  preview: {
    title: "Comment les autres te voient",
    banner: "Aperçu. Voici à quoi ressemble ton profil pour quelqu'un qui ne te suit pas.",
  },
  // Introuvable et bloqué se lisent pareil, exprès.
  unavailable: {
    title: "Ce profil n'est pas disponible",
    body: "Il a peut-être été supprimé, ou il ne peut pas être ouvert pour le moment.",
  },
  error: {
    title: "Impossible de charger le profil",
    body: "Vérifie ta connexion et réessaie.",
  },
  // La liste complète derrière « Voir les ».
  userPosts: {
    eyebrow: "Publications de",
    fallbackTitle: "Publications",
    emptyTitle: "Aucune publication à afficher",
    emptyBody: "Quand cette personne publie une séance que tu peux voir, elle apparaît ici.",
    failed: "Impossible de charger les publications. Réessaie dans un instant.",
  },
};
