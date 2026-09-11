const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const servicePath = path.join(
  rootDir,
  "src",
  "Services",
  "notificationService.js"
);
const syncPath = path.join(
  rootDir,
  "src",
  "Sync",
  "PushNotificationRegistrationSync.js"
);
const workoutNotificationFunctionPath = path.join(
  rootDir,
  "supabase",
  "functions",
  "send-workout-started-notification",
  "index.ts"
);
const managePushTokenFunctionPath = path.join(
  rootDir,
  "supabase",
  "functions",
  "manage-push-token",
  "index.ts"
);
const appPath = path.join(rootDir, "App.js");
const notificationHistoryPagePath = path.join(
  rootDir,
  "src",
  "Pages",
  "NotificationHistoryPage",
  "NotificationHistoryPage.js"
);
const workoutServicePath = path.join(
  rootDir,
  "src",
  "Services",
  "workoutService.js"
);

const serviceSource = fs.readFileSync(servicePath, "utf8");
const syncSource = fs.readFileSync(syncPath, "utf8");
const workoutNotificationFunctionSource = fs.readFileSync(
  workoutNotificationFunctionPath,
  "utf8"
);
const managePushTokenFunctionSource = fs.readFileSync(
  managePushTokenFunctionPath,
  "utf8"
);
const appSource = fs.readFileSync(appPath, "utf8");
const notificationHistoryPageSource = fs.readFileSync(
  notificationHistoryPagePath,
  "utf8"
);
const workoutServiceSource = fs.readFileSync(workoutServicePath, "utf8");
const homePageSource = fs.readFileSync(
  path.join(rootDir, "src", "Pages", "HomePage", "HomePage.js"),
  "utf8"
);

