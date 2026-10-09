// The demo cast: made-up people, their follows and the workouts they posted.
// Pure data and pure builders - no network, no files - so
// scripts/test-demo-seed.js can run all of it, and seed-demo.js is the only
// thing that talks to Supabase.
//
// Everything here is fiction. None of these people exist, and none of them is
// ever tied to a real account: the follows below are only ever between the
// cast, and seed-demo.js refuses to touch any user that does not carry the
// demo marker.

const crypto = require("crypto");

/** `user_metadata.fitven_demo === true` plus this e-mail ending: both, or it is not ours. */
const DEMO_MARKER = "fitven_demo";
const DEMO_EMAIL_SUFFIX = ".demo@fitven.dk";

// The columns an exercise starts with in the catalog; copied from there so a
// seeded exercise looks like one the app made.
const DEFAULT_VISIBLE_COLUMNS = Object.freeze({
  rpe: false,
  set: true,
  done: true,
  note: false,
  reps: true,
  rest: true,
  weight: true,
  rm_percentage: false,
});

/**
 * `login` is the one account the emulator signs in as; the rest are only ever
 * seen from its side: the friends it follows, the people in its feed.
 */
const CAST = [
  {
    key: "alex",
    login: true,
    displayName: "Alex Morgan",
    usernameBase: "alexmorgan",
    bio: "Training for a stronger me.",
    birthDate: "1996-01-01",
    avatar: "alex.jpg",
  },
  {
    key: "emma",
    displayName: "Emma Holm",
    usernameBase: "emmaholm",
    bio: "Lifting, coffee, repeat.",
    avatar: "emma.jpg",
  },
  {
    key: "mads",
    displayName: "Mads Kjær",
    usernameBase: "madskjaer",
    bio: "Powerlifting after work.",
    avatar: "mads.jpg",
  },
  {
    key: "jonas",
    displayName: "Jonas Berg",
    usernameBase: "jonasberg",
    bio: "Morning sessions only.",
    avatar: "jonas.jpg",
  },
  {
    key: "sofie",
    displayName: "Sofie Lund",
    usernameBase: "sofielund",
    bio: "Running and lifting.",
    avatar: "sofie.jpg",
  },
];

// [follower, following]. Alex follows all four, three of them follow back, and
// the rest follow each other so everyone has a feed.
const FOLLOWS = [
  ["alex", "emma"],
  ["alex", "mads"],
  ["alex", "jonas"],
  ["alex", "sofie"],
  ["emma", "alex"],
  ["mads", "alex"],
  ["jonas", "alex"],
  ["emma", "mads"],
  ["mads", "emma"],
  ["mads", "jonas"],
  ["jonas", "emma"],
  ["sofie", "emma"],
  ["sofie", "alex"],
];

