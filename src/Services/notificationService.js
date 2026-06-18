import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { supabase } from "../Database/supaBaseClient";

const PUSH_TOKENS_TABLE = "push_tokens";
const NOTIFICATION_PREFERENCES_TABLE = "notification_preferences";
const WORKOUT_START_NOTIFICATION_SOURCES_TABLE =
  "workout_start_notification_sources";
const NOTIFICATION_INBOX_TABLE = "notification_inbox";
const AVATAR_BUCKET = "avatars";
const ACTIVITY_NOTIFICATION_CHANNEL_ID = "activity";
const MANAGE_PUSH_TOKEN_FUNCTION = "manage-push-token";
const SEND_WORKOUT_STARTED_NOTIFICATION_FUNCTION =
  "send-workout-started-notification";
const NOTIFICATION_SETUP_MESSAGE =
  "Push notifications are not set up in Supabase yet. Run docs/supabase-push-notifications.sql in the Supabase SQL editor first.";
const NOTIFICATION_HISTORY_SETUP_MESSAGE =
  "Notification history is not set up in Supabase yet. Run docs/supabase-notification-history.sql in the Supabase SQL editor first.";
const NOTIFICATION_HISTORY_SELECT_FIELDS = `
  id,
  event_type,
  title,
  body,
  data,
  read_at,
  created_at,
  actor:profiles!notification_inbox_actor_id_fkey(
    id,
    username,
    display_name,
    avatar_path,
    updated_at
  )
`;

export const WORKOUT_START_NOTIFICATION_MODES = {
  NONE: "none",
  FOLLOWING: "following",
  CUSTOM: "custom",
};

export const DEFAULT_WORKOUT_START_NOTIFICATION_MODE =
  WORKOUT_START_NOTIFICATION_MODES.FOLLOWING;

const WORKOUT_START_NOTIFICATION_MODE_VALUES = new Set(
  Object.values(WORKOUT_START_NOTIFICATION_MODES)
);

const IOS_GRANTED_STATUSES = new Set(
  [
    Notifications.IosAuthorizationStatus?.AUTHORIZED,
    Notifications.IosAuthorizationStatus?.PROVISIONAL,
    Notifications.IosAuthorizationStatus?.EPHEMERAL,
  ].filter((status) => status !== undefined && status !== null)
);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

function isPermissionGranted(permissionResponse) {
  if (permissionResponse?.status === "granted") {
    return true;
  }

  const iosStatus = permissionResponse?.ios?.status;
  return IOS_GRANTED_STATUSES.has(iosStatus);
}

function isPushTokenSetupError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    message.includes(PUSH_TOKENS_TABLE) ||
    message.includes(NOTIFICATION_PREFERENCES_TABLE) ||
    message.includes(WORKOUT_START_NOTIFICATION_SOURCES_TABLE) ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function normalizeNotificationError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  if (message.includes(NOTIFICATION_INBOX_TABLE)) {
    return new Error(NOTIFICATION_HISTORY_SETUP_MESSAGE);
  }

  if (isPushTokenSetupError(error)) {
    return new Error(NOTIFICATION_SETUP_MESSAGE);
  }

  return error;
}

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeFunctionError(error, functionName) {
  const message = String(error?.message ?? error ?? "");

  if (
    message.toLowerCase().includes("function") &&
    message.toLowerCase().includes("not found")
  ) {
    return new Error(
      `Supabase Edge Function "${functionName}" is not deployed yet.`
    );
  }

  return error;
}

