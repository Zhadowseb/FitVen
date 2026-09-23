// The terms shown before anyone can create an account, and the version recorded
// against their acceptance.
//
// This exists because App Review asked for it by name. Apple's guideline 1.2
// requires four things of an app with user-generated content; FitVen had
// filtering, reporting, blocking and a published contact address, and was still
// rejected:
//
//   "require that users agree to terms (EULA) and these terms must make it
//    clear that there is no tolerance for objectionable content or abusive
//    users"
//
// So the zero-tolerance wording below is not decoration - it is the specific
// thing being asked for, and it has to stay in whatever else changes.
//
// This is the source. web/terms/index.html is the public copy at TERMS_URL and
// is generated from it; run `npm run build:terms` after any change here, and
// npm test fails if the two have drifted.
//
// Raise TERMS_VERSION when what somebody is agreeing to changes. Everyone who
// has already accepted is asked again on their next launch, and the new version
// is recorded against them. Fixing a typo is not that.

export const TERMS_VERSION = "2026-09-16";

/** The public copy, linked from the register screen and from the store pages. */
export const TERMS_URL = "https://fitven.dk/terms/";

export const TERMS_LAST_UPDATED = "16 September 2026";

/** Shown next to the checkbox on the register screen. Keep it to one breath. */
export const TERMS_SUMMARY =
  "There is no tolerance for objectionable content or abusive behaviour. Break that and the account goes.";

export const TERMS_SECTIONS = [
  {
    title: "Who you are agreeing with",
    body: `These terms of use are the end user licence agreement (EULA) between you and FitVen. You accept them when you create an account, and you cannot create one without accepting them.

FitVen is published by Spiral Technologies, a sole proprietorship (enkeltmandsvirksomhed) owned and run by Sebastian Dalbjørn-Winblad. A sole proprietorship is not a separate legal entity, so the person responsible is Sebastian Dalbjørn-Winblad personally.

Spiral Technologies
CVR 41755970
Ørnegårdsvej 61, 1. th.
2820 Gentofte
Denmark

Questions about these terms go to zhadowseb@gmail.com.

You have to be at least 13 to use FitVen.`,
  },
  {
    title: "No tolerance for objectionable content or abusive users",
    body: `This is the part that matters most, so it is said plainly.

There is zero tolerance for objectionable content and for abusive behaviour towards other people using FitVen.

Objectionable content includes, and is not limited to: material that is sexual, violent, hateful or harassing; slurs and abuse aimed at anyone's race, ethnicity, nationality, religion, disability, sex, gender identity, age or sexual orientation; threats; content that sexualises or endangers a minor; impersonating somebody else; and spam or advertising.

Abusive behaviour includes, and is not limited to: harassing, bullying, intimidating, stalking or repeatedly contacting somebody who does not want to hear from you.

Post none of it, and do none of it. This applies to everything other people can see: a workout note, a display name, a bio, a profile photo.`,
  },
  {
    title: "What happens when somebody breaks this",
    body: `Content that breaks these terms is removed, and the account that posted it can be suspended or deleted without warning and without a refund — FitVen is free, so there is nothing to refund, but it is said for the avoidance of doubt.

Reports are read and acted on within 24 hours. Acting on one can mean removing the content, warning the account, or ending it.

There is no appeal process beyond writing to the address above. A decision to end an account for abuse is not up for negotiation.`,
  },
  {
    title: "The tools you have",
    body: `Report — every profile in your followers and following lists has a Report button. Choose a reason, add a note if you want to, and it reaches the developer. The person you report is not told who reported them.

Block — every profile in those lists has a Block button. Blocking removes the follow in both directions immediately, so their activity leaves your feed at once and yours leaves theirs. They cannot follow you again or find you in search, and they are not told they were blocked. Blocking also tells the developer, so the account can be looked at.

Choose who sees a post — every workout summary is published to everyone, to your followers only, or to nobody, and you choose which exercises are included. Nothing is published unless you publish it.

Delete — any program, workout, exercise, set, sickness entry or post can be deleted on its own. The whole account can be deleted from inside the app, from Profile, and that is immediate and final.`,
  },
  {
    title: "Your content stays yours",
    body: `What you write and upload is yours. You keep it.

By posting, you allow FitVen to store it and to show it to the people you chose to show it to, for as long as you keep it there. That permission ends when you delete the content or the account.

Do not post anything you do not have the right to post.`,
  },
  {
    title: "What FitVen is not",
    body: `FitVen is a training log. It is not a medical device, and nothing in it is medical advice, a diagnosis or a treatment plan.

Training carries risk of injury. What you lift and how you train is your decision and your responsibility. If you are unsure whether an exercise is safe for you, ask a doctor or a qualified coach rather than an app.

FitVen is provided as it is. It is free, and there is no promise that it will be available without interruption or free of faults.`,
  },
  {
    title: "Your data",
    body: `How your data is handled is set out separately in the privacy policy at https://fitven.dk/privacy/, which you are also asked to accept.

The short version: it is stored so the app can work, it is not sold, and there is no advertising or tracking in FitVen.`,
  },
  {
    title: "Changes, and the law that applies",
    body: `These terms can change. When what you are agreeing to changes, the version is raised and you are asked again the next time you open the app.

Danish law applies.`,
  },
];

/** Plain text of the whole thing, for the generated page and for tests. */
export function getTermsPlainText() {
  return TERMS_SECTIONS.map(
    (section) => `${section.title}\n\n${section.body}`
  ).join("\n\n");
}
