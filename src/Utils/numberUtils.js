// Display formatting for numbers that may be integers or have one decimal:
// 5 -> "5", 5.5 -> "5.5". Five near-identical copies of this lived in the RM
// list, the 1RM calculator, the program service and the social post service.

// An unusable value reads as an em-dash pair, so a table cell still lines up.
export function formatDisplayNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return Number.isInteger(numericValue)
    ? `${numericValue}`
    : numericValue.toFixed(1);
}

// Same formatting, but an unusable value returns null so a caller can drop the
// whole label rather than print a placeholder.
export function formatOptionalNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Number.isInteger(numericValue)
    ? `${numericValue}`
    : numericValue.toFixed(1);
}
