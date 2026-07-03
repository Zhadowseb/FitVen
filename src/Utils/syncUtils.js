let lastIssuedSyncVersion = 0;
const MAX_POSTGRES_INTEGER = 2147483647;
const LIKELY_MILLISECONDS_THRESHOLD = 100000000000;

export const SQLITE_UUID_SQL = `
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-' ||
  '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
`;

export function normalizeSyncId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeSyncVersion(value, fallbackValue = 0) {
  if (value === null || value === undefined || value === "") {
    return fallbackValue;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  const truncatedValue = Math.trunc(numericValue);

  if (truncatedValue <= 0) {
    return fallbackValue;
  }

  if (truncatedValue > MAX_POSTGRES_INTEGER) {
    if (truncatedValue >= LIKELY_MILLISECONDS_THRESHOLD) {
      const secondValue = Math.trunc(truncatedValue / 1000);

      return secondValue <= MAX_POSTGRES_INTEGER
        ? secondValue
        : fallbackValue;
    }

    return fallbackValue;
  }

  return truncatedValue;
}

export function createNextSyncVersion(previousVersion = null) {
  const previousNumericVersion = normalizeSyncVersion(previousVersion, 0);
  const currentVersion = Math.trunc(Date.now() / 1000);
  const nextVersion = Math.max(
    currentVersion,
    previousNumericVersion > 0 ? previousNumericVersion + 1 : 0,
    lastIssuedSyncVersion > 0 ? lastIssuedSyncVersion + 1 : 0
  );

  lastIssuedSyncVersion = nextVersion;
  return nextVersion;
}

export function normalizeDeletedAt(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}
