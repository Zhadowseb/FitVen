import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { addDays, datesBetween } from "../Utils/dailySteps";

// The steps of each day, read from the phone's own health app: Apple Health on
// an iPhone, Health Connect on Android. Those are the numbers FitVen shows -
// the phone counts all day, with the watch and with the phone in a pocket, and
// de-duplicates between its sources. FitVen's own Walk workouts and strength
// workouts are put on top of them by Services/stepsService.js.
//
// Both libraries are native and a development client built before they were
// declared does not have them, so they are required here, not imported: a
// missing module is the same as a phone with no health app, and the card says
// so instead of the app not opening. It is also why the services still load in
// the Node tests.
//
// Statuses:
//   unavailable   no health app on this phone, or this build has no module
//   undetermined  never asked
//   granted       asked and allowed (Android) / asked (iOS, see below)
//   denied        asked and not allowed (Android)
//
// iOS never says whether a read permission was refused - that is Apple's
// privacy rule, not a gap here - so after the question there is only "asked",
// reported as granted, and a refusal shows as a day with no steps.

const HEALTHKIT_STEPS = "HKQuantityTypeIdentifierStepCount";
const ASKED_STORAGE_KEY = "fitven.steps.healthAsked";

let healthKit = null;
let healthConnect = null;
let loadFailed = { ios: false, android: false };

function getHealthKit() {
  if (healthKit || loadFailed.ios) {
    return healthKit;
  }

  try {
    healthKit = require("@kingstinct/react-native-healthkit");
  } catch (error) {
    loadFailed.ios = true;
    console.warn("Apple Health is not in this build:", error);
  }

  return healthKit;
}

function getHealthConnect() {
  if (healthConnect || loadFailed.android) {
    return healthConnect;
  }

  try {
    healthConnect = require("react-native-health-connect");
  } catch (error) {
    loadFailed.android = true;
    console.warn("Health Connect is not in this build:", error);
  }

  return healthConnect;
}

async function readAsked() {
  try {
    return (await AsyncStorage.getItem(ASKED_STORAGE_KEY)) === "1";
  } catch (error) {
    return false;
  }
}

async function writeAsked() {
  try {
    await AsyncStorage.setItem(ASKED_STORAGE_KEY, "1");
  } catch (error) {
    console.warn("Could not remember that the health app was asked:", error);
  }
}

// Health Connect has to be initialised once before anything is asked of it.
let healthConnectReady = null;

async function prepareHealthConnect() {
  const connect = getHealthConnect();

  if (!connect) {
    return null;
  }

  if (!healthConnectReady) {
    healthConnectReady = (async () => {
      try {
        const status = await connect.getSdkStatus();

        if (status !== connect.SdkAvailabilityStatus.SDK_AVAILABLE) {
          return false;
        }

        return Boolean(await connect.initialize());
      } catch (error) {
        console.warn("Could not start Health Connect:", error);
        return false;
      }
    })();
  }

  return (await healthConnectReady) ? connect : null;
}

const STEPS_READ_PERMISSION = { accessType: "read", recordType: "Steps" };

/* ---------------------------------------------------------------- status -- */

export async function getHealthStepsStatus() {
  try {
    if (Platform.OS === "ios") {
      const kit = getHealthKit();

      if (!kit || !(await kit.isHealthDataAvailableAsync())) {
        return "unavailable";
      }

      const request = await kit.getRequestStatusForAuthorization({
        toRead: [HEALTHKIT_STEPS],
        toShare: [],
      });

      // shouldRequest = 1, unnecessary = 2 (asked already)
      return Number(request) === 1 ? "undetermined" : "granted";
    }

    if (Platform.OS === "android") {
      const connect = await prepareHealthConnect();

      if (!connect) {
        return "unavailable";
      }

      const granted = await connect.getGrantedPermissions();

      if (granted.some((permission) => permission.recordType === "Steps")) {
        return "granted";
      }

      return (await readAsked()) ? "denied" : "undetermined";
    }
  } catch (error) {
    console.warn("Could not read the health app's status:", error);
  }

  return "unavailable";
}

/** Asks the phone to let FitVen read steps, then says how it went. */
export async function requestHealthStepsAccess() {
  try {
    if (Platform.OS === "ios") {
      const kit = getHealthKit();

      if (kit) {
        await kit.requestAuthorization({ toRead: [HEALTHKIT_STEPS], toShare: [] });
      }
    } else if (Platform.OS === "android") {
      const connect = await prepareHealthConnect();

      if (connect) {
        await connect.requestPermission([STEPS_READ_PERMISSION]);
        await writeAsked();
      }
    }
  } catch (error) {
    console.warn("Could not ask for the steps:", error);
  }

  return getHealthStepsStatus();
}

/** Where the person can change the answer: Health Connect, or the Health app. */
export async function openHealthSettings() {
  try {
    if (Platform.OS === "android") {
      const connect = await prepareHealthConnect();

      if (connect) {
        connect.openHealthConnectSettings();
        return;
      }
    }

    await Linking.openURL(Platform.OS === "ios" ? "x-apple-health://" : "market://details?id=com.google.android.apps.healthdata");
  } catch (error) {
    console.warn("Could not open the health settings:", error);
  }
}

/* ----------------------------------------------------------------- steps -- */

// "2026-10-05" at the phone's own midnight.
const localMidnight = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);

  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const isoOfLocal = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * The phone's step count for each day from `fromIso` to `toIso` (inclusive),
 * as { "2026-10-05": 6482, ... }. A day the phone has nothing for is 0 on iOS,
 * which cannot tell "no steps" from "not allowed". Resolves to null when there
 * is no health app to ask, so the caller can tell that from a quiet week.
 */
export async function readDailySteps(fromIso, toIso) {
  const dates = datesBetween(fromIso, toIso);

  // HealthKit ends the app if it is asked for something it was never given
  // leave to read, so nothing is read before the question has been asked.
  if ((await getHealthStepsStatus()) !== "granted") {
    return null;
  }

  try {
    if (Platform.OS === "ios") {
      const kit = getHealthKit();

      if (!kit) {
        return null;
      }

      const rows = await kit.queryStatisticsCollectionForQuantity(
        HEALTHKIT_STEPS,
        ["cumulativeSum"],
        localMidnight(fromIso),
        { day: 1 },
        {
          unit: "count",
          filter: {
            date: {
              startDate: localMidnight(fromIso),
              endDate: localMidnight(addDays(toIso, 1)),
            },
          },
        }
      );
      const byDate = {};

      for (const row of rows ?? []) {
        if (row.startDate) {
          byDate[isoOfLocal(new Date(row.startDate))] = Math.round(row.sumQuantity?.quantity ?? 0);
        }
      }

      return Object.fromEntries(dates.map((date) => [date, byDate[date] ?? 0]));
    }

    if (Platform.OS === "android") {
      const connect = await prepareHealthConnect();

      if (!connect) {
        return null;
      }

      const groups = await connect.aggregateGroupByPeriod({
        recordType: "Steps",
        timeRangeFilter: {
          operator: "between",
          startTime: localMidnight(fromIso).toISOString(),
          endTime: localMidnight(addDays(toIso, 1)).toISOString(),
        },
        timeRangeSlicer: { period: "DAYS", length: 1 },
      });

      // Group n is day n of the range, whatever the zone's clock did that day.
      return Object.fromEntries(
        dates.map((date, index) => [date, Math.round(Number(groups?.[index]?.result?.COUNT_TOTAL) || 0)])
      );
    }
  } catch (error) {
    console.warn("Could not read the steps:", error);
  }

  return null;
}
