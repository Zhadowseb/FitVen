// Somebody else's profile: what the page makes of the server's answer, and
// what the server is allowed to answer at all.
//
// Two halves. The pure one - the mapping, the "same centre" rule, the records'
// gold-only-when-verified rule, the activity bars - is run for real through
// Utils/publicProfileUtils.js. The other is the migration, read as text the
// way the other migration checks read theirs: public_profile has to be
// security definer with an empty search_path, answer null to nobody and to a
// block, and never hand out a field that is not on the list. Nothing here
// talks to a database, so the SQL checks are a floor, not a proof.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
// Line endings differ between files and checkouts; the checks read \n.
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const utils = loadAppModule("src/Utils/publicProfileUtils.js");

/* ------------------------------------------------------------ mapping -- */

assert.strictEqual(utils.mapPublicProfile(null), null, "no answer is no profile");
assert.strictEqual(utils.mapPublicProfile({}), null, "an answer without an id is no profile");

const answer = {
  id: "7f2c0c4e-0000-4000-8000-000000000001",
  display_name: "  Anna Holm  ",
  username_base: "anna",
  username_code: "4821",
  avatar_path: "7f2c0c4e-0000-4000-8000-000000000001/avatar",
  bio: "Squats on Mondays.",
  home_gym: { id: 12, short_name: "Kildeskovshallen" },
  follower_count: 31,
  following_count: "8",
  workout_count: 212,
  weekly_workouts: [1, 2, 3],
  is_following: true,
  records: [
    // Heavier, no video: shown, never ranked, whatever rank came with it.
    { exercise_id: 2, exercise_name: "Squat", lift_id: 11, weight_kg: "140.00", reps: 3, video_status: "none", approvals: 0, rank: 2, gym: { id: 12, short_name: "Kildeskovshallen", city: "Gentofte" } },
    { exercise_id: 1, exercise_name: "Bench Press", lift_id: 10, weight_kg: 100, reps: 1, video_status: "verified", approvals: 3, rank: 1, gym: { id: 12, short_name: "Kildeskovshallen", city: "Gentofte" } },
    { exercise_id: 3, exercise_name: "Deadlift", lift_id: 12, weight_kg: 180, reps: 1, video_status: "pending", approvals: 1, rank: 4, gym: null },
    // Never a record, and nothing to show.
    { exercise_id: 3, exercise_name: "Deadlift", lift_id: 13, weight_kg: 200, video_status: "rejected", rank: null },
    { exercise_id: 1, exercise_name: "Bench Press", lift_id: 14, weight_kg: 0, video_status: "verified", rank: 1 },
  ],
};
const profile = utils.mapPublicProfile(answer);

assert.strictEqual(profile.id, answer.id);
assert.strictEqual(profile.displayName, "Anna Holm", "the name is trimmed");
assert.strictEqual(profile.usernameBase, "anna");
assert.strictEqual(profile.usernameCode, "4821");
assert.strictEqual(profile.username, "anna#4821", "the full username is what finds them in search");
assert.strictEqual(profile.avatarUrl, null, "the service signs the avatar; the mapping only carries the path");
assert.deepStrictEqual(profile.homeGym, { id: 12, shortName: "Kildeskovshallen" });
assert.strictEqual(profile.followerCount, 31);
assert.strictEqual(profile.followingCount, 8, "counts arrive as numbers or as strings");
assert.strictEqual(profile.workoutCount, 212);
assert.strictEqual(profile.isFollowing, true);
assert.strictEqual(profile.weeklyWorkouts.length, utils.ACTIVITY_WEEKS);
assert.deepStrictEqual(
  profile.weeklyWorkouts.slice(-3),
  [1, 2, 3],
  "a short list keeps its newest weeks at the end, where this week is drawn"
);
assert.deepStrictEqual(profile.weeklyWorkouts.slice(0, 9), [0, 0, 0, 0, 0, 0, 0, 0, 0]);

const sparse = utils.mapPublicProfile({ id: "x", username_base: "bo" });
assert.strictEqual(sparse.displayName, "bo", "no display name falls back to the username");
assert.strictEqual(sparse.username, "bo", "no code, no #");
assert.strictEqual(sparse.homeGym, null, "no centre, no centre line");
assert.strictEqual(sparse.isFollowing, false, "anything but true is not following");
assert.deepStrictEqual(sparse.records, []);
assert.strictEqual(sparse.bio, "", "no bio is an empty string, which the page leaves out");

