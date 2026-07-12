import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, State } from "react-native-ble-plx";
import { parseHeartRateMeasurement } from "../Utils/bleHeartRateUtils";

export const HEART_RATE_SERVICE_UUID =
  "0000180d-0000-1000-8000-00805f9b34fb";
export const HEART_RATE_MEASUREMENT_UUID =
  "00002a37-0000-1000-8000-00805f9b34fb";

const SAVED_DEVICE_KEY = "@fitven/heart-rate-device";
const BLUETOOTH_READY_TIMEOUT_MS = 10000;

let manager = null;
let activeScanStop = null;

function getManager() {
  if (!manager) {
    manager = new BleManager();
  }

  return manager;
}

function getDeviceName(device) {
  return device?.localName || device?.name || "Heart rate monitor";
}

export function normalizeHeartRateDevice(device) {
  if (!device?.id) {
    return null;
  }

  return {
    id: device.id,
    name: getDeviceName(device),
    rssi: Number.isFinite(device.rssi) ? device.rssi : null,
  };
}

export async function requestHeartRatePermissions() {
  if (Platform.OS !== "android") {
    return true;
  }

  const apiLevel = Number(Platform.Version);

  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);

    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function waitForBluetoothReady() {
  const bleManager = getManager();
  const currentState = await bleManager.state();

  if (currentState === State.PoweredOn) {
    return;
  }

  if (currentState === State.Unauthorized) {
    throw new Error("Bluetooth permission is not available for FitVen.");
  }

  if (currentState === State.Unsupported) {
    throw new Error("Bluetooth Low Energy is not supported on this device.");
  }

  await new Promise((resolve, reject) => {
    let stateSubscription;
    const timeout = setTimeout(() => {
      stateSubscription?.remove();
      reject(new Error("Turn on Bluetooth to connect your heart rate monitor."));
    }, BLUETOOTH_READY_TIMEOUT_MS);

    stateSubscription = bleManager.onStateChange((nextState) => {
      if (nextState === State.PoweredOn) {
        clearTimeout(timeout);
        stateSubscription?.remove();
        resolve();
      } else if (nextState === State.Unauthorized) {
        clearTimeout(timeout);
        stateSubscription?.remove();
        reject(new Error("Bluetooth permission is not available for FitVen."));
      } else if (nextState === State.Unsupported) {
        clearTimeout(timeout);
        stateSubscription?.remove();
        reject(
          new Error("Bluetooth Low Energy is not supported on this device.")
        );
      }
    }, true);
  });
}

export async function scanForHeartRateDevices({ onDevice, onError }) {
  await waitForBluetoothReady();
  stopHeartRateScan();

  const bleManager = getManager();
  let stopped = false;

  bleManager.startDeviceScan(
    [HEART_RATE_SERVICE_UUID],
    { allowDuplicates: true },
    (error, device) => {
      if (stopped) {
        return;
      }

      if (error) {
        stopped = true;
        activeScanStop = null;
        bleManager.stopDeviceScan();
        onError?.(error);
        return;
      }

      const normalizedDevice = normalizeHeartRateDevice(device);
      if (normalizedDevice) {
        onDevice?.(normalizedDevice);
      }
    }
  );

  const stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    bleManager.stopDeviceScan();
    if (activeScanStop === stop) {
      activeScanStop = null;
    }
  };

  activeScanStop = stop;
  return stop;
}

export function stopHeartRateScan() {
  activeScanStop?.();
}

export async function connectToHeartRateDevice(
  savedDevice,
  { onMeasurement, onDisconnected }
) {
  if (!savedDevice?.id) {
    throw new Error("Choose a heart rate monitor first.");
  }

  await waitForBluetoothReady();
  stopHeartRateScan();

  const bleManager = getManager();
  let stopped = false;
  let measurementSubscription = null;
  let disconnectSubscription = null;
  let device = null;

  const notifyDisconnected = (error) => {
    if (stopped) {
      return;
    }

    stopped = true;
    measurementSubscription?.remove();
    disconnectSubscription?.remove();
    onDisconnected?.(error ?? null);
  };

  try {
    device = await bleManager.connectToDevice(savedDevice.id, {
      timeout: 12000,
    });

    await device.discoverAllServicesAndCharacteristics();

    disconnectSubscription = bleManager.onDeviceDisconnected(
      device.id,
      (error) => notifyDisconnected(error)
    );

    measurementSubscription = device.monitorCharacteristicForService(
      HEART_RATE_SERVICE_UUID,
      HEART_RATE_MEASUREMENT_UUID,
      (error, characteristic) => {
        if (stopped) {
          return;
        }

        if (error) {
          notifyDisconnected(error);
          bleManager.cancelDeviceConnection(device.id).catch(() => {});
          return;
        }

        const measurement = parseHeartRateMeasurement(characteristic?.value);
        if (measurement) {
          onMeasurement?.({
            ...measurement,
            capturedAt: Date.now(),
          });
        }
      }
    );
  } catch (error) {
    measurementSubscription?.remove();
    disconnectSubscription?.remove();

    if (device) {
      try {
        const isConnected = await bleManager.isDeviceConnected(device.id);
        if (isConnected) {
          await bleManager.cancelDeviceConnection(device.id);
        }
      } catch {
        // Preserve the original connection/setup error.
      }
    }

    throw error;
  }

  const normalizedDevice = {
    ...normalizeHeartRateDevice(device),
    name: savedDevice.name || getDeviceName(device),
  };

  return {
    device: normalizedDevice,
    disconnect: async () => {
      if (stopped) {
        return;
      }

      stopped = true;
      measurementSubscription?.remove();
      disconnectSubscription?.remove();

      try {
        const isConnected = await bleManager.isDeviceConnected(device.id);
        if (isConnected) {
          await bleManager.cancelDeviceConnection(device.id);
        }
      } catch {
        // The device may already have disconnected while cleanup is running.
      }
    },
  };
}

export async function getSavedHeartRateDevice() {
  const value = await AsyncStorage.getItem(SAVED_DEVICE_KEY);

  if (!value) {
    return null;
  }

  try {
    const device = JSON.parse(value);
    return device?.id ? device : null;
  } catch {
    return null;
  }
}

export async function saveHeartRateDevice(device) {
  const normalizedDevice = normalizeHeartRateDevice(device) ?? device;

  if (!normalizedDevice?.id) {
    throw new Error("The heart rate monitor could not be saved.");
  }

  await AsyncStorage.setItem(
    SAVED_DEVICE_KEY,
    JSON.stringify({
      id: normalizedDevice.id,
      name: normalizedDevice.name,
    })
  );
}

export async function forgetHeartRateDevice() {
  await AsyncStorage.removeItem(SAVED_DEVICE_KEY);
}
