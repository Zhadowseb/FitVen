// Exercises people have made, shared: finding them (Explore's library and one
// exercise), taking a copy, saving one for later, reporting one - and your own
// custom exercise: what it is, its video, and whether others can find it.
//
// The exports, their arguments and the shapes they return are the contract the
// screens are built against; keep them exactly, or change the screens with
// them.
//
// Somebody else's exercise is read only through the security definer
// functions of supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql,
// which answer for what the viewer may see and nothing else. Your own is a row
// in the phone's Exercise table (Repository/customExerciseRepository.js) with a
// cloud half in public.custom_exercise, private until you share it, so it comes
// back after a reinstall.
//
// Shapes (camelCase, already normalised - screens never see a raw row):
//
// CustomExerciseSummary = {
//   id: number,                      // public.custom_exercise.id
//   name: string,
//   description: string | null,      // one line, <= 120 characters
//   muscles: { primary: string[], secondary: string[] },   // muscle group keys
//   equipment: string | null,        // one of EQUIPMENT_KEYS (Utils/customExercises)
//   weightMode: "total" | "per_side" | "bodyweight",
//   hasVideo: boolean,
//   videoDurationMs: number | null,
//   posterUrl: string | null,        // the video's first frame, signed for an hour
//   users: number,                   // the owner plus everyone who added it
//   sharedAt: string | null,         // ISO
//   owner: { id, displayName, username, avatarUrl, inYourGym: boolean },
//   isMine: boolean,
//   isAdded: boolean,                // the viewer already has a copy
//   isSaved: boolean,
// }
//
// CustomExerciseDetail = CustomExerciseSummary & {
//   steps: string[],                 // <= 5, each <= 140 characters
//   videoUrl: string | null,         // signed for an hour
//   createdAt: string | null,        // ISO
//   ownerGymName: string | null,     // the owner's centre, short name
//   viewerHasGym: boolean,
//   stats: {
//     users: number,
//     gymUsers: number | null,       // null when the viewer has no centre
//     typicalSets: number | null,
//     typicalReps: number | null,
//     typicalWeightKg: number | null,
//     setCount: number,
//     buckets: { from: number | null, to: number | null, count: number }[] | null,
//                                    // six, or null under DISTRIBUTION_MIN_SETS sets
//   },
// }
//
// MyCustomExercise = {
//   name: string,
//   muscles: { primary: string[], secondary: string[] },
//   description: string | null,
//   steps: string[],
//   equipment: string | null,
//   weightMode: "total" | "per_side" | "bodyweight",
//   isPublic: boolean,
//   cloudId: number | null,          // null until it has reached the cloud
//   sourceExerciseId: number | null, // set on a copy of somebody else's - a copy cannot be shared
//   hasVideo: boolean,
//   videoDurationMs: number | null,
//   posterUrl: string | null,        // resolved when online
//   users: number | null,            // from the cloud, when shared and online
// }
//
// Every function that fails throws an Error whose message is already
// translated and fit to show. A backend without the migration is not a
// failure for the reads: they come back empty with `unavailable: true`.
import { t } from "@localization";
import { getCurrentUserId, supabase } from "@database/supaBaseClient";
import { customExerciseRepository } from "@repository";
import { normalizeExerciseMuscleGroupKeys } from "@utils/exerciseMuscleGroups";
import {
  CUSTOM_EXERCISE_PAGE_SIZE,
  REPORT_NOTE_MAX_LENGTH,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
  buildCustomExerciseCloudFields,
  buildLocalCustomExerciseFields,
  mapCustomExerciseDetailRow,
  mapCustomExerciseSummaryRow,
  mapMyCustomExerciseRow,
  normalizeCustomExerciseSort,
  normalizeDescription,
  normalizeEquipment,
  normalizeReportReason,
  normalizeSteps,
  normalizeWeightMode,
  planCustomExerciseSync,
} from "@utils/customExercises";
import { attachAvatarUrls } from "./avatarUrls";
import { enqueueSync } from "./syncScheduler";

const CUSTOM_EXERCISE_TABLE = "custom_exercise";
export const EXERCISE_VIDEO_BUCKET = "exercise-videos";
// Your own rows, read straight from the table: its policies answer for them.
const OWN_EXERCISE_SELECT =
  "id, name, description, muscle_group_keys, equipment, weight_mode, steps, is_public, source_exercise_id, video_path, poster_path, video_duration_ms, adopter_count, created_at, updated_at";
const MAX_PAGE_SIZE = 50;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
// Signed again a quarter of an hour before the URL lapses, as the avatars are,
// so a list rendered from the cache never holds a link that dies on screen.
const SIGNED_URL_CACHE_MS = (SIGNED_URL_TTL_SECONDS - 15 * 60) * 1000;
// The picker's trim can leave a 20 s clip a little over; the migration allows
// one second more (custom_exercise_video_duration).
const VIDEO_DURATION_SLACK_MS = 1000;
// How long your own exercise page waits for its number of users and its
// poster before it shows without them.
const CLOUD_FILL_TIMEOUT_MS = 4000;
const KNOWN_NAMES_LIMIT = 500;

// A database the migration has not reached: a function PostgREST cannot find
// (PGRST202, or 42883 from Postgres), a column (PGRST204), a table (PGRST205,
// or 42P01).
const MISSING_SCHEMA_CODES = new Set(["42883", "PGRST202", "PGRST204", "42P01", "PGRST205"]);
// Held against the migration by scripts/test-shared-exercises.js: the
// constraint that keeps a copy private, and the sentence the term filter
// raises (private.custom_exercise_reject_blocked_terms).
const COPY_IS_PRIVATE_CONSTRAINT = "custom_exercise_copy_is_private";
const BLOCKED_TERMS_MESSAGE = "cannot be shared as written";
const OFFLINE_MESSAGES = ["network request failed", "failed to fetch", "networkerror", "load failed", "network error"];