assert.strictEqual(
  utils.mapPublicProfile({ id: "x", username_base: "bo", username_code: "7" }).usernameCode,
  "0007",
  "the code is four digits, the way the rest of the app writes it"
);
assert.strictEqual(
  utils.mapPublicProfile({ id: "x", bio: "a".repeat(400) }).bio.length,
  utils.PUBLIC_BIO_MAX_LENGTH,
  "a bio longer than the limit is cut at the limit"
);

const socialService = read("src/Services/socialService.js");
const bioLimit = socialService.match(/export const PROFILE_BIO_MAX_LENGTH = (\d+);/);
assert.ok(bioLimit, "socialService no longer exports PROFILE_BIO_MAX_LENGTH");
assert.strictEqual(
  utils.PUBLIC_BIO_MAX_LENGTH,
  Number(bioLimit[1]),
  "the profile shows a bio up to the same limit the editor allows"
);

/* ----------------------------------------------------------- records -- */

const [squat, bench, deadlift] = profile.records;

assert.strictEqual(profile.records.length, 3, "a rejected lift and an empty one are not records");
assert.strictEqual(squat.weightKg, 140);
assert.strictEqual(squat.isVerified, false);
assert.strictEqual(squat.rank, null, "no video, no place - gold and a rank need a verified lift");
assert.strictEqual(bench.isVerified, true);
assert.strictEqual(bench.rank, 1, "a verified lift keeps its place at the centre");
assert.deepStrictEqual(bench.gym, { id: 12, shortName: "Kildeskovshallen", city: "Gentofte" });
assert.strictEqual(deadlift.videoStatus, "pending");
assert.strictEqual(deadlift.rank, null, "a pending video is not a verified one");
assert.strictEqual(deadlift.gym, null);
assert.strictEqual(utils.mapPublicRecord({ weight_kg: 50, video_status: "rejected" }), null);
assert.strictEqual(utils.mapPublicRecord({ weight_kg: 50 }).videoStatus, "none", "no status is no video");

/* -------------------------------------------------------- same centre -- */

assert.strictEqual(utils.isSharedCentre({ profileGymId: 12, viewerGymId: 12 }), true, "same centre is orange");
assert.strictEqual(utils.isSharedCentre({ profileGymId: "12", viewerGymId: 12 }), true, "ids compare as numbers");
assert.strictEqual(utils.isSharedCentre({ profileGymId: 12, viewerGymId: 13 }), false, "another centre is neutral");
assert.strictEqual(utils.isSharedCentre({ profileGymId: null, viewerGymId: null }), false, "two unknowns are not a match");
assert.strictEqual(utils.isSharedCentre({ profileGymId: 12, viewerGymId: null }), false, "without the viewer's centre it is somebody else's");
assert.strictEqual(
  utils.isSharedCentre({ profileGymId: 12, viewerGymId: 12, preview: true }),
  false,
  "a preview is always neutral: it depends on who is looking"
);

/* ----------------------------------------------------------- activity -- */

const weeks = [0, 0, 1, 2, 3, 4, 0, 2, 2, 3, 4, 3];

assert.strictEqual(utils.averageWorkoutsPerWeek(weeks), 2, "24 workouts over 12 weeks is 2 a week");
assert.strictEqual(utils.averageWorkoutsPerWeek([1]), 0.1, "the average is over all twelve weeks");
assert.strictEqual(utils.averageWorkoutsPerWeek(null), 0);

const bars = utils.buildActivityBars(weeks);

assert.strictEqual(bars.length, 12);
assert.strictEqual(bars.filter((bar) => bar.isLatest).length, 1, "one week is highlighted");
assert.strictEqual(bars[11].isLatest, true, "and it is the last one, this week");
assert.strictEqual(bars[5].level, 1, "the busiest week fills its bar");
assert.strictEqual(bars[0].level, 0, "an empty week has an empty bar");
assert.strictEqual(bars[3].level, 0.5);
assert.ok(
  utils.buildActivityBars([0, 0]).every((bar) => bar.level === 0),
  "twelve empty weeks do not divide by zero"
);

