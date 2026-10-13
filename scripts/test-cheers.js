// Cheers - the quick replies to "X has started a push!": what the buttons and
// the history row offer, what a pressed button sends, what the push function
// sends and to whom, what the switch reads before and after the migration, and
// what the migration promises, read as text.
//
// The app side (src/Utils/cheers.js, src/Services/cheerService.js and the
// switch and the buttons in src/Services/notificationService.js, against a
// fake Supabase) and the push function's decisions
// (supabase/functions/send-cheer-notification/message.ts, through Node's own
// TypeScript stripping) are run for real. The SQL is read the way the other
// migration checks read theirs: nothing here talks to a database, so those
// checks are a floor, not a proof.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
// Line endings differ between files and checkouts; the checks read \n.
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const i18n = loadAppModule("src/Localization/i18n.js");
const en = (key, params) => i18n.translate(key, params, "en");
const da = (key, params) => i18n.translate(key, params, "da");

const ATHLETE = "a0000000-0000-4000-8000-000000000001";
const FRIEND = "b0000000-0000-4000-8000-000000000002";
const WORKOUT_EVENT = "c0000000-0000-4000-8000-000000000003";

/* ------------------------------------------------- the pure rules -- */

const cheers = loadAppModule("src/Utils/cheers.js");
const history = loadAppModule("src/Utils/notificationHistory.js");

assert.deepStrictEqual(
  cheers.CHEER_PRESETS.map((preset) => preset.id),
  ["good_workout", "lets_go", "crush_it"],
  "the three fixed replies"
);
assert.strictEqual(cheers.WORKOUT_STARTED_CATEGORY_ID, "workout_started");

// The words, in both languages.
assert.strictEqual(en("cheers.presets.goodWorkout"), "💪 Good workout!");
assert.strictEqual(en("cheers.presets.letsGo"), "🔥 Let's go!");
assert.strictEqual(en("cheers.presets.crushIt"), "👏 Crush it!");
assert.strictEqual(da("cheers.presets.goodWorkout"), "💪 God træning!");
assert.strictEqual(da("cheers.presets.letsGo"), "🔥 Kom så!");
assert.strictEqual(da("cheers.presets.crushIt"), "👏 Giv den gas!");

// A pressed button.
assert.deepStrictEqual(cheers.cheerFromAction("cheer_good_workout"), { preset: "good_workout", message: null });
assert.deepStrictEqual(cheers.cheerFromAction("cheer_lets_go", "ignored text"), { preset: "lets_go", message: null });
assert.deepStrictEqual(cheers.cheerFromAction("cheer_crush_it"), { preset: "crush_it", message: null });
assert.deepStrictEqual(
  cheers.cheerFromAction("cheer_custom", "  Go\n\n   get it \n 💪 "),
  { preset: "custom", message: "Go get it 💪" },
  "line breaks and runs of spaces become one space"
);
assert.strictEqual(cheers.cheerFromAction("cheer_custom", "   \n "), null, "empty text is not a cheer");
assert.strictEqual(cheers.cheerFromAction("cheer_custom", undefined), null);
assert.strictEqual(cheers.cheerFromAction("cheer_nonsense"), null, "an unknown cheer button");
assert.strictEqual(cheers.cheerFromAction("expo.modules.notifications.actions.DEFAULT"), null, "a plain tap is not a cheer");
assert.strictEqual(cheers.isCheerAction("cheer_custom"), true);
assert.strictEqual(cheers.isCheerAction("cheer_nonsense"), true, "any cheer_ button is ours, valid or not: it must not open the history");
assert.strictEqual(cheers.isCheerAction("expo.modules.notifications.actions.DEFAULT"), false);
assert.strictEqual(cheers.isCheerAction(undefined), false);

// 140 characters, as the database counts them: an emoji is one.
const longText = "💪".repeat(200);
assert.strictEqual(Array.from(cheers.cleanCheerMessage(longText)).length, 140);
assert.strictEqual(Array.from(cheers.cleanCheerMessage("x".repeat(140))).length, 140);
assert.strictEqual(cheers.cleanCheerMessage(42), null);

// The workout a push is about.
assert.strictEqual(cheers.cheerEventIdFromPush({ eventId: WORKOUT_EVENT }), WORKOUT_EVENT);
assert.strictEqual(cheers.cheerEventIdFromPush({ event_id: WORKOUT_EVENT }), WORKOUT_EVENT);
assert.strictEqual(cheers.cheerEventIdFromPush({ type: "workout_started" }), null, "a push from before the event id was in it");
assert.strictEqual(cheers.cheerEventIdFromPush(null), null);

