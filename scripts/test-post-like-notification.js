// A like tells the post's author: what the notification page and the push
// say, where tapping either goes, what the push function sends and to whom,
// and what the migration promises, read as text.
//
// The app mapping (src/Utils/notificationHistory.js) and the push function's
// decisions (supabase/functions/send-post-liked-notification/message.ts,
// through Node's own TypeScript stripping) are run for real. The SQL is read
// the way the other migration checks read theirs: nothing here talks to a
// database, so those checks are a floor, not a proof - the migration itself
// was run twice against Postgres 17 with every scenario (a like, a self-like,
// a block either way, unlike and like again, a deleted notification, likes
// switched off, a hidden post, a stranger, a failing inbox) when it was
// written.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
// Line endings differ between files and checkouts; the checks read \n.
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const i18n = loadAppModule("src/Localization/i18n.js");
const history = loadAppModule("src/Utils/notificationHistory.js");
const en = (key, params) => i18n.translate(key, params, "en");
const da = (key, params) => i18n.translate(key, params, "da");

const AUTHOR = "a0000000-0000-4000-8000-000000000001";
const LIKER = "b0000000-0000-4000-8000-000000000002";

// The row as mapNotificationHistoryRow in Services/notificationService.js
// hands it to the page, with data as the trigger writes it.
function likeRow({ actor = null, data = {} } = {}) {
  return {
    id: "row-1",
    eventType: "social_post_liked",
    title: "Bo Berg liked your post",
    body: "Push",
    readAt: null,
    actor,
    data: {
      post_id: 42,
      author_id: AUTHOR,
      liker_id: LIKER,
      liker_name: "Bo Berg",
      post_title: "Push",
      workout_type: "Resistance",
      ...data,
    },
  };
}

/* ---------------------------------------------------------- the text -- */

assert.strictEqual(history.SOCIAL_POST_LIKED, "social_post_liked");

assert.deepStrictEqual(history.describeNotification(likeRow(), da), {
  title: "Bo Berg synes godt om dit opslag",
  body: "Push",
});
assert.deepStrictEqual(history.describeNotification(likeRow(), en), {
  title: "Bo Berg liked your post",
  body: "Push",
});
assert.strictEqual(
  history.describeNotification(likeRow({ actor: { displayName: "Bo B." } }), da).title,
  "Bo B. synes godt om dit opslag",
  "the profile's name as it is now wins over the one written down"
);
assert.strictEqual(
  history.describeNotification(likeRow({ actor: null }), da).title,
  "Bo Berg synes godt om dit opslag",
  "a stranger's profile does not answer, so the name in data stands in"
);
assert.strictEqual(
  history.describeNotification(likeRow({ data: { liker_name: "  " } }), da).title,
  "Nogen synes godt om dit opslag",
  "no name at all"
);
assert.strictEqual(
  history.describeNotification(likeRow({ data: { post_title: "Run", workout_type: "Run" } }), da).body,
  "Løb",
  "a workout named after its type is drawn in the reader's language"
);
assert.strictEqual(
  history.describeNotification(likeRow({ data: { post_title: "Morgenløb", workout_type: "Run" } }), en).body,
  "Morgenløb",
  "a name somebody typed is drawn as typed"
);
assert.strictEqual(
  history.describeNotification(likeRow({ data: { post_title: null } }), da).body,
  "Dit træningsopslag"
);

// The kinds that were there before are unchanged.
assert.deepStrictEqual(
  history.describeNotification(
    { eventType: "custom_exercise_hidden", title: "x", body: "y", data: { exercise_name: "Zercher" } },
    en
  ),
  {
    title: "Your exercise was hidden",
    body: "Zercher was reported by several people and no longer shows in the library. Copies people already added stay.",
  }
);
assert.deepStrictEqual(
  history.describeNotification({ eventType: "workout_started", title: "Run started", body: "Bo has started a run workout!", data: {} }, da),
  { title: "Run started", body: "Bo has started a run workout!" },
  "a kind without words of its own is shown as the server wrote it"
);

/* --------------------------------------------------------- the route -- */