/* --------------------------------------------------------------- posts -- */

const strangerPosts = [
  { id: 1, author: { id: answer.id, displayName: "FitVen athlete", avatarUrl: null } },
  { id: 2, author: { id: answer.id, displayName: "FitVen athlete", avatarUrl: null } },
  { id: 3, author: null },
];
const signed = { ...profile, avatarUrl: "https://signed.example/avatar" };
const authored = utils.withProfileAuthor(strangerPosts, signed);

assert.ok(
  authored.every((post) => post.author.displayName === "Anna Holm" && post.author.avatarUrl === signed.avatarUrl),
  "a stranger's card carries the profile's name and picture, not the placeholder"
);
assert.ok(authored.every((post) => post.author.id === answer.id), "and the author a report is about");
assert.deepStrictEqual(utils.withProfileAuthor(null, profile), []);
assert.deepStrictEqual(
  utils.putPostFirst(authored, "2").map((post) => post.id),
  [2, 1, 3],
  "the tapped post goes first, the rest keep their order"
);
assert.deepStrictEqual(utils.putPostFirst(authored, 99).map((post) => post.id), [1, 2, 3]);
assert.deepStrictEqual(utils.putPostFirst(authored, null).map((post) => post.id), [1, 2, 3]);

/* --------------------------------------------------------- the SQL side -- */

const migrationFile = "supabase/migrations/20260927100000_public-profiles.sql";
const migration = read(migrationFile);
// Comments say what the function does not do, in words the checks below look
// for; only the statements count.
const sql = migration.replace(/--[^\n]*/g, "");

assert.ok(/^\s*begin;/m.test(sql) && /^\s*commit;\s*$/m.test(sql), "the migration runs in one transaction");
assert.ok(/Until this has run/.test(migration), "the header says what happens before it is run");
assert.ok(/Run after /.test(migration), "the header says what it runs after");
assert.ok(!/drop function|create function\b/i.test(sql), "create or replace keeps it safe to run twice");

