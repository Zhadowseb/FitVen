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
//  this screen. web/privacy/index.html is that page, generated from this file
//  so the two copies cannot say different things - never edit it by hand, run
//  `npm run build:privacy-policy` after changing anything here. Host it, then
//  put the address in PRIVACY_POLICY_URL below and the same one in the Play
//  Console listing.
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
    body: `FitVen is run by a private individual rather than a company, so there is no CVR number.

Sebastian Dalbjørn
Ørnegårdsvej 61, 1. th.
2820 Gentofte
Denmark

Anything about your data — a copy of it, a correction, having it deleted, or a complaint — goes to zhadowseb@gmail.com.`,
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

The map that draws your route is Google Maps. Drawing a route means asking Google for the map of that area, so Google can see roughly where you ran, even though the route itself is never sent to them.

Those three — Supabase, Expo and Google Maps — are the only outside services FitVen uses. There is no analytics, no advertising, no crash reporting, and no mailing list.`,
  },
  {
    title: "How long it is kept",
    body: `Your account data is kept for as long as the account exists.

Notification history is kept for 14 days and then deleted automatically.

When you delete your account, everything is removed immediately. There is no grace period and no backup copy you can be restored from.

There are no database backups today, so nothing survives a deletion anywhere. If backups are turned on later this section has to say how long one is kept, because deleted data lives on inside a backup until it expires.`,
  },
  {
    title: "Who can see your data",
    body: `People who follow you can see whether you are training today, and the workout posts you choose to publish. Nothing else in your account is visible to other users.

Blocking someone removes the follow in both directions and takes you out of each other's search results.

The person responsible for FitVen can read the database directly through the Supabase dashboard. That access exists so the app can be run and repaired, and it is not used to look at individual training data without a reason such as a fault you have reported.`,
  },
  {
    title: "Your rights",
    body: `You can see and correct your profile in the app.

You can delete your account, and everything in it, from your profile — Account, then Delete account.

You have the right to a copy of your data, to have it corrected, to have it erased, and to complain to Datatilsynet if you believe it is being handled wrongly.

For a copy of your data, write to zhadowseb@gmail.com and it will be put together by hand; the app has no export button. You will have an answer within one month, which is the deadline the regulation sets.`,
  },
  {
    title: "Children",
    body: `You have to be at least 13 to use FitVen.

Thirteen is the age at which Danish law lets you consent to your own data being processed. Below it a parent has to give that consent, and FitVen has no way to ask a parent or to check that one answered, so accounts for younger children cannot be created lawfully here.`,
  },
];

// Matched on the opening of the marker rather than the whole of it, so a
// placeholder that names what is missing - [SKAL UDFYLDES: postadresse] - is
// still counted as missing.
const PLACEHOLDER_PREFIX = "[SKAL UDFYLDES";

/** Every section that still carries a placeholder. Empty means it is finished. */
export function getUnfinishedPolicySections() {
  return PRIVACY_POLICY_SECTIONS.filter((section) =>
    section.body.includes(PLACEHOLDER_PREFIX)
  ).map((section) => section.title);
}
