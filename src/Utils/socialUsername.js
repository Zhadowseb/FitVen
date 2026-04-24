export const USERNAME_BASE_MIN_LENGTH = 3;
export const USERNAME_BASE_MAX_LENGTH = 20;
export const USERNAME_CODE_LENGTH = 4;
export const USERNAME_BASE_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_FULL_PATTERN = /^([a-z0-9_]{3,20})#([0-9]{4})$/;

function trimUnderscores(value) {
  return value.replace(/^_+|_+$/g, "");
}

export function normalizeUsernameBaseInput(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

export function slugifyUsernameBase(value) {
  const normalizedValue = normalizeUsernameBaseInput(value);
  const slugifiedValue = trimUnderscores(
    normalizedValue.replace(/[^a-z0-9_]+/g, "_")
  ).slice(0, USERNAME_BASE_MAX_LENGTH);

  if (slugifiedValue.length < USERNAME_BASE_MIN_LENGTH) {
    return "user";
  }

  return slugifiedValue;
}

export function isValidUsernameBase(value) {
  return USERNAME_BASE_PATTERN.test(normalizeUsernameBaseInput(value));
}

export function formatUsernameCode(value) {
  const digitString = `${value ?? ""}`.replace(/\D+/g, "");
  return digitString
    .slice(-USERNAME_CODE_LENGTH)
    .padStart(USERNAME_CODE_LENGTH, "0");
}

export function buildFullUsername(usernameBase, usernameCode) {
  return `${normalizeUsernameBaseInput(usernameBase)}#${formatUsernameCode(
    usernameCode
  )}`;
}

export function splitFullUsername(value) {
  const normalizedValue = normalizeUsernameBaseInput(value);
  const match = normalizedValue.match(USERNAME_FULL_PATTERN);

  if (!match) {
    return null;
  }

  return {
    usernameBase: match[1],
    usernameCode: match[2],
  };
}
