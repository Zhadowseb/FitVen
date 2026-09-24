// A workout post sent from the finish sheet goes on in the background, and
// the sheet takes the person Home, where a bar says how it is getting on.
//
// Two small pieces carry that and both fail quietly if they are wrong: the
// status store, where a stale post must not overwrite a newer one's status,
// and the way Home is reached, which must hand back the Home already on the
// stack - with its key - rather than build a new one.

const assert = require("assert");
const loadAppModule = require("./lib/loadAppModule");

const events = loadAppModule("src/Utils/workoutPostEvents.js");
const { goHome } = loadAppModule("src/Utils/goHome.js");

/* ------------------------------------------------------------- status -- */

const seen = [];
const unsubscribe = events.subscribeWorkoutPost((status) => seen.push(status));

assert.deepStrictEqual(seen, [null], "a subscriber is not told the status straight away");

events.setWorkoutPostStatus({ id: 1, workoutId: 10, state: "posting" });
events.setWorkoutPostStatus({ id: 2, workoutId: 11, state: "posting" });

// The first post finishing late must not rewrite the second's bar.
events.updateWorkoutPostStatus(1, { state: "posted" });
assert.strictEqual(events.getWorkoutPostStatus().id, 2);
assert.strictEqual(events.getWorkoutPostStatus().state, "posting", "an old post overwrote the newer one's status");

events.updateWorkoutPostStatus(2, { state: "failed", error: "offline" });
assert.strictEqual(events.getWorkoutPostStatus().state, "failed");

// Clearing by an old id leaves the newer status alone; clearing by its own
// id or with none removes it.
events.clearWorkoutPostStatus(1);
assert.ok(events.getWorkoutPostStatus(), "clearing an old post removed the newer one's bar");
events.clearWorkoutPostStatus(2);
assert.strictEqual(events.getWorkoutPostStatus(), null);

unsubscribe();
events.setWorkoutPostStatus({ id: 3, state: "posting" });
assert.strictEqual(seen[seen.length - 1], null, "an unsubscribed listener was still called");
events.clearWorkoutPostStatus();

/* ------------------------------------------------------------ go home -- */

{
  const home = { key: "HomePage-abc", name: "HomePage" };
  const calls = [];
  const navigation = {
    getState: () => ({ routes: [home, { key: "WorkoutPage-1", name: "WorkoutPage" }] }),
    reset: (state) => calls.push(["reset", state]),
    navigate: (name) => calls.push(["navigate", name]),
  };

  goHome(navigation);

  assert.deepStrictEqual(calls, [["reset", { index: 0, routes: [home] }]]);
  assert.strictEqual(
    calls[0][1].routes[0],
    home,
    "Home was not handed back with its key - it would be built again from nothing"
  );
}

{
  const calls = [];

  goHome({
    getState: () => ({ routes: [{ key: "WorkoutPage-1", name: "WorkoutPage" }] }),
    reset: (state) => calls.push(["reset", state]),
    navigate: (name) => calls.push(["navigate", name]),
  });

  assert.deepStrictEqual(calls, [["navigate", "HomePage"]], "without a Home on the stack it did not navigate to one");
}

console.log("Background post: status store, stale posts, clearing, and going Home with the existing route passed.");