assert.match(serviceSource, /Notifications\.addPushTokenListener\(listener\)/);
assert.match(serviceSource, /MANAGE_PUSH_TOKEN_FUNCTION = "manage-push-token"/);
assert.match(serviceSource, /supabase\.functions\.invoke\(\s*MANAGE_PUSH_TOKEN_FUNCTION/);
assert.match(
  serviceSource,
  /supabase\.functions\.invoke\(\s*SEND_WORKOUT_STARTED_NOTIFICATION_FUNCTION/
);
assert.match(
  serviceSource,
  /\.\.\.\(devicePushToken \? \{ devicePushToken \} : \{\}\)/
);
assert.doesNotMatch(syncSource, /attemptedUserIdRef/);
assert.match(syncSource, /registrationRequestedRef\.current = true/);
assert.match(syncSource, /while \(registrationRequestedRef\.current\)/);
assert.match(syncSource, /runRegistration\(\{ devicePushToken \}\)/);
assert.match(syncSource, /nextAppState === "active"/);
assert.match(
  workoutNotificationFunctionSource,
  /\.eq\("user_id", actorId\)[\s\S]*const actorPushTokens = new Set/
);
assert.match(
  workoutNotificationFunctionSource,
  /token\.user_id === actorId[\s\S]*actorPushTokens\.has\(token\.expo_push_token\)/
);
assert.match(
  workoutNotificationFunctionSource,
  /addedRecipientTokens\.has\(token\.expo_push_token\)[\s\S]*addedRecipientTokens\.add\(token\.expo_push_token\)/
);
assert.match(
  workoutNotificationFunctionSource,
  /payload\.type === "INSERT" \|\| payload\.type === "UPDATE"/
);
assert.match(
  workoutNotificationFunctionSource,
  /function getWorkoutEventKey[\s\S]*workout\.sync_id/
);

// The client call and the database webhook both reach this function for the
// same workout. If they disagree on the key the start is announced twice, so
// the rule is checked by running the shipped source rather than by reading it.
// Git checks these files out with CRLF on Windows, so every line-based search
// below runs against a copy normalised to LF first.
function toUnixNewlines(source) {
  return source.split("\r\n").join("\n");
}

function extractFunction(rawSource, name) {
  const source = toUnixNewlines(rawSource);
  const header = "\nfunction " + name + "(";
  const startIndex = source.indexOf(header);

  assert.notStrictEqual(
    startIndex,
    -1,
    `Could not find ${name} in the Edge Function source`
  );

  // Every one of these three closes on a brace in the first column, so that is
  // the end of the function.
  const endIndex = source.indexOf("\n}\n", startIndex);

  assert.notStrictEqual(endIndex, -1, `${name} is not closed as expected`);

  return (
    source
      .slice(startIndex, endIndex + 3)
      // The Edge Function is TypeScript; the annotations are the only thing in
      // these three helpers that plain node cannot run.
      .replace(/: WorkoutRecord \| null \| undefined/g, "")
      .replace(/: WorkoutRecord/g, "")
      .replace(/: unknown/g, "")
      .replace(/: string/g, "")
  );
}

function loadWorkoutEventKey(source) {
  const helpers = ["hasValue", "normalizeText", "getWorkoutEventKey"]
    .map((name) => extractFunction(source, name))
    .join("\n");

  return new Function(helpers + "\nreturn getWorkoutEventKey;")();
}

const getWorkoutEventKey = loadWorkoutEventKey(
  workoutNotificationFunctionSource
);
const actorId = "11111111-1111-1111-1111-111111111111";
const syncId = "22222222-2222-2222-2222-222222222222";

// Webhook: the record comes straight off the row, so nothing is marked
// verified.
const webhookKey = getWorkoutEventKey(
  { id: 4210, sync_id: syncId, user_id: actorId },
  actorId
);
// Client, workout already synced: matched to the stored row.
const verifiedClientKey = getWorkoutEventKey(
  {
    id: 4210,
    sync_id: syncId,
    verified_row_id: "4210",
    verified_source: "database",
  },
  actorId
);
// Client, workout not synced yet: nothing to match it to.
const unverifiedClientKey = getWorkoutEventKey(
  { id: 4210, sync_id: syncId, verified_source: "client" },
  actorId
);

assert.strictEqual(webhookKey, verifiedClientKey);
assert.strictEqual(webhookKey, unverifiedClientKey);
assert.match(webhookKey, new RegExp(`^workout_started:${actorId}:`));
// Namespaced by the actor, so registering a key cannot suppress somebody
// else's notification for the same workout.
assert.notStrictEqual(
  getWorkoutEventKey({ sync_id: syncId }, "33333333-3333-3333-3333-333333333333"),
  webhookKey
);
// No sync_id at all: both paths still have to agree, on the row id.
assert.strictEqual(
  getWorkoutEventKey({ id: 4210 }, actorId),
  getWorkoutEventKey(
    { id: 4210, verified_row_id: "4210", verified_source: "database" },
    actorId
  )
);
assert.strictEqual(getWorkoutEventKey({}, actorId), null);

// The stored sync_id wins over the one the caller sent, or a caller could send
// a real row id under a wrong sync_id and get a second key for it.
assert.match(
  workoutNotificationFunctionSource,
  /verified_source: "database"[\s\S]{0,40}\}/
);
assert.match(
  workoutNotificationFunctionSource,
  /sync_id: normalizeText\(stored\.sync_id\)/
);
assert.match(
  workoutNotificationFunctionSource,
  /authenticateRequest[\s\S]*supabase\.auth\.getUser\(token\)/
);
assert.match(
  workoutNotificationFunctionSource,
  /normalizeClientPayload[\s\S]*user_id: userId/
);
assert.match(
  workoutNotificationFunctionSource,
  /actor_expo_push_token_present/
);
assert.match(
  workoutNotificationFunctionSource,
  /\.from\("notification_inbox"\)[\s\S]*\.from\("push_tokens"\)/
);
// A register call must not switch another account's row off on demand: it may
// only release a row that has gone stale, and otherwise register itself
// disabled.
assert.match(
  managePushTokenFunctionSource,
  /STALE_TOKEN_DAYS/
);
assert.match(
  managePushTokenFunctionSource,
  /const enabled = activeOwnerCount === 0;/
);
assert.doesNotMatch(
  managePushTokenFunctionSource,
  /disableOtherOwners/
);
assert.match(
  managePushTokenFunctionSource,
  /onConflict: "user_id,expo_push_token"/
);
assert.match(
  managePushTokenFunctionSource,
  /action === "disable"[\s\S]*\.eq\("user_id", userId\)/
);
// Opening the list from a notification has to clear the unread badge, the same
// as opening it from the bell.
assert.match(
  appSource,
  /NOTIFICATION_HISTORY_ROUTE, \{\s*markNotificationsRead: true/
);
assert.match(appSource, /<WorkoutTypeInstanceSync \/>/);
assert.match(
  appSource,
  /<Stack\.Screen name="NotificationHistoryPage" component=\{NotificationHistoryPage\}/
);
assert.match(
  notificationHistoryPageSource,
  /notificationService\.getNotificationHistory/
);
assert.match(
  notificationHistoryPageSource,
  /notificationService[\s\S]*\.markAllNotificationHistoryRead/
);
assert.match(
  workoutServiceSource,
  /export async function persistWorkoutTimerState[\s\S]*workoutRepository\.persistWorkoutTimerState[\s\S]*syncWorkoutTypeInstancesInBackground\(db\)/
);
assert.match(
  workoutServiceSource,
  /export async function setWorkoutOriginalStartTime[\s\S]*workoutRepository\.setWorkoutOriginalStartTime[\s\S]*syncWorkoutTypeInstancesInBackground\(db\)/
);
assert.match(
  workoutServiceSource,
  /export function notifyWorkoutStartedInBackground[\s\S]*notificationService\.notifyWorkoutStarted/
);

// A notification received while the app was backgrounded never reaches the
// in-app listener, and screen focus does not change when the app returns.
assert.match(
  homePageSource,
  /AppState\.addEventListener\("change"[\s\S]*refreshUnreadNotificationCount\(\)/
);
assert.match(
  serviceSource,
  /blockedByActiveOwner: data\?\.blockedByActiveOwner === true/
);
assert.match(serviceSource, /reason: "blocked_by_active_owner"/);

console.log("Notification registration and recipient checks passed.");
