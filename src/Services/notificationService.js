import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { supabase } from "../Database/supaBaseClient";

const PUSH_TOKENS_TABLE = "push_tokens";
const ACTIVITY_NOTIFICATION_CHANNEL_ID = "activity";
const NOTIFICATION_SETUP_MESSAGE =
  "Push notifications are not set up in Supabase yet. Run docs/supabase-push-notifications.sql in the Supabase SQL editor first.";

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
