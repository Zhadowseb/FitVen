import { formatDate, parseCustomDate } from "./dateUtils";

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
