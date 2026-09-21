// The notification inbox and its settings. Keep in step with
// ../da/notifications.js.
export default {
  title: "Notifications",
  loading: "Loading notifications...",
  unavailable: "Notifications unavailable",
  signInToView: "Sign in to view notifications.",
  loadFailed: "Could not load notifications.",
  unread: "Unread",
  itemLabel: "{title}. {body}",
  hints: {
    openVerification: "Opens the centre's lifts waiting for review",
    openActivity: "Opens today's activity",
  },
  emptyTitle: "You're all caught up",
  emptyBody: "Workout starts and future activity updates will appear here.",
  openSettings: "Open notification settings",

  settings: {
    eyebrow: "Settings",
    signInToManage: "Sign in to manage notification settings.",
    loadFailed: "Could not load notification settings.",
    saveFailed: "Could not save notification settings.",
    updateSourcesFailed: "Could not update custom notification list.",
    // The preference is stored either way; these say why the device itself
    // may still not receive anything.
    savedPermissionDenied:
      "Saved. Notification permission was not granted on this device.",
    savedBlockedByOwner:
      "Saved. Another account is still signed in to notifications on this device, so this one will not receive them yet. Sign out of the other account, or wait a week for it to be released.",
    savedRegistrationFailed:
      "Saved. This device could not register for push notifications, so it may not receive them yet.",
    workoutStartTitle: "When a workout starts",
    workoutStartBody:
      "Choose who triggers a notification when they start training.",
    modes: {
      none: {
        title: "No notifications",
        body: "No notifications when someone starts a workout.",
      },
      following: {
        title: "Everyone I follow",
        body: "Get notified when any followed user starts a workout.",
      },
      custom: {
        title: "Pick specific people",
        body: "Only the people you choose below.",
      },
    },
    selectedCount: "SELECTED ({count})",
    removeNamed: "Remove {name}",
    personFallback: "person",
    nobodySelected: "Nobody selected yet. Pick people from the list below.",
    searchPlaceholder: "Search people you follow",
    noMatches: "No followed people matched.",
  },

  // Thrown by Services/notificationService.js and shown as error.message.
  errors: {
    signInToLoadSettings:
      "You need to be signed in to load notification settings.",
    signInToUpdateSettings:
      "You need to be signed in to update notification settings.",
    signInToLoad: "You need to be signed in to load notifications.",
  },
};
