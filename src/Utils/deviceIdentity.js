import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_STORAGE_KEY = "fitapp.sync.device-id";

let cachedDeviceId = null;

function generateDeviceId() {
  const randomHex = (length) =>
    Array.from({ length }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");

  return [
    randomHex(8),
    randomHex(4),
    `4${randomHex(3)}`,
    `${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}`,
    randomHex(12),
  ].join("-");
}

export async function getStableSyncDeviceId() {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (storedDeviceId) {
    cachedDeviceId = storedDeviceId;
    return cachedDeviceId;
  }

  cachedDeviceId = generateDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, cachedDeviceId);
  return cachedDeviceId;
}
