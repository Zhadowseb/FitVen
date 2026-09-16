// App Review rejected FitVen once for not having these terms, and named what
// they had to say:
//
//   "require that users agree to terms (EULA) and these terms must make it
//    clear that there is no tolerance for objectionable content or abusive
//    users"
//
// That wording is load-bearing. Someone tidying the prose later has no way of
// knowing that, so this test says it out loud: the zero-tolerance clause stays,
// the register screen cannot create an account without the box ticked, and the
// gate records the version it showed.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const termsSource = read("src/Resources/Legal/termsOfUse.js");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(
    termsSource
  ).toString("base64")}`;
  const terms = await import(moduleUrl);

  /* ------------------------------------------- the clause Apple asked for -- */

  const allText = [
    terms.TERMS_SUMMARY,
    ...terms.TERMS_SECTIONS.map((s) => `${s.title}\n${s.body}`),
  ]
    .join("\n")
    .toLowerCase();

  assert.ok(
    /no tolerance|zero tolerance/.test(allText),
    "the terms no longer state a no-tolerance position - App Review asked for that in writing"
  );

  assert.ok(
    allText.includes("objectionable content"),
    "the terms no longer use the phrase 'objectionable content'"
  );

  assert.ok(
    /abusive (behaviour|behavior|users)/.test(allText),
    "the terms no longer mention abusive users or behaviour"
  );

  // The summary is what somebody actually reads next to the checkbox. The full
  // document being correct is no help if the one line beside the tick is not.
  assert.ok(
    /no tolerance|zero tolerance/.test(String(terms.TERMS_SUMMARY).toLowerCase()),
    "TERMS_SUMMARY is the line shown beside the checkbox and no longer carries the no-tolerance wording"
  );

  assert.ok(terms.TERMS_VERSION, "TERMS_VERSION is missing");
  assert.ok(
    String(terms.TERMS_URL).startsWith("https://"),
    "TERMS_URL is not a public https address"
  );

  /* ---------------------------------------- the register screen enforces it -- */

  const register = read("src/Pages/RegisterPage/RegisterPage.js");

  assert.ok(
    /if \(!hasAcceptedTerms\) \{\s*errors\.terms/.test(register),
    "the register screen no longer refuses to submit without the terms accepted"
  );

  assert.ok(
    register.includes("useState(false)") &&
      /const \[hasAcceptedTerms, setHasAcceptedTerms\] = useState\(false\)/.test(
        register
      ),
    "the terms checkbox no longer starts unticked - a pre-ticked box is not an agreement"
  );

  /* -------------------------------------------- the gate records the answer -- */

  const gate = read(
    "src/Resources/Components/PrivacyConsentGate/PrivacyConsentGate.js"
  );

  assert.ok(
    gate.includes("TERMS_VERSION"),
    "the consent gate no longer checks the terms version"
  );

  assert.ok(
    /consent\.termsVersion === TERMS_VERSION/.test(gate),
    "the gate no longer compares the accepted terms version with the current one"
  );

  /* ------------------------------------------- blocking tells the developer -- */

  const migration = read("supabase/migrations/20260916140000_terms-of-use.sql");

  assert.ok(
    /after insert on public\.user_blocks/.test(migration),
    "blocking no longer raises the notification App Review asked for"
  );

  assert.ok(
    /source text not null default 'user'/.test(migration),
    "user_reports lost the column that tells an automatic report from a deliberate one"
  );

  // An exception in the trigger would roll the block back with it, and somebody
  // asking to be left alone must not be refused because a notification failed.
  assert.ok(
    /exception\s*\n\s*when others then/.test(migration),
    "the block notification is no longer wrapped - a failure there would undo the block"
  );

  console.log("Terms of use: clause, register gate, consent gate and block notice passed.");
}