const functions = [...sql.matchAll(/create or replace function ([a-z_.]+)\(([\s\S]*?)\$\$/g)];

assert.ok(functions.length >= 1, "the migration no longer creates a function");

for (const [, name, header] of functions) {
  assert.ok(/\bsecurity definer\b/.test(header), `${name} must be security definer - it reads what the viewer's policies hide`);
  assert.ok(/set search_path = ''/.test(header), `${name} must run with an empty search_path`);
  assert.ok(/\bstable\b/.test(header), `${name} only reads, and says so`);
  assert.ok(
    sql.includes(`revoke all on function ${name}(`) && new RegExp(`revoke all on function ${name.replace(".", "\\.")}\\([^)]*\\) from public, anon;`).test(sql),
    `${name} has to be taken away from public and anon`
  );
  assert.ok(
    new RegExp(`grant execute on function ${name.replace(".", "\\.")}\\([^)]*\\) to authenticated;`).test(sql),
    `${name} has to be granted to authenticated`
  );
}

assert.ok(
  /viewer_id uuid := auth\.uid\(\);/.test(sql) && /if viewer_id is null[^;]*then\s+return null;/.test(sql),
  "a caller who is not signed in gets null"
);
assert.ok(
  /if private\.blocked_between\(viewer_id, target_user_id\) then\s+return null;/.test(sql),
  "a block either way has to answer null, before anything is read"
);
assert.ok(
  sql.indexOf("private.blocked_between(") < sql.indexOf("from public.profiles"),
  "the block is checked before the profile is read"
);

// Nothing private. The table is not named at all, so no column of it can be
// selected; the centre comes through the helper the rest of the app uses.
for (const forbidden of [
  "profile_private",
  "birth_date",
  "sex",
  "heart_rate",
  "email",
  "is_admin",
  "privacy_policy",
  "terms_",
  "auth.users",
]) {
  assert.ok(!new RegExp(`\\b${forbidden}`, "i").test(sql), `public_profile must not touch ${forbidden}`);
}
assert.ok(sql.includes("private.home_gym_id_for(target_user_id)"), "the centre comes through home_gym_id_for");
assert.ok(!/profile\.\*|select \*/.test(sql), "columns by name only - a column added later must not leak by accident");

const tablesRead = new Set(
  [...sql.matchAll(/\b(?:from|join)\s+public\.("?[A-Za-z_]+"?)/g)].map((match) => match[1])
);
assert.deepStrictEqual(
  [...tablesRead].sort(),
  ["gym", "gym_lift", "profiles", "user_follows", "workout_type_instance"],
  "public_profile reads a table it was not meant to"
);

const profileColumns = new Set([...sql.matchAll(/\bprofile\.([a-z_]+)/g)].map((match) => match[1]));
assert.deepStrictEqual(
  [...profileColumns].sort(),
  ["avatar_path", "bio", "display_name", "id", "username", "username_base", "username_code"],
  "public_profile reads a column of profiles it was not meant to"
);

// Every key the function builds, at any depth, has to be on the list.
function jsonbKeys(text) {
  const keys = [];
  const opener = "jsonb_build_object(";
  let at = text.indexOf(opener);

  while (at !== -1) {
    const start = at + opener.length;
    const args = [];
    let depth = 0;
    let quoted = false;
    let argStart = start;
    let index = start;

    for (; index < text.length; index += 1) {
      const char = text[index];

      if (quoted) {
        if (char === "'") quoted = false;
        continue;
      }

      if (char === "'") quoted = true;
      else if (char === "(") depth += 1;
      else if (char === ")" && depth === 0) break;
      else if (char === ")") depth -= 1;
      else if (char === "," && depth === 0) {
        args.push(text.slice(argStart, index).trim());
        argStart = index + 1;
      }
    }

    args.push(text.slice(argStart, index).trim());
    args.forEach((arg, position) => {
      if (position % 2 === 0) keys.push(arg);
    });
    at = text.indexOf(opener, start);
  }

  return keys;
}

const ALLOWED_KEYS = new Set([
  // the person
  "id", "display_name", "username_base", "username_code", "avatar_path", "bio",
  // their centre
  "home_gym", "short_name",
  // counts and activity
  "follower_count", "following_count", "workout_count", "weekly_workouts", "is_following",
  // records
  "records", "exercise_id", "exercise_name", "lift_id", "weight_kg", "reps",
  "video_status", "approvals", "rank", "gym", "city", "performed_at",
]);
const keys = jsonbKeys(sql);

assert.ok(keys.length > 20, "the key reader found almost nothing - it no longer understands the SQL");
for (const key of keys) {
  assert.ok(/^'[a-z_]+'$/.test(key), `a jsonb key has to be a plain literal, not ${key}`);
  assert.ok(ALLOWED_KEYS.has(key.slice(1, -1)), `public_profile hands out ${key}, which is not on the list`);
}

// Records by the leaderboard's own rules.
assert.ok(sql.includes("private.featured_exercises()"), "records are the three featured lifts");
assert.ok(sql.includes("private.ranked_lifts(viewer_id, own.gym_id"), "records go through ranked_lifts, for the viewer");
assert.ok(sql.includes("ranked.video_status <> 'rejected'"), "a rejected lift is never a record");
assert.ok(
  sql.includes("'rank', case when best.video_status = 'verified' then best.rank end"),
  "a place is handed out only with a verified video"
);
assert.ok(
  /generate_series\(0, 11\)/.test(sql) && /date_trunc\('week'/.test(sql),
  "activity is twelve Monday-based weeks"
);

/* ------------------------------------------------------------- wiring -- */

const services = read("src/Services/index.js");
assert.ok(
  services.includes('export * as publicProfileService from "./publicProfileService";'),
  "the services barrel does not export publicProfileService"
);

const service = read("src/Services/publicProfileService.js");
assert.ok(service.includes('supabase.rpc("public_profile"'), "the profile comes through the function");
for (const code of ["42883", "42703", "PGRST202", "PGRST204"]) {
  assert.ok(service.includes(`"${code}"`), `a database without the migration (${code}) has to read as "not available", not as a crash`);
}
assert.ok(!/from\("profiles"\)|PROFILES_TABLE/.test(service), "a stranger's profile row is not readable; do not ask for it");

const postService = read("src/Services/socialPostService.js");
const byAuthor = postService.match(/export async function getWorkoutSummaryPostsByAuthor[\s\S]*?\n}\n/);
assert.ok(byAuthor, "socialPostService no longer has the posts-by-author read");
assert.ok(byAuthor[0].includes('.eq("author_id", authorId)'), "the posts are the author's");
assert.ok(byAuthor[0].includes('.is("deleted_at", null)'), "a deleted post is not on a profile");
assert.ok(!byAuthor[0].includes(".rpc("), "posts are read under the table's policies, not around them");

const page = read("src/Pages/PublicProfilePage/PublicProfilePage.js");
assert.ok(
  /isOwnProfile = [^;]*userId === viewerId && !isPreview/.test(page) && page.includes('navigation.replace("ProfilePage")'),
  "your own id without preview has to go on to ProfilePage"
);
assert.ok(!page.includes("SocialUserListPage"), "somebody else's followers are counts, not a list to open");
assert.ok(page.includes("styles.previewDisabled") && page.includes("disabled={isPreview || isFollowBusy}"), "Follow in a preview is shown and not pressable");
assert.ok(/!isPreview && status === "ready" && profile \?/.test(page), "the preview has no menu");
assert.ok(page.includes("socialService.blockUser") && page.includes("socialService.reportUser"), "the menu blocks and reports through socialService");
assert.ok(/blockUser[\s\S]*?navigation\.goBack\(\)/.test(page), "after a block the page goes back");
assert.ok(page.includes("setIsUnfollowOpen(true)"), "unfollowing asks first");
assert.ok(page.includes("Share.share("), "Share opens the share sheet");

const pageStyle = read("src/Pages/PublicProfilePage/PublicProfilePageStyle.js");
assert.ok(/previewDisabled: \{ opacity: 0\.45 \}/.test(pageStyle), "the disabled Follow is at 0.45");

// Every name that is somebody else's opens their profile.
const links = [
  "src/Pages/FeedPage/FeedPage.js",
  "src/Pages/CenterPostsPage/CenterPostsPage.js",
  "src/Pages/UserPostsPage/UserPostsPage.js",
  "src/Pages/HomePage/HomePage.js",
  "src/Pages/GymLeaderboardPage/GymLeaderboardPage.js",
  "src/Pages/GymExerciseLeaderboardPage/GymExerciseLeaderboardPage.js",
  "src/Pages/GymsPage/GymsPage.js",
  "src/Pages/ExploreSearchPage/ExploreSearchPage.js",
  "src/Pages/SocialPage/SocialPage.js",
  "src/Pages/SocialUserListPage/SocialUserListPage.js",
];

for (const file of links) {
  assert.ok(
    /navigat(?:ion\.navigate|e)\(\s*"PublicProfilePage"/.test(read(file)),
    `${file} shows other people's names without opening their profile`
  );
}

for (const file of ["src/Pages/FeedPage/FeedPage.js", "src/Pages/CenterPostsPage/CenterPostsPage.js", "src/Pages/UserPostsPage/UserPostsPage.js"]) {
  assert.ok(/onOpenAuthor=\{/.test(read(file)), `${file} does not pass onOpenAuthor to its post cards`);
}

const card = read("src/Pages/FeedPage/Components/WorkoutSummaryCard/WorkoutSummaryCard.js");
assert.ok(/onOpenAuthor,/.test(card) && card.includes("onOpenAuthor(post)"), "the post card no longer opens its author");
assert.ok(
  read("src/Resources/Components/FriendsActivity/FriendsActivity.js").includes("onOpenPerson(person)"),
  "a friend's tile no longer opens the friend"
);
assert.ok(
  read("src/Resources/Components/GymLeaderboard/LeaderboardRow.js").includes("!isMe"),
  "your own leaderboard row must not open a stranger's page of you"
);

// The posts page reports and likes like the centre posts do.
const userPosts = read("src/Pages/UserPostsPage/UserPostsPage.js");
assert.ok(userPosts.includes("<ReportPostModal"), "somebody's posts can be reported from their list");
assert.ok(userPosts.includes("toggleWorkoutSummaryPostLike"), "likes work on somebody's posts");
assert.ok(userPosts.includes("getPublicProfile("), "the list asks for the profile too, so a block closes it as well");

console.log(
  "Public profile: mapping, records, same centre, activity, posts, the migration's field list and blocks, and every name link passed."
);