/* -------------------------------------------------------------- errors -- */

// Literal keys, so scripts/test-localization.js checks every one of them.
const ERROR_MESSAGES = {
  offline: () => t("exerciseSharing.errors.offline"),
  signedOut: () => t("exerciseSharing.errors.signedOut"),
  notAvailable: () => t("exerciseSharing.errors.notAvailable"),
  notFound: () => t("exerciseSharing.errors.notFound"),
  exerciseGone: () => t("exerciseSharing.errors.exerciseGone"),
  copyCannotBeShared: () => t("exerciseSharing.errors.copyCannotBeShared"),
  nameTaken: () => t("exerciseSharing.errors.nameTaken"),
  blockedTerms: () => t("exerciseSharing.errors.blockedTerms"),
  videoTooLong: () =>
    t("exerciseSharing.errors.videoTooLong", {
      seconds: Math.round(VIDEO_MAX_DURATION_MS / 1000),
    }),
  videoTooLarge: () =>
    t("exerciseSharing.errors.videoTooLarge", {
      megabytes: Math.round(VIDEO_MAX_BYTES / (1024 * 1024)),
    }),
  uploadFailed: () => t("exerciseSharing.errors.uploadFailed"),
  generic: () => t("exerciseSharing.errors.generic"),
};

function sharingError(kind) {
  const message = (ERROR_MESSAGES[kind] ?? ERROR_MESSAGES.generic)();
  const error = new Error(message);

  error.kind = ERROR_MESSAGES[kind] ? kind : "generic";
  error.isExerciseSharingError = true;

  return error;
}

function isMissingSchemaError(error) {
  return MISSING_SCHEMA_CODES.has(String(error?.code ?? ""));
}

function errorText(error) {
  return [error?.message, error?.details, error?.originalError?.message, error?.cause?.message]
    .filter((part) => typeof part === "string" && part)
    .join(" ");
}

function isOfflineError(error) {
  const text = errorText(error).toLowerCase();

  return OFFLINE_MESSAGES.some((message) => text.includes(message));
}

/** Whatever came back, as an error the screen can show as it is. */
function toSharingError(error, fallback = "generic") {
  if (error?.isExerciseSharingError) {
    return error;
  }

  if (!error) {
    return sharingError(fallback);
  }

  if (isMissingSchemaError(error)) {
    return sharingError("notAvailable");
  }

  if (isOfflineError(error)) {
    return sharingError("offline");
  }

  const code = String(error.code ?? "");
  const text = errorText(error);

  if (code === "23514" && text.includes(COPY_IS_PRIVATE_CONSTRAINT)) {
    return sharingError("copyCannotBeShared");
  }

  if (code === "23514" && text.includes(BLOCKED_TERMS_MESSAGE)) {
    return sharingError("blockedTerms");
  }

  if (code === "23505") {
    return sharingError("nameTaken");
  }

  // Storage answers in its own words: a bucket the migration has not made,
  // and a file over the bucket's limit.
  if (/bucket not found/i.test(text)) {
    return sharingError("notAvailable");
  }

  if (/maximum allowed size|payload too large/i.test(text) || String(error.statusCode ?? "") === "413") {
    return sharingError("videoTooLarge");
  }

  console.warn("Exercise sharing failed:", error);

  return sharingError(fallback);
}

let missingMigrationReported = false;

function reportMissingMigration(error) {
  if (missingMigrationReported) {
    return;
  }

  missingMigrationReported = true;
  console.warn(
    "Shared exercises are not set up yet: run supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql.",
    error?.message ?? error
  );
}

/* ---------------------------------------------------------- the viewer -- */

async function getSignedInUserId() {
  try {
    return (await getCurrentUserId()) ?? null;
  } catch (error) {
    if (String(error?.message ?? "").toLowerCase().includes("auth session missing")) {
      return null;
    }

    throw error;
  }
}

async function requireUserId() {
  let userId = null;

  try {
    userId = await getSignedInUserId();
  } catch (error) {
    throw toSharingError(error);
  }

  if (!userId) {
    throw sharingError("signedOut");
  }

  return userId;
}

/* -------------------------------------------------------------- values -- */

function toCloudId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function toCount(value) {
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

function toCountOrNull(value) {
  return value === null || value === undefined ? null : toCount(value);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function isFlagSet(value) {
  return value === true || Number(value) === 1;
}

function nameKey(name) {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

function normalizeMuscleGroupKey(value) {
  return typeof value === "string" ? normalizeExerciseMuscleGroupKeys([value])[0] ?? null : null;
}

// The cursor is the server's, as a JSON string the screen hands back untouched.
function parseCursor(cursor) {
  if (!cursor) {
    return null;
  }

  if (typeof cursor === "object") {
    return cursor;
  }

  try {
    const parsed = JSON.parse(cursor);

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function withTimeout(promise, milliseconds) {
  let timer = null;

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), milliseconds);
    }),
  ]);
}

/* -------------------------------------------------------------- caches -- */

// The names of exercises the library has shown, by cloud id, so adding one can
// check the phone's own names before it asks the server.
const knownExerciseNames = new Map();
// How many use each of your own shared exercises, as the cloud last said, so a
// save does not have to ask again.
const knownUsers = new Map();
const signedMediaCache = new Map();
// What the sync has already said about an exercise it could not sync, so a
// problem that lasts is logged once per launch and not on every sync.
const reportedSkips = new Set();

function rememberExerciseName(id, name) {
  if (id === null || !name) {
    return;
  }

  knownExerciseNames.delete(id);
  knownExerciseNames.set(id, name);

  if (knownExerciseNames.size > KNOWN_NAMES_LIMIT) {
    knownExerciseNames.delete(knownExerciseNames.keys().next().value);
  }
}

