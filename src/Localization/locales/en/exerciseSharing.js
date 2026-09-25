// What the exercise service says when sharing, adding or reporting fails. Keep in step with ../da/exerciseSharing.js.
export default {
  // Thrown by src/Services/exerciseService.js and shown as error.message.
  errors: {
    offline: "You're offline. Try again when you have a connection.",
    signedOut: "Sign in to share and add exercises.",
    notAvailable: "Shared exercises aren't available yet. Try again later.",
    notFound: "This exercise isn't on this phone.",
    exerciseGone: "This exercise is no longer shared.",
    copyCannotBeShared: "This is a copy of somebody else's exercise, so it can't be shared.",
    nameTaken: "You already have an exercise with this name.",
    blockedTerms:
      "Something in the name, description or steps can't be shared. Change the wording and try again.",
    videoTooLong: "The clip can be at most {seconds} seconds long.",
    videoTooLarge: "The clip can be at most {megabytes} MB.",
    uploadFailed: "The clip could not be uploaded. Try again.",
    generic: "Something went wrong. Try again.",
  },
};