// The row: fresh workout-started rows only, six hours.
const now = Date.parse("2026-10-13T12:00:00Z");
const startedRow = (minutesAgo, extra = {}) => ({
  id: "row-1",
  eventId: WORKOUT_EVENT,
  eventType: "workout_started",
  createdAt: new Date(now - minutesAgo * 60 * 1000).toISOString(),
  ...extra,
});
assert.strictEqual(cheers.isCheerableRow(startedRow(5), { now }), true);
assert.strictEqual(cheers.isCheerableRow(startedRow(359), { now }), true);
assert.strictEqual(cheers.isCheerableRow(startedRow(361), { now }), false, "more than six hours: the server refuses it");
assert.strictEqual(cheers.isCheerableRow(startedRow(5, { eventType: "social_post_liked" }), { now }), false, "only workout-started rows");
assert.strictEqual(cheers.isCheerableRow(startedRow(5, { eventId: null }), { now }), false);
assert.strictEqual(cheers.isCheerableRow(startedRow(-30), { now }), false, "a clock in the future is not fresh");
assert.strictEqual(cheers.isCheerableRow(startedRow(5, { createdAt: "soon" }), { now }), false);

// "You cheered · …" and the received row.
assert.strictEqual(cheers.cheerText("good_workout", null, da), "💪 God træning!");
assert.strictEqual(cheers.cheerText("custom", " Nice one ", en), "💬 Nice one");
assert.strictEqual(cheers.cheerText("custom", "  ", en), null);
assert.strictEqual(cheers.cheerText("unknown", null, en), null);
assert.strictEqual(en("cheers.youCheeredWith", { text: "💪 Good workout!" }), "You cheered · 💪 Good workout!");
assert.strictEqual(da("cheers.youCheeredWith", { text: "💪 God træning!" }), "Du heppede · 💪 God træning!");

function cheerRow({ actor = null, data = {} } = {}) {
  return {
    id: "row-2",
    eventType: "cheer",
    title: "Bo Berg cheered you on",
    body: "💪 Good workout!",
    actor,
    data: { sender_id: FRIEND, sender_name: "Bo Berg", preset: "good_workout", message: null, ...data },
  };
}

assert.deepStrictEqual(history.describeNotification(cheerRow(), en), {
  title: "Bo Berg cheered you on",
  body: "💪 Good workout!",
});
assert.deepStrictEqual(history.describeNotification(cheerRow(), da), {
  title: "Bo Berg hepper på dig",
  body: "💪 God træning!",
}, "the preset is stored as an id, so the words are the reader's own");
assert.strictEqual(
  history.describeNotification(cheerRow({ data: { preset: "custom", message: "See you at 6" } }), da).body,
  "💬 See you at 6",
  "a written message is shown as written"
);
assert.strictEqual(
  history.describeNotification(cheerRow({ actor: { displayName: "Bo B." } }), en).title,
  "Bo B. cheered you on",
  "the profile as it is now wins over the name written down"
);
assert.strictEqual(
  history.describeNotification(cheerRow({ data: { sender_name: " " } }), da).title,
  "Nogen hepper på dig"
);
assert.deepStrictEqual(
  history.describeNotification(startedRow(5, { title: "Push started", body: "Bo has started a push!" }), da),
  { title: "Push started", body: "Bo has started a push!" },
  "the workout-started row is shown as the server wrote it, as before"
);
assert.strictEqual(history.notificationTarget(cheerRow()).route, "SocialPage", "a cheer row opens Social, as the other rows do");
assert.strictEqual(history.pushNotificationTarget({ type: "cheer", actorId: FRIEND }), null, "a tapped cheer push stops at the notification page");

/* ----------------------------------------------------- the migration -- */

const migrationFile = "supabase/migrations/20261012090000_cheers-from-a-notification.sql";
const migration = read(migrationFile);
const sql = migration.replace(/--[^\n]*/g, "");

