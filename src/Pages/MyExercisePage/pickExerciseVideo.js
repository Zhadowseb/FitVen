import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { formatNumber, t } from "@localization";
import { VIDEO_MAX_BYTES, VIDEO_MAX_DURATION_MS } from "@utils/customExercises";

export const VIDEO_MAX_SECONDS = Math.round(VIDEO_MAX_DURATION_MS / 1000);

// The camera's limit is whole seconds, and a clip that stops right on it can
// come back a few frames over. Anything within this is taken as the limit
// itself, so recording the full 20 seconds is never "too long".
const DURATION_GRACE_MS = 500;
const BYTES_PER_MB = 1024 * 1024;

function positiveNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * One clip of the exercise, from the camera or the library, checked against
 * the limits before anything is uploaded. The picker options are the gym
 * leaderboard's, with this exercise's limit: 720p on iOS, no editing.
 *
 * Resolves with what uploadExerciseVideo takes - { uri, durationMs, fileSize,
 * mimeType } - or null when the user backed out. Anything else is thrown with
 * a message the screen can show as it is.
 */
export default async function pickExerciseVideo({ fromCamera = false } = {}) {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      fromCamera
        ? t("myExercise.video.cameraPermission")
        : t("myExercise.video.libraryPermission")
    );
  }

  const options = {
    mediaTypes: ["videos"],
    videoMaxDuration: VIDEO_MAX_SECONDS,
    allowsEditing: false,
    quality: 0.8,
    ...(Platform.OS === "ios"
      ? { videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720 }
      : {}),
  };
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];

  if (!asset?.uri) {
    return null;
  }

  // expo-image-picker reports the duration in milliseconds on both platforms
  // (see gymService.attachLiftVideo). Either can be missing; then the service
  // is the one that checks.
  const durationMs = positiveNumber(asset.duration);
  const fileSize = positiveNumber(asset.fileSize);

  // The library does not hold a clip to videoMaxDuration - only the camera
  // does - so a long one is caught here, before it is uploaded.
  if (durationMs !== null && durationMs > VIDEO_MAX_DURATION_MS + DURATION_GRACE_MS) {
    throw new Error(
      t("myExercise.video.tooLong", {
        seconds: formatNumber(Math.round(durationMs / 1000)),
        max: formatNumber(VIDEO_MAX_SECONDS),
      })
    );
  }

  if (fileSize !== null && fileSize > VIDEO_MAX_BYTES) {
    throw new Error(
      t("myExercise.video.tooLarge", {
        size: formatNumber(Math.ceil(fileSize / BYTES_PER_MB)),
        max: formatNumber(Math.round(VIDEO_MAX_BYTES / BYTES_PER_MB)),
      })
    );
  }

  return {
    uri: asset.uri,
    // Within the grace, it is the limit - so a check on the server against
    // VIDEO_MAX_DURATION_MS agrees with the one here.
    durationMs: durationMs === null ? null : Math.min(durationMs, VIDEO_MAX_DURATION_MS),
    fileSize,
    mimeType: asset.mimeType ?? null,
  };
}