function rememberUsers(cloudId, users) {
  if (cloudId === null) {
    return;
  }

  if (users === null) {
    knownUsers.delete(cloudId);
  } else {
    knownUsers.set(cloudId, users);
  }
}

/* --------------------------------------------------------------- media -- */

/**
 * Signs posters and clips in one request and returns the URLs by path. A path
 * that cannot be signed is simply absent, and the screen shows the clip
 * without a frame rather than a broken image.
 */
async function signExerciseMedia(paths = []) {
  const wanted = [...new Set(paths.filter((path) => typeof path === "string" && path))];
  const resolved = new Map();

  if (!wanted.length) {
    return resolved;
  }

  const now = Date.now();
  const missing = [];

  for (const path of wanted) {
    const cached = signedMediaCache.get(path);

    if (cached && cached.expiresAt > now) {
      resolved.set(path, cached.url);
    } else {
      missing.push(path);
    }
  }

  if (!missing.length) {
    return resolved;
  }

  try {
    const { data, error } = await supabase.storage
      .from(EXERCISE_VIDEO_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);

    if (error) {
      console.warn("Could not sign exercise media:", error);
      return resolved;
    }

    for (const entry of data ?? []) {
      if (!entry?.signedUrl || entry.error) {
        continue;
      }

      signedMediaCache.set(entry.path, {
        url: entry.signedUrl,
        expiresAt: now + SIGNED_URL_CACHE_MS,
      });
      resolved.set(entry.path, entry.signedUrl);
    }
  } catch (error) {
    console.warn("Could not sign exercise media:", error);
  }

  return resolved;
}

function cachedMediaUrl(path) {
  const cached = path ? signedMediaCache.get(path) : null;

  return cached && cached.expiresAt > Date.now() ? cached.url : null;
}

/** After an upload or a removal, so the next read signs the new file. */
function forgetExerciseMedia(paths = []) {
  for (const path of paths) {
    if (path) {
      signedMediaCache.delete(path);
    }
  }
}

async function readLocalFile(uri) {
  let response;

  try {
    response = await fetch(uri);
  } catch (error) {
    console.warn("Could not read the clip from the phone:", error);
    throw sharingError("uploadFailed");
  }

  if (!response.ok) {
    throw sharingError("uploadFailed");
  }

  const buffer = await response.arrayBuffer();

  if (!buffer?.byteLength) {
    throw sharingError("uploadFailed");
  }

  return buffer;
}

async function uploadMedia(path, body, contentType) {
  let result;

  try {
    result = await supabase.storage
      .from(EXERCISE_VIDEO_BUCKET)
      .upload(path, body, { contentType, upsert: true });
  } catch (error) {
    throw toSharingError(error, "uploadFailed");
  }

  if (result?.error) {
    throw toSharingError(result.error, "uploadFailed");
  }
}

async function removeMediaQuietly(paths) {
  const wanted = paths.filter(Boolean);

  if (!wanted.length) {
    return;
  }

  try {
    const { error } = await supabase.storage.from(EXERCISE_VIDEO_BUCKET).remove(wanted);

    if (error) {
      console.warn("Could not remove exercise media:", error);
    }
  } catch (error) {
    console.warn("Could not remove exercise media:", error);
  }
}

function loadVideoThumbnails() {
  try {
    // New native code in 2.11. A build from before it has no such module and
    // throws here; that build makes no poster, and the list shows the clip
    // without a frame.
    const thumbnails = require("expo-video-thumbnails");

    return typeof thumbnails?.getThumbnailAsync === "function" ? thumbnails : null;
  } catch {
    return null;
  }
}

/** The clip's first frame as a JPEG next to it. -> its path, or null for none. */
async function uploadPoster(videoUri, posterPath) {
  const thumbnails = loadVideoThumbnails();

  if (!thumbnails) {
    return null;
  }

  try {
    const frame = await thumbnails.getThumbnailAsync(videoUri, { time: 0, quality: 0.7 });

    if (!frame?.uri) {
      return null;
    }

    const image = await readLocalFile(frame.uri);

    await uploadMedia(posterPath, image, "image/jpeg");

    return posterPath;
  } catch (error) {
    console.warn("The clip went up without a poster:", error);
    return null;
  }
}

/* ------------------------------------------------------------ changes -- */

const changeListeners = new Set();

function notifyCustomExerciseChange(change) {
  for (const listener of [...changeListeners]) {
    try {
      listener(change);
    } catch (error) {
      console.warn("A custom exercise listener failed:", error);
    }
  }
}

/** Called after an add, a save or a share, so lists that show them refresh. -> unsubscribe */
export function subscribeCustomExerciseChanges(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  changeListeners.add(listener);

  return () => {
    changeListeners.delete(listener);
  };
}

/* --------------------------------------------------------------- reads -- */

function emptyLibrary(extra = {}) {
  return {
    items: [],
    nextCursor: null,
    total: 0,
    libraryTotal: 0,
    viewerHasGym: false,
    ...extra,
  };
}

// The owners' pictures in one request for the whole page, as a post's author's
// are. The path goes after, so the screens get the contract's owner and no
// storage path.
async function attachOwnerAvatars(entries) {
  const owners = entries.map(({ row, item }) => {
    item.owner.avatarPath = row?.owner?.avatar_path ?? null;
    return item.owner;
  });

  try {
    await attachAvatarUrls(owners);
  } catch (error) {
    console.warn("Could not sign the owners' pictures:", error);
  }

  for (const owner of owners) {
    delete owner.avatarPath;
  }
}

/**
 * One page of the library.
 * sort: one of CUSTOM_EXERCISE_SORTS. muscleGroup: a muscle group key or null.
 * query: searched in name and description. cursor: from the previous page.
 * -> { items: CustomExerciseSummary[], nextCursor: string | null,
 *      total: number | null,        // matching the filters - first page only
 *      libraryTotal: number | null, // every exercise that can be found - first page only
 *      viewerHasGym: boolean, unavailable?: true }
 */
