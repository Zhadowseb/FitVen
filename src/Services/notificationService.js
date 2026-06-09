import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { supabase } from "../Database/supaBaseClient";

const PUSH_TOKENS_TABLE = "push_tokens";
const NOTIFICATION_PREFERENCES_TABLE = "notification_preferences";
const WORKOUT_START_NOTIFICATION_SOURCES_TABLE =
  "workout_start_notification_sources";
const ACTIVITY_NOTIFICATION_CHANNEL_ID = "activity";
const NOTIFICATION_SETUP_MESSAGE =
  "Push notifications are not set up in Supabase yet. Run docs/supabase-push-notifications.sql in the Supabase SQL editor first.";

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
  if (isPushTokenSetupError(error)) {
    return new Error(NOTIFICATION_SETUP_MESSAGE);
  }

  return error;
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
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(PUSH_TOKENS_TABLE)
    .upsert(
      {
        user_id: user.id,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        enabled: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,expo_push_token" }
    )
    .select("id, expo_push_token")
    .single();

  if (error) {
    throw normalizeNotificationError(error);
  }

  return {
    skipped: false,
    tokenId: data?.id ?? null,
    expoPushToken: data?.expo_push_token ?? expoPushToken,
  };
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