assert.ok(/^\s*begin;/m.test(sql) && /^\s*commit;\s*$/m.test(sql), "the migration runs in one transaction");
assert.ok(migration.includes("Run after 20261011090000_daily-steps.sql"), "the header says what it runs after");
assert.ok(/Safe to run twice/.test(migration));
assert.ok(
  /add column if not exists cheer_notifications boolean not null default true/.test(sql),
  "the switch is on unless the athlete turns it off"
);
assert.ok(/create table if not exists public\.workout_cheer/.test(sql));
assert.ok(/event_id uuid not null references public\.notification_events\(id\) on delete cascade/.test(sql), "the workout event");
assert.ok(/sender_id uuid not null default auth\.uid\(\) references public\.profiles\(id\)/.test(sql));
assert.ok(/recipient_id uuid not null references public\.profiles\(id\)/.test(sql));
assert.ok(/preset in \('good_workout', 'lets_go', 'crush_it', 'custom'\)/.test(sql), "the four presets");
assert.ok(/char_length\(message\) between 1 and 140/.test(sql), "a custom message is 1-140 characters");
assert.ok(/preset <> 'custom' and message is null/.test(sql), "a preset carries no text");
assert.ok(/unique \(event_id, sender_id\)/.test(sql), "one cheer per person per workout");
assert.ok(/check\s*\(sender_id <> recipient_id\)/.test(sql), "not to yourself");
assert.ok(/enable row level security/.test(sql));

const canCheer = sql.match(/create or replace function private\.can_cheer\([\s\S]*?\n\$\$;/)[0];
assert.ok(/security definer/.test(canCheer) && /set search_path = ''/.test(canCheer));
assert.ok(/event\.event_type = 'workout_started'/.test(canCheer), "only workout-started notifications");
assert.ok(/event\.actor_id = cheered_user_id/.test(canCheer), "the cheer goes to the person who started the workout");
assert.ok(/interval '6 hours'/.test(canCheer), "six hours");
assert.ok(/inbox\.user_id = cheering_user_id/.test(canCheer) && /inbox\.event_id = cheered_event_id/.test(canCheer), "the sender was told about it");
assert.ok(/cheering_user_id <> cheered_user_id/.test(canCheer), "not to yourself");
assert.ok(/not private\.blocked_between\(cheering_user_id, cheered_user_id\)/.test(canCheer), "not across a block");
assert.ok(
  /grant execute on function private\.can_cheer\(uuid, uuid, uuid\) to authenticated;/.test(sql),
  "a policy checks execute as the querying user"
);

const prepare = sql.match(/create or replace function private\.prepare_workout_cheer\(\)[\s\S]*?\n\$\$;/)[0];
assert.ok(/select event\.actor_id\s+into new\.recipient_id/.test(prepare), "the server writes who the cheer is for");
assert.ok(/before insert on public\.workout_cheer/.test(sql));
assert.ok(/regexp_replace\([\s\S]*'\\s\+', ' ', 'g'\)/.test(prepare), "line breaks and runs of spaces become one space");
assert.ok(/new\.message := null/.test(prepare), "a preset has no text");

assert.ok(
  /grant insert \(event_id, preset, message\) on public\.workout_cheer to authenticated;/.test(sql),
  "the app may write the event, the preset and the text - never the recipient"
);
assert.ok(/grant select, delete on public\.workout_cheer to authenticated;/.test(sql), "no update");
assert.ok(!/grant[^;]*update[^;]*workout_cheer/.test(sql), "nobody changes a cheer");
assert.ok(/for insert[\s\S]*?sender_id = \(select auth\.uid\(\)\)[\s\S]*?private\.can_cheer\(event_id, sender_id, recipient_id\)/.test(sql));
assert.ok(/for select[\s\S]*?\(select auth\.uid\(\)\) in \(sender_id, recipient_id\)/.test(sql), "visible to the sender and the recipient only");
assert.ok(/for delete[\s\S]*?using \(sender_id = \(select auth\.uid\(\)\)\)/.test(sql), "the sender may take it back");

const trigger = sql.match(/create or replace function private\.notify_recipient_of_cheer\(\)[\s\S]*?\n\$\$;/)[0];
assert.ok(/security definer/.test(trigger) && /set search_path = ''/.test(trigger));
assert.ok(
  /revoke all on function private\.notify_recipient_of_cheer\(\) from public, anon, authenticated;/.test(sql),
  "nobody calls it but the trigger"
);
assert.ok(/after insert on public\.workout_cheer\s+for each row execute function private\.notify_recipient_of_cheer\(\);/.test(sql));
assert.ok(/cheer_notifications/.test(trigger) && /if not wants_cheers then/.test(trigger), "none when the athlete switched cheers off");
assert.ok(/'cheer:' \|\| new\.event_id \|\| ':' \|\| new\.sender_id/.test(trigger) && /on conflict \(event_key\) do nothing/.test(trigger));
assert.ok(/'cheer',\s+new\.sender_id/.test(trigger) || /event_type[\s\S]*'cheer'/.test(trigger), "the kind the app maps");
assert.ok(/sender_name \|\| ' cheered you on'/.test(trigger), "the English title the push also uses");
for (const field of ["workout_event_id", "sender_id", "sender_name", "recipient_id", "preset", "message"]) {
  assert.ok(trigger.includes(`'${field}'`), `data carries ${field}`);
}
assert.ok(/exception\s+when others then\s+raise warning/.test(trigger), "a cheer never fails because of its notification");

const ledger = read("supabase/migrations/README.md");
assert.ok(ledger.includes("20261012090000_cheers-from-a-notification.sql"), "the ledger lists it");

/* ------------------------------------------------- the workout push -- */

const workoutFunction = read("supabase/functions/send-workout-started-notification/index.ts");
assert.ok(/categoryId: CHEER_CATEGORY_ID/.test(workoutFunction) && /const CHEER_CATEGORY_ID = "workout_started"/.test(workoutFunction));
assert.ok(
  workoutFunction.includes(`const CHEER_CATEGORY_ID = "${cheers.WORKOUT_STARTED_CATEGORY_ID}"`),
  "the push and the app name the category alike"
);
assert.ok(/athleteTakesCheers \? \{ categoryId: CHEER_CATEGORY_ID \} : \{\}/.test(workoutFunction), "no buttons when the athlete has cheers off");
assert.ok(/eventId: event\.id/.test(workoutFunction), "the push says which workout a cheer is for");
assert.ok(/error\) \{[\s\S]{0,120}return false;/.test(workoutFunction.match(/async function readCheersSwitch[\s\S]*?\n}\n/)[0]), "not knowing means no buttons");
assert.ok(
  /\.eq\("actor_id", actorId\)\s*\.eq\("event_type", "workout_started"\)/.test(workoutFunction),
  "the workout-start rate limit counts workout starts only, not cheers"
);