export async function getPublicCustomExercises({
  sort = "popular",
  muscleGroup = null,
  query = "",
  cursor = null,
  limit = CUSTOM_EXERCISE_PAGE_SIZE,
} = {}) {
  await requireUserId();

  const cursorValue = parseCursor(cursor);
  const searchText = typeof query === "string" ? query.trim() : "";
  const pageSize = Math.min(
    Math.max(Math.trunc(Number(limit)) || CUSTOM_EXERCISE_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  let response;

  try {
    response = await supabase.rpc("browse_custom_exercises", {
      p_sort: normalizeCustomExerciseSort(sort),
      p_muscle_group: normalizeMuscleGroupKey(muscleGroup),
      p_query: searchText.length >= 2 ? searchText : null,
      p_cursor: cursorValue,
      p_limit: pageSize,
    });
  } catch (error) {
    throw toSharingError(error);
  }

  const { data, error } = response;

  if (error) {
    if (isMissingSchemaError(error)) {
      reportMissingMigration(error);
      return emptyLibrary({ unavailable: true });
    }

    throw toSharingError(error);
  }

  if (!data) {
    return emptyLibrary();
  }

  const entries = (Array.isArray(data.items) ? data.items : [])
    .map((row) => ({ row, item: mapCustomExerciseSummaryRow(row) }))
    .filter((entry) => entry.item);
  const [posterUrls] = await Promise.all([
    signExerciseMedia(entries.map(({ row }) => row.poster_path)),
    attachOwnerAvatars(entries),
  ]);

  for (const { row, item } of entries) {
    item.posterUrl = row.poster_path ? posterUrls.get(row.poster_path) ?? null : null;
    rememberExerciseName(item.id, item.name);
  }

  const isFirstPage = cursorValue === null;

  return {
    items: entries.map(({ item }) => item),
    nextCursor: data.next_cursor ? JSON.stringify(data.next_cursor) : null,
    total: isFirstPage ? toCountOrNull(data.total) : null,
    libraryTotal: isFirstPage ? toCountOrNull(data.library_total) : null,
    viewerHasGym: data.viewer_has_gym === true,
  };
}

/** One shared exercise -> CustomExerciseDetail, or null when it cannot be seen. */
export async function getPublicCustomExercise(id) {
  const cloudId = toCloudId(id);

  if (cloudId === null) {
    return null;
  }

  await requireUserId();

  let response;

  try {
    response = await supabase.rpc("custom_exercise_detail", { p_id: cloudId });
  } catch (error) {
    throw toSharingError(error);
  }

  const { data, error } = response;

  if (error) {
    if (isMissingSchemaError(error)) {
      reportMissingMigration(error);
      return null;
    }

    throw toSharingError(error);
  }

  const detail = mapCustomExerciseDetailRow(data);

  if (!detail) {
    return null;
  }

  const [mediaUrls] = await Promise.all([
    signExerciseMedia([data.poster_path, data.video_path]),
    attachOwnerAvatars([{ row: data, item: detail }]),
  ]);

  detail.posterUrl = data.poster_path ? mediaUrls.get(data.poster_path) ?? null : null;
  detail.videoUrl = data.video_path ? mediaUrls.get(data.video_path) ?? null : null;
  rememberExerciseName(detail.id, detail.name);

  return detail;
}

/* ------------------------------------------------ adding, saving, reporting -- */

/**
 * The copy the server made, on this phone as well: a custom row with the cloud
 * id, the original's id and the fields. -> its name, or null when the phone
 * already uses that name for something else.
 */
async function ensureLocalCopy(db, cloudRow, { madeNow }) {
  const fields = buildLocalCustomExerciseFields(cloudRow);

  if (!fields.name || fields.cloud_custom_exercise_id === null) {
    return null;
  }

  const linked = await customExerciseRepository.getCustomExerciseByCloudId(
    db,
    fields.cloud_custom_exercise_id
  );

  if (linked) {
    return linked.name;
  }

  const sameName = await customExerciseRepository.getExerciseByName(db, fields.name);

  if (sameName) {
    // The phone links everything by name, so it cannot hold both. A copy made
    // just now goes again, rather than waiting in the cloud for the sync to
    // link it to the wrong exercise.
    if (madeNow) {
      try {
        await supabase
          .from(CUSTOM_EXERCISE_TABLE)
          .delete()
          .eq("id", fields.cloud_custom_exercise_id);
      } catch (error) {
        console.warn("Could not take back a copy the phone has no room for:", error);
      }
    }

    return null;
  }

  const inserted = await customExerciseRepository.insertCustomExerciseFromCloud(db, fields);

  return inserted ? fields.name : null;
}

/**
 * Adds a copy to your own exercises: name, muscles, equipment, weight mode,
 * description and steps - never the owner's sets.
 * -> { status: "added" | "already_added" | "name_taken" | "own", exerciseName: string | null }
 */
export async function adoptExercise(db, id) {
  const cloudId = toCloudId(id);

  if (cloudId === null) {
    throw sharingError("exerciseGone");
  }

  await requireUserId();

  // What the phone can answer on its own, without a request.
  const localCopy = await customExerciseRepository.getCustomExerciseBySourceId(db, cloudId);

  if (localCopy) {
    return { status: "already_added", exerciseName: localCopy.name };
  }

  const ownRow = await customExerciseRepository.getCustomExerciseByCloudId(db, cloudId);

  if (ownRow) {
    return { status: "own", exerciseName: ownRow.name };
  }

  const knownName = knownExerciseNames.get(cloudId);

  if (knownName && (await customExerciseRepository.getExerciseByName(db, knownName))) {
    return { status: "name_taken", exerciseName: null };
  }

  let response;

  try {
    response = await supabase.rpc("adopt_custom_exercise", { p_id: cloudId });
  } catch (error) {
    throw toSharingError(error);
  }

  const { data, error } = response;

  if (error) {
    throw toSharingError(error);
  }

  if (!data) {
    throw sharingError("exerciseGone");
  }

  const status = String(data.status ?? "");
  const cloudRow = data.exercise && typeof data.exercise === "object" ? data.exercise : null;

  if (status === "own") {
    return { status: "own", exerciseName: cloudRow?.name ?? null };
  }

  if (status === "name_taken") {
    return { status: "name_taken", exerciseName: null };
  }

  if ((status !== "added" && status !== "already_added") || !cloudRow) {
    throw sharingError("generic");
  }

  const exerciseName = await ensureLocalCopy(db, cloudRow, { madeNow: status === "added" });

  if (!exerciseName) {
    return { status: "name_taken", exerciseName: null };
  }

  notifyCustomExerciseChange({ type: "added", id: cloudId, exerciseName });

  return { status, exerciseName };
}

/** Puts it on your saved list, or takes it off. -> { saved: boolean } */
export async function setExerciseSaved(id, saved) {
  const cloudId = toCloudId(id);

  if (cloudId === null) {
    throw sharingError("exerciseGone");
  }

  await requireUserId();

  let response;

  try {
    response = await supabase.rpc("set_custom_exercise_saved", {
      p_id: cloudId,
      p_saved: Boolean(saved),
    });
  } catch (error) {
    throw toSharingError(error);
  }

  if (response.error) {
    throw toSharingError(response.error);
  }

  const isSaved = response.data === true;

  notifyCustomExerciseChange({ type: "saved", id: cloudId, saved: isSaved });

  return { saved: isSaved };
}

/** reason: one of REPORT_REASONS. Reporting twice is not an error. -> { hidden: boolean } */
export async function reportExercise({ id, reason, note = null } = {}) {
  const cloudId = toCloudId(id);
  const normalizedReason = normalizeReportReason(reason);

  if (cloudId === null || !normalizedReason) {
    throw sharingError("generic");
  }

  await requireUserId();

  const trimmedNote =
    typeof note === "string" ? note.trim().slice(0, REPORT_NOTE_MAX_LENGTH).trim() : "";
  let response;

  try {
    response = await supabase.rpc("report_custom_exercise", {
      p_id: cloudId,
      p_reason: normalizedReason,
      p_note: trimmedNote || null,
    });
  } catch (error) {
    throw toSharingError(error);
  }

  if (response.error) {
    throw toSharingError(response.error);
  }

  const hidden = response.data?.hidden === true;

  if (hidden) {
    notifyCustomExerciseChange({ type: "hidden", id: cloudId });
  }

  return { hidden };
}

/* ---------------------------------------------------- your own exercise -- */

async function requireOwnRow(db, exerciseName) {
  const row = await customExerciseRepository.getCustomExerciseByName(db, exerciseName);

  if (!row) {
    throw sharingError("notFound");
  }

  return row;
}

// The phone's row, with whatever the caches already know - no request.
function buildMyCustomExercise(row) {
  const mine = mapMyCustomExerciseRow(row);

  if (!mine) {
    return null;
  }

  mine.posterUrl = cachedMediaUrl(row.poster_path);
  mine.users =
    mine.isPublic && mine.cloudId !== null ? knownUsers.get(mine.cloudId) ?? null : null;

  return mine;
}

async function readOwnCloudFields(row, cloudId) {
  const userId = await getSignedInUserId();

  if (!userId) {
    return null;
  }

  const [cloud, mediaUrls] = await Promise.all([
    supabase
      .from(CUSTOM_EXERCISE_TABLE)
      .select("id, is_public, adopter_count")
      .eq("id", cloudId)
      .maybeSingle(),
    signExerciseMedia([row.poster_path]),
  ]);
  const posterUrl = row.poster_path ? mediaUrls.get(row.poster_path) ?? null : null;

  if (cloud.error) {
    if (!isMissingSchemaError(cloud.error)) {
      console.warn("Could not read your exercise from the cloud:", cloud.error);
    }

    return { users: null, posterUrl };
  }

  const users = cloud.data?.is_public === true ? toCount(cloud.data.adopter_count) + 1 : null;

  rememberUsers(cloudId, users);

  return { users, posterUrl };
}

/** Your own custom exercise, by name -> MyCustomExercise | null. */
export async function getMyCustomExercise(db, exerciseName) {
  const row = await customExerciseRepository.getCustomExerciseByName(db, exerciseName);
  const mine = row ? buildMyCustomExercise(row) : null;

  if (!mine || mine.cloudId === null) {
    return mine;
  }

  // Best effort, and bounded: a slow network must not hold the page.
  const fromCloud = await withTimeout(readOwnCloudFields(row, mine.cloudId), CLOUD_FILL_TIMEOUT_MS).catch(
    (error) => {
      console.warn("Could not read your exercise from the cloud:", error);
      return null;
    }
  );

  if (fromCloud) {
    mine.users = fromCloud.users;
    mine.posterUrl = fromCloud.posterUrl ?? mine.posterUrl;
  }

  return mine;
}

/** Saves what it is and how it is done. -> MyCustomExercise */
export async function updateMyCustomExercise(
  db,
  exerciseName,
  { description, steps, equipment, weightMode } = {}
) {
  const row = await requireOwnRow(db, exerciseName);
  const current = {
    description: normalizeDescription(row.description),
    steps: normalizeSteps(row.steps),
    equipment: normalizeEquipment(row.equipment),
    weightMode: normalizeWeightMode(row.weight_mode),
  };
  const next = {
    description: description === undefined ? current.description : normalizeDescription(description),
    steps: steps === undefined ? current.steps : normalizeSteps(steps),
    equipment: equipment === undefined ? current.equipment : normalizeEquipment(equipment),
    weightMode: weightMode === undefined ? current.weightMode : normalizeWeightMode(weightMode),
  };
  const changed =
    next.description !== current.description ||
    JSON.stringify(next.steps) !== JSON.stringify(current.steps) ||
    next.equipment !== current.equipment ||
    next.weightMode !== current.weightMode;

  if (!changed) {
    return buildMyCustomExercise(row);
  }

  await customExerciseRepository.updateCustomExerciseDetails(db, row.name, {
    description: next.description,
    steps: JSON.stringify(next.steps),
    equipment: next.equipment,
    weightMode: next.weightMode,
  });

  // Saved on the phone already; the cloud gets it when the queue gets to it.
  syncCustomExercisesInBackground(db);
  notifyCustomExerciseChange({ type: "updated", exerciseName: row.name });

  return buildMyCustomExercise(await customExerciseRepository.getCustomExerciseByName(db, row.name));
}

async function findOwnCloudRowByName(userId, exerciseName) {
  const { data, error } = await supabase
    .from(CUSTOM_EXERCISE_TABLE)
    .select(OWN_EXERCISE_SELECT)
    .eq("user_id", userId);

  if (error) {
    throw toSharingError(error);
  }

  const key = nameKey(exerciseName);

  return (data ?? []).find((cloudRow) => nameKey(cloudRow?.name) === key) ?? null;
}

/**
 * Puts a local custom exercise in the cloud and links the two. A name the
 * cloud already has (23505) is this same exercise from before - an upload
 * whose answer never arrived - and is linked instead. -> the cloud row
 */
async function uploadCustomExercise(db, row, userId) {
  let response;

  try {
    response = await supabase
      .from(CUSTOM_EXERCISE_TABLE)
      .insert({ name: row.name, ...buildCustomExerciseCloudFields(row) })
      .select(OWN_EXERCISE_SELECT)
      .single();
  } catch (error) {
    throw toSharingError(error);
  }

  const { data, error } = response;

  if (!error && data) {
    await customExerciseRepository.markCustomExerciseUploaded(db, {
      uploadedRow: row,
      cloudId: data.id,
      cloudUpdatedAt: data.updated_at,
    });

    return data;
  }

  if (String(error?.code ?? "") === "23505") {
    const existing = await findOwnCloudRowByName(userId, row.name);

    if (existing) {
      const holder = await customExerciseRepository.getCustomExerciseByCloudId(db, existing.id);

      if (holder && holder.name !== row.name) {
        throw sharingError("nameTaken");
      }

      // Not marked as seen: the next sync compares the two and takes the
      // cloud's version, or pushes this phone's edit if it has one.
      await customExerciseRepository.linkCustomExerciseToCloud(db, {
        exerciseName: row.name,
        cloudId: existing.id,
      });

      return existing;
    }
  }

  throw toSharingError(error);
}

async function ensureCloudRow(db, row, userId) {
  const existingId = toCloudId(row.cloud_custom_exercise_id);

  if (existingId !== null) {
    return existingId;
  }

  const cloudRow = await uploadCustomExercise(db, row, userId);

  return toCloudId(cloudRow?.id);
}

/** Lets others find it, or stops them. Uploads it first if it has to. -> MyCustomExercise */
export async function setExercisePublic(db, exerciseName, isPublic) {
  const userId = await requireUserId();
  const row = await requireOwnRow(db, exerciseName);
  const shouldShare = Boolean(isPublic);

  if (shouldShare && toCloudId(row.source_exercise_id) !== null) {
    throw sharingError("copyCannotBeShared");
  }

  const cloudId = await ensureCloudRow(db, row, userId);

  if (cloudId === null) {
    throw sharingError("generic");
  }

  // An edit the cloud does not have yet goes up with the switch, so what
  // others find is what the owner sees.
  const current = (await customExerciseRepository.getCustomExerciseByName(db, row.name)) ?? row;
  const pushesContent = isFlagSet(current.custom_needs_upload);
  const payload = pushesContent
    ? { ...buildCustomExerciseCloudFields(current), is_public: shouldShare }
    : { is_public: shouldShare };
  let response;

  try {
    response = await supabase
      .from(CUSTOM_EXERCISE_TABLE)
      .update(payload)
      .eq("id", cloudId)
      .select(OWN_EXERCISE_SELECT)
      .maybeSingle();
  } catch (error) {
    throw toSharingError(error);
  }

  if (response.error) {
    throw toSharingError(response.error);
  }

  if (!response.data) {
    // The cloud no longer has it. The next sync uploads it again.
    await customExerciseRepository.clearCustomExerciseCloudId(db, row.name);
    throw sharingError("generic");
  }

  const cloudRow = response.data;
  const isShared = cloudRow.is_public === true;

  await customExerciseRepository.setCustomExercisePublicState(db, {
    exerciseName: row.name,
    isPublic: isShared,
    cloudUpdatedAt: cloudRow.updated_at,
  });

  if (pushesContent) {
    await customExerciseRepository.markCustomExerciseUploaded(db, {
      uploadedRow: current,
      cloudId,
      cloudUpdatedAt: cloudRow.updated_at,
    });
  }

  rememberUsers(cloudId, isShared ? toCount(cloudRow.adopter_count) + 1 : null);
  notifyCustomExerciseChange({ type: "shared", exerciseName: row.name, isPublic: isShared });

  const updated = await customExerciseRepository.getCustomExerciseByName(db, row.name);
  const mine = buildMyCustomExercise(updated);

  if (mine && updated?.poster_path && !mine.posterUrl) {
    mine.posterUrl = (await signExerciseMedia([updated.poster_path])).get(updated.poster_path) ?? null;
  }

  return mine;
}

/**
 * The clip that shows it: at most VIDEO_MAX_DURATION_MS and VIDEO_MAX_BYTES,
 * as the picker returns it. -> MyCustomExercise
 */
export async function uploadExerciseVideo(db, exerciseName, { uri, durationMs, fileSize, mimeType } = {}) {
  const userId = await requireUserId();
  const row = await requireOwnRow(db, exerciseName);

  if (typeof uri !== "string" || !uri) {
    throw sharingError("uploadFailed");
  }

  // The picker checks too; this holds when it did not, before anything is
  // read or sent.
  const duration = toFiniteNumber(durationMs);

  if (duration !== null && duration > VIDEO_MAX_DURATION_MS + VIDEO_DURATION_SLACK_MS) {
    throw sharingError("videoTooLong");
  }

  const size = toFiniteNumber(fileSize);

  if (size !== null && size > VIDEO_MAX_BYTES) {
    throw sharingError("videoTooLarge");
  }

  const cloudId = await ensureCloudRow(db, row, userId);

  if (cloudId === null) {
    throw sharingError("uploadFailed");
  }

  const video = await readLocalFile(uri);

  if (video.byteLength > VIDEO_MAX_BYTES) {
    throw sharingError("videoTooLarge");
  }

  const isQuickTime =
    mimeType === "video/quicktime" || (!mimeType && /\.mov$/i.test(uri.split("?")[0]));
  const extension = isQuickTime ? "mov" : "mp4";
  const videoPath = `${userId}/${cloudId}.${extension}`;
  const otherVideoPath = `${userId}/${cloudId}.${isQuickTime ? "mp4" : "mov"}`;
  const posterTarget = `${userId}/${cloudId}-poster.jpg`;

  await uploadMedia(videoPath, video, isQuickTime ? "video/quicktime" : "video/mp4");

  const posterPath = await uploadPoster(uri, posterTarget);
  const clipDurationMs =
    duration === null
      ? null
      : Math.min(Math.max(Math.round(duration), 1), VIDEO_MAX_DURATION_MS + VIDEO_DURATION_SLACK_MS);
  let response;

  try {
    response = await supabase
      .from(CUSTOM_EXERCISE_TABLE)
      .update({
        video_path: videoPath,
        poster_path: posterPath,
        video_duration_ms: clipDurationMs,
      })
      .eq("id", cloudId)
      .select(OWN_EXERCISE_SELECT)
      .maybeSingle();
  } catch (error) {
    throw toSharingError(error, "uploadFailed");
  }

  if (response.error || !response.data) {
    throw toSharingError(response.error, "uploadFailed");
  }

  await customExerciseRepository.setCustomExerciseVideo(db, {
    exerciseName: row.name,
    videoPath,
    posterPath,
    videoDurationMs: clipDurationMs,
    cloudUpdatedAt: response.data.updated_at,
  });

  // A clip in the other container, and a poster this clip did not get, would
  // otherwise stay in storage pointing at nothing.
  await removeMediaQuietly([otherVideoPath, posterPath ? null : posterTarget]);
  forgetExerciseMedia([videoPath, otherVideoPath, posterTarget]);
  notifyCustomExerciseChange({ type: "video", exerciseName: row.name });

  const mine = buildMyCustomExercise(await customExerciseRepository.getCustomExerciseByName(db, row.name));

  if (mine && posterPath) {
    mine.posterUrl = (await signExerciseMedia([posterPath])).get(posterPath) ?? null;
  }

  return mine;
}

/** -> MyCustomExercise */
export async function removeExerciseVideo(db, exerciseName) {
  const userId = await requireUserId();
  const row = await requireOwnRow(db, exerciseName);
  const cloudId = toCloudId(row.cloud_custom_exercise_id);
  const ownFolder = `${userId}/`;
  const paths = [
    ...new Set(
      [
        row.video_path,
        row.poster_path,
        ...(cloudId === null
          ? []
          : [`${userId}/${cloudId}.mp4`, `${userId}/${cloudId}.mov`, `${userId}/${cloudId}-poster.jpg`]),
      ].filter((path) => typeof path === "string" && path.startsWith(ownFolder))
    ),
  ];

  // The files first, and best effort: a file left behind is only storage,
  // while a row pointing at a file that is gone is a broken clip on screen.
  await removeMediaQuietly(paths);

  let cloudUpdatedAt = null;

  if (cloudId !== null) {
    let response;

    try {
      response = await supabase
        .from(CUSTOM_EXERCISE_TABLE)
        .update({ video_path: null, poster_path: null, video_duration_ms: null })
        .eq("id", cloudId)
        .select("id, updated_at")
        .maybeSingle();
    } catch (error) {
      throw toSharingError(error);
    }

    if (response.error) {
      throw toSharingError(response.error);
    }

    cloudUpdatedAt = response.data?.updated_at ?? null;
  }

  await customExerciseRepository.setCustomExerciseVideo(db, {
    exerciseName: row.name,
    videoPath: null,
    posterPath: null,
    videoDurationMs: null,
    cloudUpdatedAt,
  });
  forgetExerciseMedia(paths);
  notifyCustomExerciseChange({ type: "video", exerciseName: row.name });

  return buildMyCustomExercise(await customExerciseRepository.getCustomExerciseByName(db, row.name));
}

/* ---------------------------------------------------------------- sync -- */

async function pushCustomExercise(db, row, cloudId) {
  const { data, error } = await supabase
    .from(CUSTOM_EXERCISE_TABLE)
    .update(buildCustomExerciseCloudFields(row))
    .eq("id", cloudId)
    .select("id, updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    // Gone from the cloud since the plan was made: uploaded again next time.
    await customExerciseRepository.clearCustomExerciseCloudId(db, row.name);
    return;
  }

  await customExerciseRepository.markCustomExerciseUploaded(db, {
    uploadedRow: row,
    cloudId,
    cloudUpdatedAt: data.updated_at,
  });
}

async function pullCustomExercise(db, exerciseName, cloudRow) {
  forgetExerciseMedia([cloudRow?.video_path, cloudRow?.poster_path]);

  return customExerciseRepository.applyCloudCustomExercise(
    db,
    exerciseName,
    buildLocalCustomExerciseFields(cloudRow)
  );
}

async function runCustomExerciseSync(db, userId) {
  const totals = { uploaded: 0, restored: 0, updated: 0, skipped: 0 };
  const { data: cloudRows, error } = await supabase
    .from(CUSTOM_EXERCISE_TABLE)
    .select(OWN_EXERCISE_SELECT)
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchemaError(error)) {
      reportMissingMigration(error);
      return { ...totals, unavailable: true };
    }

    throw error;
  }

  const localRows = await customExerciseRepository.getExercisesForCustomSync(db);
  const plan = planCustomExerciseSync(localRows, cloudRows ?? []);
  const localByName = new Map(localRows.map((row) => [row.name, row]));
  let changedHere = false;

  // One exercise that cannot go up - a name the cloud refuses, say - must not
  // stop the others. It stays as it is and is tried again next time, and the
  // same failure is said once per launch rather than on every sync.
  const attempt = async (label, step) => {
    try {
      await step();
      return true;
    } catch (stepError) {
      totals.skipped += 1;

      const failureKey = `${label}:${stepError?.code ?? stepError?.message ?? ""}`;

      if (!reportedSkips.has(failureKey)) {
        reportedSkips.add(failureKey);
        console.warn(`Custom exercise sync: ${label}`, stepError);
      }

      return false;
    }
  };

  for (const step of plan.upload) {
    const row = localByName.get(step.name);

    if (row && (await attempt(`"${step.name}" did not reach the cloud`, () => uploadCustomExercise(db, row, userId)))) {
      totals.uploaded += 1;
    }
  }

  for (const step of plan.link) {
    const row = localByName.get(step.name);

    const linked = await attempt(`"${step.name}" could not be linked`, async () => {
      await customExerciseRepository.linkCustomExerciseToCloud(db, {
        exerciseName: step.name,
        cloudId: step.cloudId,
      });

      if (step.then === "push") {
        await pushCustomExercise(db, row, step.cloudId);
      } else if (await pullCustomExercise(db, step.name, step.cloudRow)) {
        changedHere = true;
      }
    });

    if (linked) {
      totals.updated += 1;
    }
  }

  for (const step of plan.push) {
    const row = localByName.get(step.name);

    if (row && (await attempt(`"${step.name}" did not reach the cloud`, () => pushCustomExercise(db, row, step.cloudId)))) {
      totals.updated += 1;
    }
  }

  for (const step of plan.pull) {
    let pulled = false;

    await attempt(`"${step.name}" could not take the cloud's version`, async () => {
      pulled = await pullCustomExercise(db, step.name, step.cloudRow);
    });

    if (pulled) {
      changedHere = true;
      totals.updated += 1;
    }
  }

  for (const step of plan.restore) {
    let restored = false;

    await attempt(`"${step.name}" could not be restored`, async () => {
      restored = await customExerciseRepository.insertCustomExerciseFromCloud(
        db,
        buildLocalCustomExerciseFields(step.cloudRow)
      );
    });

    if (restored) {
      changedHere = true;
      totals.restored += 1;
    }
  }

  for (const step of plan.skip) {
    totals.skipped += 1;

    // Names never change, so the same collision comes back on every sync. It
    // is said once per launch.
    const skipKey = `${step.reason}:${nameKey(step.name)}`;

    if (!reportedSkips.has(skipKey)) {
      reportedSkips.add(skipKey);
      console.warn(
        step.reason === "name_taken"
          ? `Custom exercise sync: "${step.name}" is in the cloud, but this phone already has an exercise by that name.`
          : `Custom exercise sync: "${step.name}" differs from another custom exercise only in case, and the cloud keeps one of them.`
      );
    }
  }

  if (changedHere || totals.uploaded > 0) {
    notifyCustomExerciseChange({ type: "synced", ...totals });
  }

  return totals;
}

