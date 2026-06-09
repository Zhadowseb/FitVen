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
const appPath = path.join(rootDir, "App.js");
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
const appSource = fs.readFileSync(appPath, "utf8");
const workoutServiceSource = fs.readFileSync(workoutServicePath, "utf8");

assert.match(serviceSource, /Notifications\.addPushTokenListener\(listener\)/);
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
assert.match(appSource, /<WorkoutTypeInstanceSync \/>/);
assert.match(
  workoutServiceSource,
  /export async function persistWorkoutTimerState[\s\S]*workoutRepository\.persistWorkoutTimerState[\s\S]*syncWorkoutTypeInstancesInBackground\(db\)/
);
assert.match(
  workoutServiceSource,
  /export async function setWorkoutOriginalStartTime[\s\S]*workoutRepository\.setWorkoutOriginalStartTime[\s\S]*syncWorkoutTypeInstancesInBackground\(db\)/
);

console.log("Notification registration and recipient checks passed.");
