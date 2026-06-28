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