let customSyncInFlight = null;
let customSyncRerun = false;

/**
 * Your custom exercises both ways: up to the cloud, and back after a
 * reinstall. Never deletes anything, and never runs twice at once - a call
 * while one is running makes it go round once more and waits for it.
 */
export async function syncCustomExercisesWithCloud(db, { userId = null } = {}) {
  if (customSyncInFlight) {
    customSyncRerun = true;
    return customSyncInFlight;
  }

  customSyncInFlight = (async () => {
    const totals = { uploaded: 0, restored: 0, updated: 0, skipped: 0 };

    try {
      do {
        customSyncRerun = false;

        const viewerId = userId ?? (await getSignedInUserId());

        if (!viewerId) {
          break;
        }

        const result = await runCustomExerciseSync(db, viewerId);

        totals.uploaded += result.uploaded;
        totals.restored += result.restored;
        totals.updated += result.updated;
        totals.skipped += result.skipped;

        if (result.unavailable) {
          totals.unavailable = true;
          break;
        }
      } while (customSyncRerun);

      return totals;
    } finally {
      customSyncInFlight = null;
    }
  })();

  return customSyncInFlight;
}

/**
 * The same, through the one sync queue (src/Services/syncScheduler.js), for a
 * change that should reach the cloud without anybody waiting on it.
 */
export function syncCustomExercisesInBackground(db) {
  void enqueueSync(() => syncCustomExercisesWithCloud(db)).catch((error) => {
    console.warn("Custom exercise cloud sync failed:", error);
  });
}
