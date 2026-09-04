export function parseCustomDate(dateString) {
  const [day, month, year] = dateString.split(".").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function isValidDateParts({ day, month, year }) {
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year)
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function normalizeLocalDateString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const localMatch = trimmedValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (localMatch) {
    const [, day, month, year] = localMatch;
    const dateParts = {
      day: Number(day),
      month: Number(month),
      year: Number(year),
    };

    if (!isValidDateParts(dateParts)) {
      return null;
    }

    return `${day}.${month}.${year}`;
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!isoMatch) {
    return null;
  }

  const [, year, month, day] = isoMatch;
  const dateParts = {
    day: Number(day),
    month: Number(month),
    year: Number(year),
  };

  if (!isValidDateParts(dateParts)) {
    return null;
  }

  return `${day}.${month}.${year}`;
}

export function normalizeIsoDateString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const dateParts = {
      day: Number(day),
      month: Number(month),
      year: Number(year),
    };

    if (!isValidDateParts(dateParts)) {
      return null;
    }

    return `${year}-${month}-${day}`;
  }

  const localMatch = trimmedValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!localMatch) {
    return null;
  }

  const [, day, month, year] = localMatch;
  const dateParts = {
    day: Number(day),
    month: Number(month),
    year: Number(year),
  };

  if (!isValidDateParts(dateParts)) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function getTodaysDate() {
  const today = new Date();
  return formatDate(today);
}

export function isoDateToLocalDate(value) {
  const normalizedDate = normalizeIsoDateString(value);

  if (!normalizedDate) {
    return null;
  }

  const [year, month, day] = normalizedDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateToIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function calculateAgeFromBirthDate(value, referenceDate = new Date()) {
  const birthDate = isoDateToLocalDate(value);

  if (
    !birthDate ||
    !(referenceDate instanceof Date) ||
    Number.isNaN(referenceDate.getTime()) ||
    birthDate > referenceDate
  ) {
    return null;
  }

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const birthdayHasPassed =
    referenceDate.getMonth() > birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() &&
      referenceDate.getDate() >= birthDate.getDate());

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age;
}


// "Just now" under a minute, then minutes, hours and days, and a short local
// date once a week has passed. Shared by the feed card and the notification
// list, which each carried an identical copy.
export function formatTimeAgo(value) {
  const timestamp = value ? new Date(value).getTime() : NaN;

  if (!Number.isFinite(timestamp)) {
    return "Just now";
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return "Just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