// A set is [weight, reps]; `pr` is the index of the set that was a record, and
// it is also the exercise's best set by weight times reps, as a top set is.
// `perSide` is a weight written for one dumbbell. Names are the catalog's.
const ACTIVITIES = [
  {
    id: "emma-upper",
    user: "emma",
    daysAgo: 3,
    start: "17:42:00",
    minutes: 62,
    title: "Upper body",
    note: "Felt strong today!",
    likes: ["alex", "mads", "jonas"],
    exercises: [
      { name: "Overhead Press", sets: [[30, 8], [32.5, 7], [35, 7]], pr: 2 },
      { name: "Lat Pulldown", sets: [[50, 10], [55, 8], [55, 8]] },
      { name: "Bench Press", sets: [[50, 8], [52.5, 6], [52.5, 6]] },
      { name: "Face Pull", sets: [[20, 15], [20, 15]] },
      { name: "Hammer Curl", sets: [[12, 10], [12, 10]], perSide: true },
    ],
  },
  {
    id: "emma-legs",
    user: "emma",
    daysAgo: 7,
    start: "07:15:00",
    minutes: 70,
    title: "Legs",
    note: "",
    likes: ["alex", "sofie"],
    exercises: [
      { name: "Squat", sets: [[60, 8], [67.5, 7], [72.5, 7]], pr: 2 },
      { name: "Romanian Deadlift", sets: [[60, 10], [65, 8], [65, 8]] },
      { name: "Leg Press", sets: [[140, 12], [150, 10]] },
      { name: "Standing Calf Raise", sets: [[60, 15], [60, 15]] },
    ],
  },
  {
    id: "mads-push",
    user: "mads",
    daysAgo: 1,
    start: "18:30:00",
    minutes: 75,
    title: "Push",
    note: "New bench PR. Finally.",
    likes: ["alex", "emma"],
    exercises: [
      { name: "Bench Press", sets: [[95, 5], [100, 5], [105, 5]], pr: 2 },
      { name: "Overhead Press", sets: [[60, 6], [60, 6], [57.5, 7]] },
      { name: "Incline Dumbbell Press", sets: [[34, 10], [34, 9]], perSide: true },
      { name: "Skullcrusher", sets: [[35, 10], [35, 10]] },
    ],
  },
  {
    id: "mads-pull",
    user: "mads",
    daysAgo: 5,
    start: "18:05:00",
    minutes: 68,
    title: "Pull",
    note: "",
    likes: ["emma"],
    exercises: [
      { name: "Deadlift", sets: [[160, 5], [170, 3], [170, 3]] },
      { name: "Barbell Row", sets: [[80, 8], [80, 8], [80, 7]] },
      { name: "Lat Pulldown", sets: [[70, 10], [75, 8]] },
      { name: "Hammer Curl", sets: [[16, 10], [16, 9]], perSide: true },
    ],
  },
  {
    id: "jonas-legs",
    user: "jonas",
    daysAgo: 2,
    start: "06:40:00",
    minutes: 58,
    title: "Legs",
    note: "Early start, worth it.",
    likes: ["alex", "emma", "mads"],
    exercises: [
      { name: "Squat", sets: [[100, 6], [110, 5], [110, 5]] },
      { name: "Hack Squat", sets: [[80, 10], [90, 8]] },
      { name: "Leg Curl", sets: [[45, 12], [45, 12]] },
      { name: "Seated Calf Raise", sets: [[50, 15], [50, 15]] },
    ],
  },
  {
    id: "jonas-upper",
    user: "jonas",
    daysAgo: 6,
    start: "06:35:00",
    minutes: 55,
    title: "Upper body",
    note: "",
    likes: ["mads"],
    exercises: [
      { name: "Bench Press", sets: [[80, 6], [85, 5], [85, 5]] },
      { name: "Lat Pulldown", sets: [[60, 10], [65, 8]] },
      { name: "Lateral Raise", sets: [[10, 12], [10, 12]], perSide: true },
    ],
  },
  {
    id: "sofie-full",
    user: "sofie",
    daysAgo: 4,
    start: "16:50:00",
    minutes: 50,
    title: "Full body",
    note: "Short and sweet.",
    likes: ["alex", "emma"],
    exercises: [
      { name: "Goblet Squat", sets: [[16, 12], [20, 10], [20, 10]] },
      { name: "Seated Cable Row", sets: [[35, 12], [40, 10]] },
      { name: "Hip Thrust", sets: [[60, 10], [70, 9], [75, 9]], pr: 2 },
    ],
  },
];

/** The catalog names every activity relies on; checked against the cloud before a seed. */
function activityExerciseNames() {
  return [...new Set(ACTIVITIES.flatMap((a) => a.exercises.map((e) => e.name)))].sort();
}

/** Both halves have to hold: a user is ours only with the marker and the address. */
function isDemoUser(user) {
  return (
    user?.user_metadata?.[DEMO_MARKER] === true &&
    typeof user?.email === "string" &&
    user.email.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX)
  );
}

function demoEmail(member) {
  return `${member.key}${DEMO_EMAIL_SUFFIX}`;
}