const config = read("supabase/config.toml");
assert.ok(/\[functions\.send-cheer-notification\]\s*verify_jwt = false/.test(config));
const pushFunction = read("supabase/functions/send-cheer-notification/index.ts");
assert.ok(
  /\.eq\("event_key", eventKey\)[\s\S]{0,160}\.is\("expo_response", null\)/.test(pushFunction),
  "the event is claimed once, so a retry sends nothing"
);
assert.ok(/FITVEN_NOTIFICATION_WEBHOOK_SECRET/.test(pushFunction) && /secretsMatch\(/.test(pushFunction));
assert.ok(/cheer_notifications === false/.test(pushFunction), "the switch is read again");
assert.ok(/from\("user_blocks"\)/.test(pushFunction), "a block is checked again");
assert.ok(/pushLimitReached\(pushedCount\)/.test(pushFunction) && /payload->>workout_event_id/.test(pushFunction), "ten pushes per workout");

/* ------------------------------------------------------ the push text -- */

(async () => {
  const message = await import(
    pathToFileURL(path.join(root, "supabase", "functions", "send-cheer-notification", "message.ts")).href
  );

  assert.strictEqual(message.CHEER_EVENT_TYPE, cheers.CHEER_EVENT_TYPE, "the push and the page name the kind alike");
  assert.strictEqual(message.MAX_CHEER_PUSHES_PER_WORKOUT, 10);
  assert.strictEqual(message.MAX_MESSAGE_LENGTH, cheers.MAX_CHEER_MESSAGE_LENGTH);

  const webhook = {
    type: "INSERT",
    schema: "public",
    table: "workout_cheer",
    record: { id: 7, event_id: WORKOUT_EVENT, sender_id: FRIEND, recipient_id: ATHLETE, preset: "lets_go" },
  };
  assert.deepStrictEqual(message.readCheer(webhook), { workoutEventId: WORKOUT_EVENT, senderId: FRIEND });
  assert.strictEqual(message.readCheer({ ...webhook, type: "DELETE" }), null, "taking a cheer back sends nothing");
  assert.strictEqual(message.readCheer({ ...webhook, table: "social_post_like" }), null);
  assert.strictEqual(message.readCheer({ ...webhook, record: { sender_id: FRIEND } }), null);
  assert.strictEqual(message.readCheer(null), null);
  assert.strictEqual(message.cheerEventKey(WORKOUT_EVENT, FRIEND), `cheer:${WORKOUT_EVENT}:${FRIEND}`, "the key the trigger writes");
  assert.ok(trigger.includes("'cheer:'"), "and the trigger writes that prefix");

  assert.strictEqual(message.cheerText("good_workout", null), "💪 Good workout!");
  assert.strictEqual(message.cheerText("lets_go", null), "🔥 Let's go!");
  assert.strictEqual(message.cheerText("crush_it", null), "👏 Crush it!");
  assert.strictEqual(message.cheerText("custom", "  See you\nat 6 "), "💬 See you at 6");
  assert.strictEqual(message.cheerText("custom", ""), null);
  assert.strictEqual(message.cheerText("nope", null), null);
  // The server and the app say the presets alike.
  for (const preset of cheers.CHEER_PRESETS) {
    assert.strictEqual(message.cheerText(preset.id, null), en(preset.labelKey), `${preset.id}: server and app agree`);
  }
  assert.strictEqual(Array.from(message.cheerText("custom", "x".repeat(300))).length, 2 + 140, "a long message is cut");

  const built = message.buildCheerMessage(
    {
      cheer_id: 7,
      workout_event_id: WORKOUT_EVENT,
      sender_id: FRIEND,
      sender_name: "Bo Berg",
      recipient_id: ATHLETE,
      preset: "good_workout",
      message: null,
    },
    "event-9"
  );
  assert.strictEqual(built.title, "Bo Berg cheered you on");
  assert.strictEqual(built.body, "💪 Good workout!");
  assert.strictEqual(built.channelId, "activity", "the activity channel, as workout-started");
  assert.strictEqual(built.priority, "high");
  assert.deepStrictEqual(
    { type: built.data.type, actorId: built.data.actorId, eventId: built.data.eventId, preset: built.data.preset },
    { type: "cheer", actorId: FRIEND, eventId: "event-9", preset: "good_workout" },
    "data: type, actorId, eventId, preset"
  );
  assert.strictEqual(built.data.recipientId, ATHLETE);
  assert.strictEqual(
    message.buildCheerMessage({ sender_id: FRIEND, recipient_id: ATHLETE, preset: "custom", message: "Hej", sender_name: "x".repeat(90) }, "e").title,
    `${"x".repeat(39)}… cheered you on`,
    "a name reaches a lock screen, so it is cut"
  );
  assert.strictEqual(
    message.buildCheerMessage({ sender_id: FRIEND, recipient_id: ATHLETE, preset: "custom", message: "Hej" }, "e").body,
    "💬 Hej"
  );
  assert.strictEqual(message.buildCheerMessage({ sender_id: FRIEND, recipient_id: FRIEND, preset: "lets_go" }, "e"), null, "never to oneself");
  assert.strictEqual(message.buildCheerMessage({ sender_id: FRIEND, recipient_id: ATHLETE, preset: "custom", message: " " }, "e"), null);
  assert.strictEqual(message.buildCheerMessage({ recipient_id: ATHLETE, preset: "lets_go" }, "e"), null);
  assert.strictEqual(message.buildCheerMessage(null, "e"), null);

  const token = (id, userId, value) => ({ id, user_id: userId, expo_push_token: value });
  assert.deepStrictEqual(
    message.pickRecipientTokens(
      [token("1", ATHLETE, "A"), token("2", ATHLETE, "B"), token("3", ATHLETE, "A"), token("4", FRIEND, "C")],
      [token("5", FRIEND, "B")],
      ATHLETE
    ).map((row) => row.id),
    ["1"],
    "each device once, and not one the sender is also signed in on"
  );

  assert.strictEqual(message.pushLimitReached(9), false);
  assert.strictEqual(message.pushLimitReached(10), true, "the eleventh cheer is in the history without a push");
  assert.strictEqual(message.pushLimitReached(null), false);
  assert.deepStrictEqual(
    message.invalidTokenIds(
      [token("1", ATHLETE, "A"), token("2", ATHLETE, "B")],
      [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]
    ),
    ["2"]
  );
  assert.strictEqual(message.secretsMatch("abc", "abc"), true);
  assert.strictEqual(message.secretsMatch("abc", "abd"), false);
  assert.strictEqual(message.secretsMatch("", ""), false);

  /* ---------------------------------- the app, against a fake Supabase -- */

  const cloud = {
    session: { access_token: "t" },
    inserts: [],
    insertError: null,
    sentRows: [],
    hasColumn: true,
    preference: { cheer_notifications: true },
    upserts: [],
  };
  const namesColumn = (value) => /\bcheer_notifications\b/.test(value);
  const fakeSupabase = {
    auth: {
      getSession: async () => ({ data: { session: cloud.session }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from(table) {
      if (table === "workout_cheer") {
        return {
          async insert(row) {
            cloud.inserts.push(row);
            return { error: cloud.insertError };
          },
          select: () => ({
            eq: () => ({
              in: async () => ({ data: cloud.sentRows, error: null }),
            }),
          }),
        };
      }

      if (table !== "notification_preferences") {
        throw new Error(`cheers reached for ${table}`);
      }

      return {
        select: (columns) => ({
          eq: () => ({
            async maybeSingle() {
              if (namesColumn(columns) && !cloud.hasColumn) {
                return { data: null, error: { code: "42703", message: "column notification_preferences.cheer_notifications does not exist" } };
              }

              return { data: { cheer_notifications: cloud.preference.cheer_notifications }, error: null };
            },
          }),
        }),
        async upsert(row) {
          if (!cloud.hasColumn) {
            return { error: { code: "PGRST204", message: "Could not find the 'cheer_notifications' column of 'notification_preferences' in the schema cache" } };
          }

          cloud.upserts.push(row);
          cloud.preference = { ...cloud.preference, ...row };
          return { error: null };
        },
      };
    },
    rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async () => ({ data: null, error: null }) },
  };

  const notificationsStub = {
    categories: [],
    scheduled: [],
    dismissed: [],
    setNotificationHandler() {},
    getPermissionsAsync: async () => ({ status: "granted" }),
    setNotificationChannelAsync: async () => {},
    setNotificationCategoryAsync: async (id, actions) => {
      notificationsStub.categories.push({ id, actions });
    },
    scheduleNotificationAsync: async (request) => {
      notificationsStub.scheduled.push(request);
    },
    dismissNotificationAsync: async (id) => {
      notificationsStub.dismissed.push(id);
    },
    AndroidImportance: { HIGH: 4 },
  };

  loadAppModule.stubModule("@supabase/supabase-js", { createClient: () => fakeSupabase, processLock: () => {} });
  loadAppModule.stubModule("react-native", {
    Platform: { OS: "android" },
    AppState: { addEventListener: () => ({ remove() {} }) },
    I18nManager: {},
    NativeModules: {},
  });
  loadAppModule.stubModule("@react-native-async-storage/async-storage", {
    __esModule: true,
    default: {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
      getAllKeys: async () => [],
      multiRemove: async () => {},
    },
  });
  loadAppModule.stubModule("expo-notifications", notificationsStub);
  loadAppModule.stubModule("expo-constants", { default: {} });
  loadAppModule.stubModule("react-native-url-polyfill/auto", {});
  loadAppModule.stubModule("expo-sqlite/localStorage/install", {});
  loadAppModule.stubModule("expo-secure-store", {});

  console.warn = () => {};
  const cheerService = loadAppModule("src/Services/cheerService.js");
  const notifications = loadAppModule("src/Services/notificationService.js");
  const { CHEER_RESULT } = cheerService;

  // The buttons on the workout-started push: three replies and one to write,
  // opening the app for now (see notificationService.js).
  await new Promise((resolve) => setImmediate(resolve));
  const registered = notificationsStub.categories.at(-1);
  assert.ok(registered, "the category is registered at start-up");
  assert.strictEqual(registered.id, "workout_started");
  assert.deepStrictEqual(
    registered.actions.map((action) => action.identifier),
    ["cheer_good_workout", "cheer_lets_go", "cheer_crush_it", "cheer_custom"]
  );
  assert.ok(
    registered.actions.every((action) => action.options.opensAppToForeground === true),
    "until a killed app has been seen to send a cheer with the app closed, the buttons open it"
  );
  const custom = registered.actions[3];
  assert.ok(custom.textInput && custom.textInput.submitButtonTitle && custom.textInput.placeholder, "the written reply has a text field");
  for (const action of registered.actions) {
    assert.ok(action.buttonTitle, "every button has a title");
  }

  // The titles are fixed at registration, so a language change registers again.
  const before = notificationsStub.categories.length;
  // The same instance the service subscribed to: loading the stubs cleared the cache.
  const liveI18n = loadAppModule("src/Localization/i18n.js");
  liveI18n.setLanguage("da");
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(notificationsStub.categories.length > before, "a language change registers the buttons again");
  assert.strictEqual(notificationsStub.categories.at(-1).actions[0].buttonTitle, "💪 God træning!");
  assert.strictEqual(notificationsStub.categories.at(-1).actions[3].textInput.submitButtonTitle, "Send");
  liveI18n.setLanguage("en");

  // Sending.
  assert.strictEqual(await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "good_workout" }), CHEER_RESULT.SENT);
  assert.deepStrictEqual(cloud.inserts.at(-1), { event_id: WORKOUT_EVENT, preset: "good_workout", message: null });
  assert.strictEqual(
    await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "custom", message: " Go\n get it " }),
    CHEER_RESULT.SENT
  );
  assert.deepStrictEqual(cloud.inserts.at(-1), { event_id: WORKOUT_EVENT, preset: "custom", message: "Go get it" });
  assert.strictEqual(
    await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "lets_go", message: "a message on a preset" }),
    CHEER_RESULT.SENT
  );
  assert.strictEqual(cloud.inserts.at(-1).message, null, "a preset carries no text");
  const insertsBefore = cloud.inserts.length;
  assert.strictEqual(await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "custom", message: "  " }), CHEER_RESULT.FAILED, "empty is not allowed");
  assert.strictEqual(await cheerService.sendCheer({ preset: "lets_go" }), CHEER_RESULT.FAILED, "a push without its workout");
  assert.strictEqual(cloud.inserts.length, insertsBefore, "neither reached the database");

  cloud.session = null;
  assert.strictEqual(await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "lets_go" }), CHEER_RESULT.SIGNED_OUT, "logged out: nothing");
  assert.strictEqual(cloud.inserts.length, insertsBefore);
  cloud.session = { access_token: "t" };

  cloud.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
  assert.strictEqual(
    await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "lets_go" }),
    CHEER_RESULT.ALREADY_SENT,
    "a second cheer on the same workout is a success, not an error"
  );
  cloud.insertError = { code: "42501", message: "new row violates row-level security policy" };
  assert.strictEqual(await cheerService.sendCheer({ eventId: WORKOUT_EVENT, preset: "lets_go" }), CHEER_RESULT.FAILED, "refused: too late, blocked, not told");
  cloud.insertError = null;

  // What was sent already.
  cloud.sentRows = [{ event_id: WORKOUT_EVENT, preset: "custom", message: "Go get it" }];
  assert.deepStrictEqual(await cheerService.getSentCheers({ user: { id: FRIEND }, eventIds: [WORKOUT_EVENT, null] }), {
    [WORKOUT_EVENT]: { preset: "custom", message: "Go get it" },
  });
  assert.deepStrictEqual(await cheerService.getSentCheers({ user: { id: FRIEND }, eventIds: [] }), {});
  assert.deepStrictEqual(await cheerService.getSentCheers({ eventIds: [WORKOUT_EVENT] }), {});

  // A pressed button.
  const response = (action, { userText, id = "n-1", data = { type: "workout_started", eventId: WORKOUT_EVENT } } = {}) => ({
    actionIdentifier: action,
    userText,
    notification: { date: 1, request: { identifier: id, content: { data } } },
  });

  cloud.inserts.length = 0;
  assert.strictEqual(await cheerService.handleCheerResponse(response("cheer_crush_it")), CHEER_RESULT.SENT);
  assert.deepStrictEqual(cloud.inserts, [{ event_id: WORKOUT_EVENT, preset: "crush_it", message: null }]);
  assert.deepStrictEqual(notificationsStub.dismissed, ["n-1"], "Android leaves the buttons up unless the notification is dismissed");
  assert.strictEqual(
    await cheerService.handleCheerResponse(response("cheer_crush_it")),
    CHEER_RESULT.IGNORED,
    "the same tap arriving by two routes sends once"
  );
  assert.strictEqual(cloud.inserts.length, 1);

  assert.strictEqual(
    await cheerService.handleCheerResponse(response("cheer_custom", { userText: "On my way\n", id: "n-2" })),
    CHEER_RESULT.SENT
  );
  assert.deepStrictEqual(cloud.inserts.at(-1), { event_id: WORKOUT_EVENT, preset: "custom", message: "On my way" });
  assert.strictEqual(await cheerService.handleCheerResponse(response("cheer_custom", { userText: " ", id: "n-3" })), CHEER_RESULT.IGNORED, "no text, nothing sent, nothing said");
  assert.strictEqual(
    await cheerService.handleCheerResponse(response("cheer_lets_go", { id: "n-4", data: { type: "workout_started" } })),
    CHEER_RESULT.IGNORED,
    "a push from before it carried its workout"
  );
  assert.strictEqual(
    await cheerService.handleCheerResponse(response("expo.modules.notifications.actions.DEFAULT", { id: "n-5" })),
    CHEER_RESULT.IGNORED,
    "a plain tap is not ours"
  );
  assert.strictEqual(notificationsStub.scheduled.length, 0, "nothing so far has failed");

  // A second cheer: quiet.
  cloud.insertError = { code: "23505", message: "duplicate" };
  assert.strictEqual(await cheerService.handleCheerResponse(response("cheer_lets_go", { id: "n-6" })), CHEER_RESULT.ALREADY_SENT);
  assert.strictEqual(notificationsStub.scheduled.length, 0, "a second cheer shows no error");

  // A failure: said once, never retried.
  cloud.insertError = { code: "XX000", message: "boom" };
  const insertsBeforeFailure = cloud.inserts.length;
  assert.strictEqual(await cheerService.handleCheerResponse(response("cheer_lets_go", { id: "n-7" })), CHEER_RESULT.FAILED);
  assert.strictEqual(cloud.inserts.length, insertsBeforeFailure + 1, "one try");
  assert.strictEqual(notificationsStub.scheduled.length, 1, "one notification");
  assert.strictEqual(notificationsStub.scheduled[0].content.title, "Couldn't send your cheer");
  assert.strictEqual(notificationsStub.scheduled[0].trigger, null, "now");
  assert.strictEqual(notificationsStub.scheduled[0].content.channelId, "activity");
  await cheerService.handleCheerResponse(response("cheer_lets_go", { id: "n-7" }));
  assert.strictEqual(notificationsStub.scheduled.length, 1, "the same tap again is not announced again");
  cloud.insertError = null;

  // The switch: on until the athlete turns it off; not available before the migration.
  const user = { id: ATHLETE };
  assert.deepStrictEqual(await notifications.getCheerNotificationSetting({}), { enabled: true, available: false });
  assert.deepStrictEqual(await notifications.getCheerNotificationSetting({ user }), { enabled: true, available: true });
  assert.deepStrictEqual(await notifications.setCheerNotificationsEnabled({ user, enabled: false }), { enabled: false, available: true });
  assert.strictEqual(cloud.upserts.at(-1).cheer_notifications, false);
  assert.deepStrictEqual(Object.keys(cloud.upserts.at(-1)).sort(), ["cheer_notifications", "updated_at", "user_id"], "only this column");
  cloud.hasColumn = false;
  assert.deepStrictEqual(
    await notifications.getCheerNotificationSetting({ user }),
    { enabled: true, available: false },
    "a missing column greys the switch out instead of taking the settings screen down"
  );
  assert.deepStrictEqual(await notifications.setCheerNotificationsEnabled({ user, enabled: true }), { enabled: true, available: false });
  await assert.rejects(() => notifications.setCheerNotificationsEnabled({ enabled: true }));

  /* ------------------------------------------------- the app's wiring -- */

  const app = read("App.js");
  const cheerBranch = app.indexOf("isCheerAction(response?.actionIdentifier)");
  assert.ok(cheerBranch > 0, "App.js handles the cheer buttons");
  assert.ok(
    cheerBranch < app.indexOf("const responseKey = getNotificationResponseKey(response);") &&
      cheerBranch < app.indexOf("pushNotificationTarget("),
    "before the history is opened or the response is marked handled: a reply never opens the app's history"
  );
  assert.ok(/handleCheerResponse\(response\)/.test(app) && /clearLastNotificationResponse\(\);\s*return;/.test(app.slice(cheerBranch, cheerBranch + 500)));
  assert.ok(/showToast\(t\("cheers\.sent"\)\)/.test(app));

  const page = read("src/Pages/NotificationHistoryPage/NotificationHistoryPage.js");
  assert.ok(/isCheerableRow\(item\)/.test(page) && /<CheerReplies/.test(page), "the history page offers the replies");
  const cardEnd = page.indexOf("</TouchableOpacity>");
  assert.ok(page.indexOf("<CheerReplies") > cardEnd, "the replies sit beside the card's touchable, not inside it");
  const historyService = read("src/Services/notificationService.js");
  assert.ok(/event_id,\s+event_type,/.test(historyService) && /eventId: row\.event_id/.test(historyService), "the history row knows its workout event");

  const settingsPage = read("src/Pages/NotificationSettingsPage/NotificationSettingsPage.js");
  assert.ok(settingsPage.indexOf("cheers.settingTitle") > settingsPage.indexOf("postLikesTitle"), "the cheers switch comes after the likes one");

  const policy = read("src/Resources/Legal/privacyPolicy.js");
  assert.ok(/cheers you send/.test(policy) && /cheer them on/.test(policy) && /stored with your account and shown to the friend/.test(policy), "the policy says cheers and their messages are stored and shown");
  const policyPage = read("web/privacy/index.html");
  assert.ok(/shown to the friend/.test(policyPage), "and so does the public page");

  console.log("cheers ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
