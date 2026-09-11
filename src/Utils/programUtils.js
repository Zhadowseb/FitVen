import { formatDate, parseCustomDate } from "./dateUtils";

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

// BUG-20: the same program showed "25 MAY - 28 JUN 2026" on the list and
// "25.05.2026 - 28.06.2026" on the page that list opens. Two local copies of
// the same idea, so they were free to disagree. This is the one.
export function formatProgramDateLabel(value, { includeYear = false } = {}) {
  if (!value) {
    return "";
  }

  const date = parseCustomDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_LABELS[date.getMonth()] ?? "";
  const year = date.getFullYear();

  return `${day} ${month}${includeYear ? ` ${year}` : ""}`.trim();
}

export function getProgramDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return "";
  }

  const start = parseCustomDate(startDate);
  const end = parseCustomDate(endDate);
  const showStartYear =
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getFullYear() !== end.getFullYear();

  return `${formatProgramDateLabel(startDate, {
    includeYear: showStartYear,
  })} – ${formatProgramDateLabel(endDate, { includeYear: true })}`;
}

export function getProgramEndDate (startDate, dayCount) {
  if (!startDate) {
    return "";
  }

  const totalDays = Math.max(0, Math.trunc(Number(dayCount) || 0));
  const endDate = parseCustomDate(startDate);
  endDate.setDate(endDate.getDate() + Math.max(totalDays - 1, 0));
  return formatDate(endDate);
};

export function getAverageSessionsPerWeek (workoutCount, weekCount) {
  if (!weekCount) {
    return "0.0";
  }

  return (workoutCount / weekCount).toFixed(1);
};
