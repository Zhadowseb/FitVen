// The privacy policy shown in the app, and the version recorded against each
// user's consent.
//
// ─────────────────────────────────────────────────────────────────────────────
//  THE TEXT BELOW IS NOT FINISHED AND MUST NOT SHIP AS IT STANDS.
//
//  Everything marked [SKAL UDFYLDES] is a legal statement about who you are and
//  what you do with people's data. It is not something this file can guess, and
//  a wrong answer in a privacy policy is worse than no policy at all.
//
//  Google Play also requires a privacy policy at a public URL, separate from
//  this screen. Put that address in PRIVACY_POLICY_URL below and the same one
//  in the Play Console listing.
//
//  When you change the wording in a way that changes what people are agreeing
//  to, raise PRIVACY_POLICY_VERSION. Everyone is asked again on their next
//  launch, and the new version is recorded against them.
// ─────────────────────────────────────────────────────────────────────────────

export const PRIVACY_POLICY_VERSION = "2026-09-05";

/** The public copy. Required by Google Play; leave empty until it exists. */
export const PRIVACY_POLICY_URL = "";

export const PRIVACY_POLICY_LAST_UPDATED = "5 September 2026";

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: "Who is responsible",
    body: `[SKAL UDFYLDES] The name, address and CVR number of the person or company that is the data controller for FitVen, and an email address people can write to about their data.`,
  },
  {
    title: "What FitVen stores about you",
    body: `Your email address and password, used to sign in.

Your profile: display name, username, an optional short bio, an optional photo, and your birth year.

Your training: programs, workouts, exercises, sets, weights, repetitions, personal records and the notes you write on them.

Health data: sickness and injury entries you record, heart rate measured from a chest strap or watch, and — if you use the run screen — your location while a run is being tracked, along with the route it produces.

Social: who you follow, who follows you, who you have blocked, the workout posts you publish and the posts you like.

Notifications: the notifications you have been sent, and a push token identifying this device so they can reach it.`,
  },
  {
    title: "Health data and why we ask",
    body: `Sickness entries, heart rate and route data are health data. European law treats health data as a special category and does not allow it to be stored on the basis of an ordinary legitimate interest — it needs your explicit consent, which is what the screen asking you to accept this policy is for.

You can withdraw that consent at any time by deleting your account, which removes everything listed above. There is no way to keep the account and withdraw consent separately, because the app has no use without this data.`,
  },
  {
    title: "Where it is stored",
    body: `Training and profile data is stored on Supabase in the eu-north-1 region, in Sweden, inside the EU.

Push notifications are delivered through Expo's notification service, which means a notification's title and text pass through Expo's servers on the way to your phone.

Location is only read while a run is actively being tracked, and only if you allow it. It is stored with the run.

[SKAL UDFYLDES] If you add any other service that receives user data — analytics, crash reporting, a mailing list — it has to be named here.`,
  },
  {
    title: "How long it is kept",
    body: `Your account data is kept for as long as the account exists.

Notification history is kept for 14 days and then deleted automatically.

When you delete your account, everything is removed immediately. There is no grace period and no backup copy you can be restored from.

[SKAL UDFYLDES] If backups are turned on later, say how long a backup is kept, because data survives in a backup after deletion.`,
  },
  {
    title: "Who can see your data",
    body: `People who follow you can see whether you are training today, and the workout posts you choose to publish. Nothing else in your account is visible to other users.

Blocking someone removes the follow in both directions and takes you out of each other's search results.

[SKAL UDFYLDES] Whether anyone at your end can read user data in the Supabase dashboard, and under what circumstances.`,
  },
  {
    title: "Your rights",
    body: `You can see and correct your profile in the app.

You can delete your account, and everything in it, from your profile — Account, then Delete account.

You have the right to a copy of your data, to have it corrected, to have it erased, and to complain to Datatilsynet if you believe it is being handled wrongly.

[SKAL UDFYLDES] The email address people write to in order to exercise those rights, and how quickly they can expect an answer.`,
  },
  {
    title: "Children",
    body: `[SKAL UDFYLDES] The minimum age for using FitVen. In Denmark, consent for data processing can be given from the age of 13; below that a parent has to give it. Decide the age and say it here, and be aware that Google Play asks the same question in the listing.`,
  },
];

/** Every section that still carries a placeholder. Empty means it is finished. */
export function getUnfinishedPolicySections() {
  return PRIVACY_POLICY_SECTIONS.filter((section) =>
    section.body.includes("[SKAL UDFYLDES]")
  ).map((section) => section.title);
}
