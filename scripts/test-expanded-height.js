// The expand/collapse animation interpolates towards a stored height, and the
// rule for when to replace that height is the kind that looks right and is not.
// The first version only ever grew it, which meant a card that had been tall
// once stayed tall: add a set, delete it again, and an empty strip was left
// under the last row until the card was collapsed and reopened.
//
// Reported from a device on both platforms, so it was never a modal problem or
// an iOS one - it was this predicate.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const rulePath = path.join(
  rootDir,
  "src",
  "Pages",
  "WorkoutPage",
  "WorkoutTypes",
  "Resistance",
  "Components",
  "ExerciseList",
  "Components",
  "ExerciseRow",
  "expandedHeightRule.js"
);

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function run() {
  const source = fs.readFileSync(rulePath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString(
    "base64"
  )}`;
  const { shouldStoreExpandedHeight } = await import(moduleUrl);

  // Growing is always real: a set was added, or a column was turned on.
  assert.strictEqual(
    shouldStoreExpandedHeight({
      measuredHeight: 420,
      storedHeight: 300,
      isExpanded: true,
    }),
    true
  );

  // ...even measured on the way open, before the row reports as expanded.
  assert.strictEqual(
    shouldStoreExpandedHeight({
      measuredHeight: 420,
      storedHeight: 300,
      isExpanded: false,
    }),
    true
  );

  // The bug. A set was deleted while the row is open, so the section really is
  // shorter and the card has to come back down with it.
  assert.strictEqual(
    shouldStoreExpandedHeight({
      measuredHeight: 300,
      storedHeight: 420,
      isExpanded: true,
    }),
    true
  );

  // The reason the old rule existed. A collapse is playing: the section is
  // still mounted and reports its way down, and storing that would leave the
  // target at or near zero, so the row could never open again.
  assert.strictEqual(
    shouldStoreExpandedHeight({
      measuredHeight: 120,
      storedHeight: 420,
      isExpanded: false,
    }),
    false
  );

  // A zero measurement is never worth storing, open or not: it is either the
  // end of a collapse or a frame before the content exists, and a zero target
  // means the row cannot animate at all.
  for (const isExpanded of [true, false]) {
    assert.strictEqual(
      shouldStoreExpandedHeight({
        measuredHeight: 0,
        storedHeight: 420,
        isExpanded,
      }),
      false
    );
  }

  // First measurement, nothing stored yet.
  assert.strictEqual(
    shouldStoreExpandedHeight({
      measuredHeight: 380,
      storedHeight: 0,
      isExpanded: true,
    }),
    true
  );

  console.log("Expanded-height rule: grow, shrink while open, hold on collapse passed.");
}
