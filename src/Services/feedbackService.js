import { Platform } from "react-native";

import appConfig from "../../app.json";
import { supabase } from "../Database/supaBaseClient";

const FEEDBACK_TABLE = "Feedback";

function getNormalizedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getAppVersion() {
  const appVersion = getNormalizedString(appConfig?.expo?.version);
  const androidVersionCode =
    Platform.OS === "android" ? appConfig?.expo?.android?.versionCode : null;

  const parts = [
    appVersion ? `v${appVersion}` : null,
    androidVersionCode ? `build ${androidVersionCode}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : null;
}

export async function submitFeedback({ message, userId = null }) {
  const normalizedMessage = getNormalizedString(message);

  if (!normalizedMessage) {
    throw new Error("Feedback message is required.");
  }

  // device_info used to carry brand, model and OS version. None of it is
  // needed to read a message, and together they fingerprint the device.
  const payload = {
    message: normalizedMessage,
    app_version: getAppVersion(),
  };

  if (userId) {
    payload.user_id = userId;
  }

  const { error } = await supabase.from(FEEDBACK_TABLE).insert(payload);

  if (error) {
    throw error;
  }
}