/** The same input always gives the same uuid, so a seed can be repeated. */
function stableUuid(seed) {
  const bytes = crypto.createHash("sha1").update(`fitven-demo:${seed}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatWeightDisplay(weight) {
  return String(weight);
}

/** What a workout summary post carries - the shape socialPostService builds. */
function buildPostPayload(activity) {
  const topSets = activity.exercises.map((exercise) => {
    let bestIndex = 0;

    exercise.sets.forEach(([weight, reps], index) => {
      const [bestWeight, bestReps] = exercise.sets[bestIndex];

      if (weight * reps > bestWeight * bestReps) {
        bestIndex = index;
      }
    });

    const [weight, reps] = exercise.sets[bestIndex];
    const isRecord = exercise.pr !== undefined && exercise.pr === bestIndex;

    return {
      exerciseName: exercise.name,
      weight,
      reps,
      unit: "kg",
      weightDisplay: formatWeightDisplay(weight),
      weightMode: exercise.perSide ? "per_side" : "total",
      personalRecord: isRecord,
      previousBest: isRecord ? Math.max(0, weight - 2.5) : null,
    };
  });
  const personalRecords = activity.exercises
    .filter((exercise) => exercise.pr !== undefined)
    .slice(0, 2)
    .map((exercise) => {
      const [weight, reps] = exercise.sets[exercise.pr];

      return {
        exerciseName: exercise.name,
        recordType: "weight",
        value: weight,
        reps,
        unit: "kg",
        displayValue: `${formatWeightDisplay(weight)} x ${reps}`,
      };
    });

  return {
    durationSeconds: activity.minutes * 60,
    setsCount: activity.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    exerciseCount: activity.exercises.length,
    topSets,
    personalRecords,
    exerciseVisibilitySignature: "0:0",
    postMode: "full_info",
  };
}

const COPENHAGEN = "Europe/Copenhagen";

/** YYYY-MM-DD in Copenhagen, `daysAgo` days before `now`. */
function copenhagenDate(now, daysAgo) {
  return new Date(now.getTime() - daysAgo * 86400000).toLocaleDateString("sv-SE", {
    timeZone: COPENHAGEN,
  });
}

/** The instant a Copenhagen wall-clock date and time name. */
function copenhagenInstant(dateText, timeText) {
  const guess = new Date(`${dateText}T${timeText}Z`);
  const shown = new Date(guess.toLocaleString("sv-SE", { timeZone: COPENHAGEN }).replace(" ", "T") + "Z");

  return new Date(guess.getTime() - (shown.getTime() - guess.getTime()));
}

function syncFields(seed, nowIso) {
  return {
    sync_id: stableUuid(seed),
    sync_version: 1,
    deleted_at: null,
    last_updated: nowIso,
    is_deleting: false,
    delete_requested_at: null,
    local_watchers: 0,
  };
}

/**
 * The cloud rows for one activity, without the ids the cloud hands out: the
 * workout, its exercises and their sets, and the post. `userId` is the
 * author's. The caller fills in `cloud_*_id` links as the parents come back.
 *
 * `local_*_id` are the ids a phone gives a row in its own database, and the
 * cloud insists on a number there (not null). Nobody has a phone for these
 * people, so they are counted up from `localIds` - one count per person - and
 * the next start is `used`: the caller carries it on to the next activity.
 */
function buildActivityRows(activity, userId, now = new Date(), localIds = { workout: 1, exercise: 1, set: 1 }) {
  let nextSet = localIds.set;
  const nowIso = now.toISOString();
  const date = copenhagenDate(now, activity.daysAgo);
  const startedAt = copenhagenInstant(date, activity.start);
  const completedAt = new Date(startedAt.getTime() + activity.minutes * 60000);
  const workout = {
    user_id: userId,
    local_workout_type_instance_id: localIds.workout,
    ...syncFields(`${activity.id}:workout`, nowIso),
    cloud_day_id: null,
    workout_type: "Resistance",
    date,
    label: activity.title,
    done: true,
    is_active: false,
    original_start_time: activity.start,
    timer_start: activity.start,
    elapsed_time: activity.minutes * 60,
    gym_id: null,
    started_from: "empty",
  };
  const exercises = activity.exercises.map((exercise, order) => ({
    row: {
      user_id: userId,
      local_exercise_instance_id: localIds.exercise + order,
      ...syncFields(`${activity.id}:exercise:${order}`, nowIso),
      exercise_name: exercise.name,
      exercise_order: order,
      sets: exercise.sets.length,
      visible_columns: { ...DEFAULT_VISIBLE_COLUMNS },
      note: null,
      done: true,
      weight_mode: exercise.perSide ? "per_side" : "total",
    },
    sets: exercise.sets.map(([weight, reps], index) => ({
      user_id: userId,
      local_set_id: nextSet++,
      ...syncFields(`${activity.id}:set:${order}:${index}`, nowIso),
      set_number: index + 1,
      personal_record: exercise.pr === index,
      pause: 120,
      rpe: null,
      weight,
      rm_percentage: null,
      reps,
      done: true,
      failed: false,
      amrap: false,
      set_type: "working",
      amrap_target: null,
      note: null,
      rest_counted: false,
    })),
  }));
  const post = {
    author_id: userId,
    post_type: "workout_summary",
    // 'following': only followers see it, and a follower is only ever one of the cast.
    visibility: "following",
    workout_type: workout.workout_type,
    title: activity.title,
    body: activity.note,
    payload: buildPostPayload(activity),
    completed_at: completedAt.toISOString(),
    created_at: completedAt.toISOString(),
    updated_at: completedAt.toISOString(),
  };

  return {
    workout,
    exercises,
    post,
    used: {
      workout: localIds.workout + 1,
      exercise: localIds.exercise + activity.exercises.length,
      set: nextSet,
    },
  };
}

module.exports = {
  ACTIVITIES,
  CAST,
  DEFAULT_VISIBLE_COLUMNS,
  DEMO_EMAIL_SUFFIX,
  DEMO_MARKER,
  FOLLOWS,
  activityExerciseNames,
  buildActivityRows,
  buildPostPayload,
  copenhagenDate,
  copenhagenInstant,
  demoEmail,
  isDemoUser,
  stableUuid,
};