function buildAvatarPublicUrl(avatarPath, updatedAt) {
  if (!avatarPath) {
    return null;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const publicUrl = data?.publicUrl;

  return publicUrl && updatedAt
    ? `${publicUrl}?t=${encodeURIComponent(updatedAt)}`
    : publicUrl ?? null;
}

function mapNotificationHistoryRow(row) {
  const actor = Array.isArray(row?.actor) ? row.actor[0] : row?.actor;
  const data =
    row?.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? row.data
      : {};

  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    data,
    readAt: row.read_at ?? null,
    createdAt: row.created_at ?? null,
    actor: actor
      ? {
          id: actor.id,
          username: actor.username ?? null,
          displayName:
            actor.display_name ?? actor.username ?? "FitVen athlete",
          avatarUrl: buildAvatarPublicUrl(actor.avatar_path, actor.updated_at),
        }
      : null,
  };
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    ACTIVITY_NOTIFICATION_CHANNEL_ID,
    {
      name: "Activity",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#36D399",
    }
  );
}

async function requestNotificationPermission() {
  const existingPermission = await Notifications.getPermissionsAsync();

  if (isPermissionGranted(existingPermission)) {
    return existingPermission;
  }

  return Notifications.requestPermissionsAsync();
}

async function getNotificationPermission() {
  if (Platform.OS === "web") {
    return null;
  }

  return Notifications.getPermissionsAsync();
}

async function getExpoPushToken(devicePushToken = null) {
  const projectId = getProjectId();

  if (!projectId) {
    throw new Error("Expo projectId is missing from app config.");
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({
    projectId,
    ...(devicePushToken ? { devicePushToken } : {}),
  });

  return tokenResult.data;
}

async function getExpoPushTokenIfPermissionGranted() {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const permission = await getNotificationPermission();

    if (!isPermissionGranted(permission)) {
      return null;
    }

    return await getExpoPushToken();
  } catch {
    return null;
  }
}

async function hasActiveSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return Boolean(data?.session?.access_token);
}

async function fetchUserPushTokens(userId) {
  const { data, error } = await supabase
    .from(PUSH_TOKENS_TABLE)
    .select("id, enabled, platform, last_seen_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    throw normalizeNotificationError(error);
  }

  return data ?? [];
}

async function fetchNotificationPreference(userId) {
  const { data, error } = await supabase
    .from(NOTIFICATION_PREFERENCES_TABLE)
    .select("workout_start_mode")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw normalizeNotificationError(error);
  }

  return data ?? null;
}

async function fetchWorkoutStartNotificationSourceIds(userId) {
  const { data, error } = await supabase
    .from(WORKOUT_START_NOTIFICATION_SOURCES_TABLE)
    .select("source_user_id")
    .eq("user_id", userId);

  if (error) {
    throw normalizeNotificationError(error);
  }

  return (data ?? []).map((row) => row.source_user_id).filter(Boolean);
}

function normalizeWorkoutStartNotificationMode(mode) {
  return WORKOUT_START_NOTIFICATION_MODE_VALUES.has(mode)
    ? mode
    : DEFAULT_WORKOUT_START_NOTIFICATION_MODE;
}

function mapPushNotificationSettings({
  permission,
  pushTokens,
  preference,
  sourceUserIds,
}) {
  const supported = Platform.OS !== "web";
  const permissionGranted = supported ? isPermissionGranted(permission) : false;
  const enabledDeviceCount = pushTokens.filter((pushToken) =>
    Boolean(pushToken.enabled)
  ).length;
  const workoutStartMode = normalizeWorkoutStartNotificationMode(
    preference?.workout_start_mode
  );

  return {
    supported,
    permissionStatus: supported ? permission?.status ?? "unknown" : "web",
    permissionGranted,
    enabled:
      supported &&
      permissionGranted &&
      enabledDeviceCount > 0 &&
      workoutStartMode !== WORKOUT_START_NOTIFICATION_MODES.NONE,
    registeredDeviceCount: pushTokens.length,
    enabledDeviceCount,
    workoutStartMode,
    selectedSourceIds: sourceUserIds,
  };
}

export function addPushTokenListener(listener) {
  if (Platform.OS === "web") {
    return null;
  }

  return Notifications.addPushTokenListener(listener);
}

export function addNotificationReceivedListener(listener) {
  if (Platform.OS === "web") {
    return null;
  }

  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(listener) {
  if (Platform.OS === "web") {
    return null;
  }

  return Notifications.addNotificationResponseReceivedListener(listener);
}

export function getLastNotificationResponse() {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    return Notifications.getLastNotificationResponse();
  } catch {
    return null;
  }
}

