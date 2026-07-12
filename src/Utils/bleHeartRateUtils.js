function decodeBase64Bytes(value) {
  if (typeof globalThis.atob !== "function") {
    throw new Error("Base64 decoding is not available on this device.");
  }

  const decoded = globalThis.atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function parseHeartRateMeasurement(value) {
  if (!value) {
    return null;
  }

  const bytes = decodeBase64Bytes(value);

  if (bytes.length < 2) {
    return null;
  }

  const flags = bytes[0];
  const usesSixteenBitHeartRate = (flags & 0x01) !== 0;
  const hasEnergyExpended = (flags & 0x08) !== 0;
  const hasRrIntervals = (flags & 0x10) !== 0;
  let offset = 1;
  let bpm;

  if (usesSixteenBitHeartRate) {
    if (bytes.length < 3) {
      return null;
    }

    bpm = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  } else {
    bpm = bytes[offset];
    offset += 1;
  }

  if (hasEnergyExpended) {
    offset += 2;
  }

  const rrIntervalsMs = [];

  if (hasRrIntervals) {
    while (offset + 1 < bytes.length) {
      const rawInterval = bytes[offset] | (bytes[offset + 1] << 8);
      rrIntervalsMs.push((rawInterval * 1000) / 1024);
      offset += 2;
    }
  }

  if (!Number.isFinite(bpm) || bpm <= 0) {
    return null;
  }

  return { bpm, rrIntervalsMs };
}
