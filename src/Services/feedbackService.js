import Constants from "expo-constants";

import appConfig from "../../app.json";
import { supabase } from "../Database/supaBaseClient";

const FEEDBACK_TABLE = "Feedback";

// What the dev dashboard sorts on. The column has the same four and a check
// constraint behind them, so a fifth one added on one side only fails the
// insert - in production, on the screen somebody reaches when something has
// already gone wrong for them.
export const FEEDBACK_KINDS = ["bug", "idea", "praise", "other"];

function getNormalizedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

// Fra binaeren, ikke fra app.json. EAS taeller build-numret op paa sin side
// (appVersionSource: "remote"), saa app.json har ikke laengere et - og dengang
// det havde, var det holdt op med at foelge med: en rapport fra en telefon med
// build 24 sagde "build 18". nativeBuildVersion er det tal, der faktisk staar
// i den installerede app. I en dev-klient uden native build er de to null, og
// saa er app.json's version stadig bedre end ingenting.
function getAppVersion() {
  const appVersion = getNormalizedString(
    Constants.nativeApplicationVersion ?? appConfig?.expo?.version
  );
  const buildVersion = getNormalizedString(Constants.nativeBuildVersion);

  const parts = [
    appVersion ? `v${appVersion}` : null,
    buildVersion ? `build ${buildVersion}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : null;
}

export async function submitFeedback({ message, userId = null, kind = "other" }) {
  const normalizedMessage = getNormalizedString(message);

  if (!normalizedMessage) {
    throw new Error("Feedback message is required.");
  }

  // device_info used to carry brand, model and OS version. None of it is
  // needed to read a message, and together they fingerprint the device. The
  // dev dashboard has columns for the OS and the model, and they stay empty
  // for the same reason: the published privacy policy does not list them.
  const payload = {
    message: normalizedMessage,
    app_version: getAppVersion(),
    kind: FEEDBACK_KINDS.includes(kind) ? kind : "other",
  };

  if (userId) {
    payload.user_id = userId;
  }

  const { error } = await supabase.from(FEEDBACK_TABLE).insert(payload);

  if (error) {
    throw error;
  }
}