export function clearLastNotificationResponse() {
  if (Platform.OS === "web") {
    return;
  }

  try {
    Notifications.clearLastNotificationResponse?.();
  } catch {
    // Ignore unsupported native notification response cleanup.
  }
}

export async function registerPushTokenForUser({
  user,
  devicePushToken = null,
} = {}) {
  if (!user?.id) {
    return { skipped: true, reason: "signed_out" };
  }

  if (Platform.OS === "web") {
    return { skipped: true, reason: "unsupported_platform" };
  }

  await ensureAndroidNotificationChannel();

  const permission = await requestNotificationPermission();

  if (!isPermissionGranted(permission)) {
    return { skipped: true, reason: "permission_denied" };
  }

  const expoPushToken = await getExpoPushToken(devicePushToken);
  const { data, error } = await supabase.functions.invoke(
    MANAGE_PUSH_TOKEN_FUNCTION,
    {
      body: {
        action: "register",
        expoPushToken,
        platform: Platform.OS,
      },
    }
  );

  if (error) {
    throw normalizeFunctionError(error, MANAGE_PUSH_TOKEN_FUNCTION);
  }

  return {
    skipped: false,
    tokenId: data?.tokenId ?? null,
    expoPushToken: data?.expoPushToken ?? expoPushToken,
  };
}

export async function disableCurrentPushTokenForUser({ user } = {}) {
  if (!user?.id) {
    return { skipped: true, reason: "signed_out" };
  }

  if (Platform.OS === "web") {
    return { skipped: true, reason: "unsupported_platform" };
  }

  const permission = await getNotificationPermission();

  if (!isPermissionGranted(permission)) {
    return { skipped: true, reason: "permission_denied" };
  }

  const expoPushToken = await getExpoPushToken();
  const { data, error } = await supabase.functions.invoke(
    MANAGE_PUSH_TOKEN_FUNCTION,
    {
      body: {
        action: "disable",
        expoPushToken,
      },
    }
  );

  if (error) {
    throw normalizeFunctionError(error, MANAGE_PUSH_TOKEN_FUNCTION);
  }

  return {
    skipped: false,
    expoPushToken: data?.expoPushToken ?? expoPushToken,
  };
}

export async function notifyWorkoutStarted({ workout, startedAt } = {}) {
  if (!workout) {
    return { skipped: true, reason: "missing_workout" };
  }

  const hasSession = await hasActiveSupabaseSession();

  if (!hasSession) {
    return { skipped: true, reason: "signed_out" };
  }

  const syncId = normalizeOptionalText(workout.sync_id);
  const cloudWorkoutId =
    workout.cloud_workout_type_instance_id ?? workout.cloud_id ?? null;
  const localWorkoutId =
    workout.workout_id ??
    workout.local_workout_type_instance_id ??
    workout.id ??
    null;
  const workoutIdentity = syncId ?? cloudWorkoutId ?? localWorkoutId;

  if (!workoutIdentity) {
    return { skipped: true, reason: "missing_workout_identity" };
  }

  const record = {
    id: cloudWorkoutId ?? workoutIdentity,
    sync_id: syncId,
    local_workout_type_instance_id: localWorkoutId,
    workout_type: workout.workout_type ?? null,
    label: workout.label ?? null,
    date: workout.date ?? null,
    done: false,
    is_active: true,
    is_deleting: false,
    deleted_at: null,
    original_start_time: workout.original_start_time ?? startedAt ?? null,
    timer_start: workout.timer_start ?? startedAt ?? null,
    elapsed_time: workout.elapsed_time ?? null,
  };
  const actorExpoPushToken = await getExpoPushTokenIfPermissionGranted();

  const { data, error } = await supabase.functions.invoke(
    SEND_WORKOUT_STARTED_NOTIFICATION_FUNCTION,
    {
      body: {
        source: "client",
        force: true,
        record,
        started_at: startedAt ?? null,
        actor_expo_push_token: actorExpoPushToken,
      },
    }
  );

  if (error) {
    throw normalizeFunctionError(
      error,
      SEND_WORKOUT_STARTED_NOTIFICATION_FUNCTION
    );
  }

  return data ?? { sent: false };
}