assert.deepStrictEqual(history.notificationTarget(likeRow()), {
  route: "UserPostsPage",
  params: { userId: AUTHOR, postId: 42 },
});
assert.strictEqual(history.notificationHintKey(likeRow()), "notifications.hints.openPost");
assert.deepStrictEqual(
  history.notificationTarget(likeRow({ data: { post_id: "not a post" } })),
  { route: "SocialPage", params: undefined },
  "a like without a post goes where the rest go"
);
// Lift verification is gone (20261007090000 deleted its notifications): an
// old row, if one were left, goes where the rest go.
assert.deepStrictEqual(history.notificationTarget({ eventType: "lift_verification_requested", data: { gym_id: 7, lift_id: 9 } }), {
  route: "SocialPage",
  params: undefined,
});
assert.deepStrictEqual(history.notificationTarget({ eventType: "custom_exercise_hidden", data: { exercise_name: "Zercher" } }), {
  route: "MyExercisePage",
  params: { exerciseName: "Zercher" },
});
assert.deepStrictEqual(history.notificationTarget({ eventType: "workout_started", data: {} }), {
  route: "SocialPage",
  params: undefined,
});
assert.strictEqual(history.notificationHintKey({ eventType: "workout_started" }), "notifications.hints.openActivity");

// A push carries data's fields with the kind as `type`.
assert.deepStrictEqual(
  history.pushNotificationTarget({ type: "social_post_liked", post_id: "42", author_id: AUTHOR }),
  { route: "UserPostsPage", params: { userId: AUTHOR, postId: 42 } }
);
assert.strictEqual(history.pushNotificationTarget({ type: "workout_started", workoutId: "1" }), null);
assert.strictEqual(history.pushNotificationTarget(undefined), null);
assert.strictEqual(history.pushNotificationTarget({ type: "social_post_liked" }), null);

for (const key of [
  "notifications.hints.openPost",
  "notifications.postLiked.title",
  "notifications.postLiked.bodyFallback",
  "notifications.postLiked.someone",
  "notifications.settings.postLikesTitle",
  "notifications.settings.postLikesBody",
  "notifications.settings.postLikesUnavailable",
  "notifications.settings.postLikesSaveFailed",
]) {
  assert.notStrictEqual(en(key), key, `en has ${key}`);
  assert.notStrictEqual(da(key), key, `da has ${key}`);
}

/* ---------------------------------------------------------- the wiring -- */

const page = read("src/Pages/NotificationHistoryPage/NotificationHistoryPage.js");
assert.ok(/from "@utils\/notificationHistory"/.test(page), "the page reads its text and routes from the util");
assert.ok(/notificationTarget\(item\)/.test(page) && /describeNotification\(item, t\)/.test(page));
assert.ok(!/const LIFT_VERIFICATION_REQUESTED/.test(page), "the page keeps no copy of the kinds");