export async function getPushNotificationSettings({ user } = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to load notification settings.");
  }

  const [permission, pushTokens, preference, sourceUserIds] = await Promise.all([
    getNotificationPermission(),
    fetchUserPushTokens(user.id),
    fetchNotificationPreference(user.id),
    fetchWorkoutStartNotificationSourceIds(user.id),
  ]);

  return mapPushNotificationSettings({
    permission,
    pushTokens,
    preference,
    sourceUserIds,
  });
}

export async function setPushNotificationsEnabled({
  user,
  enabled,
} = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update notification settings.");
  }

  return setWorkoutStartNotificationMode({
    user,
    mode: enabled
      ? WORKOUT_START_NOTIFICATION_MODES.FOLLOWING
      : WORKOUT_START_NOTIFICATION_MODES.NONE,
  });
}

export async function setWorkoutStartNotificationMode({
  user,
  mode,
} = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update notification settings.");
  }

  const nextMode = normalizeWorkoutStartNotificationMode(mode);
  const now = new Date().toISOString();
  const { error } = await supabase.from(NOTIFICATION_PREFERENCES_TABLE).upsert(
    {
      user_id: user.id,
      workout_start_mode: nextMode,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw normalizeNotificationError(error);
  }

  if (nextMode !== WORKOUT_START_NOTIFICATION_MODES.NONE) {
    const registrationResult = await registerPushTokenForUser({ user });

    if (registrationResult?.skipped) {
      return {
        ...(await getPushNotificationSettings({ user })),
        skipped: true,
        reason: registrationResult.reason,
      };
    }
  }

  return getPushNotificationSettings({ user });
}

export async function setWorkoutStartNotificationSources({
  user,
  sourceUserIds,
} = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to update notification settings.");
  }

  const uniqueSourceUserIds = [...new Set(sourceUserIds ?? [])].filter(
    (sourceUserId) => sourceUserId && sourceUserId !== user.id
  );
  const { error: deleteError } = await supabase
    .from(WORKOUT_START_NOTIFICATION_SOURCES_TABLE)
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    throw normalizeNotificationError(deleteError);
  }

  if (uniqueSourceUserIds.length) {
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from(WORKOUT_START_NOTIFICATION_SOURCES_TABLE)
      .insert(
        uniqueSourceUserIds.map((sourceUserId) => ({
          user_id: user.id,
          source_user_id: sourceUserId,
          created_at: now,
        }))
      );

    if (insertError) {
      throw normalizeNotificationError(insertError);
    }
  }

  return getPushNotificationSettings({ user });
}

export async function getNotificationHistory({ user, limit = 50 } = {}) {
  if (!user?.id) {
    throw new Error("You need to be signed in to load notifications.");
  }

  const normalizedLimit = Math.min(Math.max(Math.trunc(Number(limit)) || 50, 1), 100);
  const { data, error } = await supabase
    .from(NOTIFICATION_INBOX_TABLE)
    .select(NOTIFICATION_HISTORY_SELECT_FIELDS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (error) {
    throw normalizeNotificationError(error);
  }

  return (data ?? []).map(mapNotificationHistoryRow);
}

export async function getUnreadNotificationCount({ user } = {}) {
  if (!user?.id) {
    return 0;
  }

  const { count, error } = await supabase
    .from(NOTIFICATION_INBOX_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw normalizeNotificationError(error);
  }

  return count ?? 0;
}

export async function markAllNotificationHistoryRead({ user } = {}) {
  if (!user?.id) {
    return;
  }

  const { error } = await supabase
    .from(NOTIFICATION_INBOX_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    throw normalizeNotificationError(error);
  }
}