const app = read("App.js");
assert.ok(
  /pushNotificationTarget\(\s*response\?\.notification\?\.request\?\.content\?\.data\s*\)/.test(app),
  "a tapped push asks the util where it goes"
);
assert.ok(
  /NOTIFICATION_HISTORY_ROUTE, \{\s*markNotificationsRead: true[\s\S]{0,200}if \(target\) \{\s*navigationRef\.navigate\(target\.route, target\.params\)/.test(app),
  "the post opens on top of the notification page, which still marks everything read"
);

const service = read("src/Services/notificationService.js");
const preferenceSelect = service.match(/async function fetchNotificationPreference[\s\S]*?\n}\n/)[0];
assert.ok(
  !preferenceSelect.includes("post_like"),
  "the main preference read must not name the new column: before the migration PostgREST refuses it and the settings screen goes with it"
);
assert.ok(/export async function getPostLikeNotificationSetting/.test(service));
assert.ok(/export async function setPostLikeNotificationsEnabled/.test(service));
assert.ok(/MISSING_COLUMN_CODES = new Set\(\["42703", "PGRST204"\]\)/.test(service));
assert.ok(/return \{ enabled: true, available: false \};/.test(service), "a missing column reads as on and not available");

const settings = read("src/Pages/NotificationSettingsPage/NotificationSettingsPage.js");
assert.ok(/getPostLikeNotificationSetting/.test(settings) && /setPostLikeNotificationsEnabled/.test(settings));
assert.ok(/disabled=\{!postLikes\?\.available \|\| savingPostLikes\}/.test(settings));

/* --------------------------------------------------------- the migration -- */

const migrationFile = "supabase/migrations/20261009090000_a-like-notifies-the-poster.sql";
const migration = read(migrationFile);
const sql = migration.replace(/--[^\n]*/g, "");

assert.ok(/^\s*begin;/m.test(sql) && /^\s*commit;\s*$/m.test(sql), "the migration runs in one transaction");
assert.ok(migration.startsWith("-- A like tells the post's author"), "the header says what it does");
assert.ok(migration.includes("Run after 20261004090000_progress-counts-every-exercise.sql"), "the header says what it runs after");
assert.ok(/Until this has run/.test(migration) && /Safe to\s+(--\s+)?run\s+(--\s+)?twice/.test(migration), "the header says what happens before it runs");
assert.ok(
  /add column if not exists post_like_notifications boolean not null default true/.test(sql),
  "the switch is on unless the author turns it off, and adding it twice is harmless"
);
assert.ok(/create or replace function private\.notify_post_owner_of_like\(\)/.test(sql));
const fn = sql.match(/create or replace function private\.notify_post_owner_of_like\(\)[\s\S]*?\n\$\$;/)[0];
assert.ok(/security definer/.test(fn) && /set search_path = ''/.test(fn), "security definer with an empty search_path");
assert.ok(
  /revoke all on function private\.notify_post_owner_of_like\(\) from public, anon, authenticated;/.test(sql),
  "nobody calls it but the trigger"
);
assert.ok(/drop trigger if exists social_post_like_notify_owner on public\.social_post_like;/.test(sql));
assert.ok(/after insert on public\.social_post_like\s+for each row execute function private\.notify_post_owner_of_like\(\);/.test(sql));
assert.ok(/liked_post\.author_id = new\.user_id/.test(fn), "no notification for liking your own post");
assert.ok(/private\.blocked_between\(new\.user_id, liked_post\.author_id\)/.test(fn), "none across a block");
assert.ok(/liked_post\.deleted_at is not null/.test(fn) && /liked_post\.hidden_at is not null/.test(fn), "none for a deleted or hidden post");
assert.ok(/post_like_notifications/.test(fn) && /if not wants_likes then/.test(fn), "none when the author switched likes off");
assert.ok(
  /'post-liked:' \|\| liked_post\.id \|\| ':' \|\| new\.user_id/.test(fn) && /on conflict \(event_key\) do nothing/.test(fn),
  "one per person per post: unlike and like again finds the key taken"
);
assert.ok(/if new_event_id is null then\s+return null;/.test(fn), "a taken key writes no inbox row");
assert.ok(/on conflict \(user_id, event_id\) do nothing/.test(fn));
assert.ok(/'social_post_liked'/.test(fn), "the kind the app maps");
assert.ok(/liker_name \|\| ' liked your post'/.test(fn), "the English title the push also uses");
for (const field of ["post_id", "author_id", "liker_id", "liker_name", "post_title", "workout_type"]) {
  assert.ok(fn.includes(`'${field}'`), `data carries ${field}`);
}
assert.ok(/exception\s+when others then\s+raise warning/.test(fn), "a like never fails because of its notification");
assert.ok(!/private\.blocked_between[\s\S]*create policy/.test(sql) && !/create policy/.test(sql), "no policy: the block goes through a definer function");

const ledger = read("supabase/migrations/README.md");
assert.ok(
  ledger.includes("| `20261009090000_a-like-notifies-the-poster.sql` | no |"),
  "the ledger lists it as not run"
);

/* ---------------------------------------------------------- the push -- */

const workoutFunction = read("supabase/functions/send-workout-started-notification/index.ts");
assert.ok(
  /\.eq\("actor_id", actorId\)\s*\.eq\("event_type", "workout_started"\)/.test(workoutFunction),
  "the workout-start rate limit counts workout starts only, not likes"
);
const config = read("supabase/config.toml");
assert.ok(/\[functions\.send-post-liked-notification\]\s*verify_jwt = false/.test(config));
const pushFunction = read("supabase/functions/send-post-liked-notification/index.ts");
assert.ok(
  /\.eq\("event_key", eventKey\)[\s\S]{0,120}\.is\("expo_response", null\)/.test(pushFunction),
  "the event is claimed once, so a retry or a re-like sends nothing"
);
assert.ok(/FITVEN_NOTIFICATION_WEBHOOK_SECRET/.test(pushFunction) && /secretsMatch\(/.test(pushFunction));
assert.ok(
  /\.is\("expo_response", null\)\s*\.gte\("created_at", new Date\(Date\.now\(\) - MAX_EVENT_AGE_MS\)/.test(pushFunction),
  "a like from before the webhook existed is not pushed days late when liked again"
);
const tileRead = service.match(/export async function getPushNotificationsEnabled[\s\S]*?\n}\n/)[0];
assert.ok(
  /getPostLikeNotificationSetting\(\{ user \}\)\.catch/.test(tileRead) && /postLikes\.available &&\s*postLikes\.enabled/.test(tileRead),
  "the Profile tile reads on while likes still reach the device"
);

(async () => {
  const message = await import(
    pathToFileURL(path.join(root, "supabase", "functions", "send-post-liked-notification", "message.ts")).href
  );

  assert.strictEqual(message.POST_LIKED_EVENT_TYPE, history.SOCIAL_POST_LIKED, "the push and the page name the kind alike");

  const webhook = {
    type: "INSERT",
    schema: "public",
    table: "social_post_like",
    record: { post_id: 42, user_id: LIKER, created_at: "2026-10-01T10:00:00Z" },
  };
  assert.deepStrictEqual(message.readLike(webhook), { postId: "42", likerId: LIKER });
  assert.strictEqual(message.readLike({ ...webhook, type: "DELETE" }), null, "an unlike sends nothing");
  assert.strictEqual(message.readLike({ ...webhook, table: "social_post" }), null);
  assert.strictEqual(message.readLike({ ...webhook, record: { post_id: "1; drop", user_id: LIKER } }), null);
  assert.strictEqual(message.readLike(null), null);
  assert.strictEqual(message.postLikedEventKey("42", LIKER), `post-liked:42:${LIKER}`, "the key the trigger writes");
  assert.ok(fn.includes("'post-liked:'"), "and the trigger writes that prefix");

  const built = message.buildPostLikedMessage({
    post_id: 42,
    author_id: AUTHOR,
    liker_id: LIKER,
    liker_name: "Bo Berg",
    post_title: "Push",
    workout_type: "Resistance",
  });
  assert.strictEqual(built.title, "Bo Berg liked your post");
  assert.strictEqual(built.body, "Push");
  assert.strictEqual(built.channelId, "activity");
  assert.strictEqual(built.data.type, "social_post_liked");
  assert.deepStrictEqual(
    history.pushNotificationTarget(built.data),
    { route: "UserPostsPage", params: { userId: AUTHOR, postId: 42 } },
    "a tapped push opens the post the app would open from the row"
  );
  assert.strictEqual(message.buildPostLikedMessage({ post_id: 1, author_id: AUTHOR, liker_id: AUTHOR }), null, "never your own like");
  assert.strictEqual(message.buildPostLikedMessage({ author_id: AUTHOR, liker_id: LIKER }), null);
  assert.strictEqual(
    message.buildPostLikedMessage({ post_id: 1, author_id: AUTHOR, liker_id: LIKER, liker_name: "x".repeat(100) }).title.length,
    message.MAX_NAME_LENGTH + " liked your post".length,
    "a long name is capped on the lock screen"
  );

  const token = (id, user, device) => ({ id, user_id: user, expo_push_token: device });
  assert.deepStrictEqual(
    message
      .pickRecipientTokens(
        [token("1", AUTHOR, "phone"), token("2", AUTHOR, "tablet"), token("3", AUTHOR, "phone"), token("4", AUTHOR, "shared")],
        [token("9", LIKER, "shared")],
        AUTHOR
      )
      .map((row) => row.id),
    ["1", "2"],
    "each device once, and not a device the liker is signed in on too"
  );
  assert.deepStrictEqual(
    message.invalidTokenIds(
      [token("1", AUTHOR, "a"), token("2", AUTHOR, "b")],
      [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]
    ),
    ["2"]
  );
  assert.strictEqual(message.secretsMatch("secret", "secret"), true);
  assert.strictEqual(message.secretsMatch("secret", "secreT"), false);
  assert.strictEqual(message.secretsMatch("", ""), false, "no secret set refuses everybody");

  console.log("Post like notification: text, routes, push, wiring and the migration's promises passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
