const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getWeekStart(date) {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);

  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  return weekStart;
}

export function addWeeks(date, weekOffset) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + weekOffset * 7);
  return getWeekStart(nextDate);
}

export function getWeekEnd(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
}

export function getIsoWeekStart(year, weekNumber) {
  const firstIsoWeekStart = getWeekStart(new Date(year, 0, 4));
  return addWeeks(firstIsoWeekStart, weekNumber - 1);
}

export function getIsoWeekInfo(date) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const utcDay = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - utcDay);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((utcDate - yearStart) / MS_PER_DAY + 1) / 7);

  return {
    weekNumber,
    weekYear: utcDate.getUTCFullYear(),
  };
}

export function getWeeksInIsoYear(year) {
  return getIsoWeekInfo(new Date(year, 11, 28)).weekNumber;
}

export function buildWeekOptions(year) {
  const weeksInYear = getWeeksInIsoYear(year);

  return Array.from({ length: weeksInYear }, (_, index) => {
    const weekNumber = index + 1;
    const weekStart = getIsoWeekStart(year, weekNumber);

    return {
      weekNumber,
      weekStart,
      weekEnd: getWeekEnd(weekStart),
    };
  });
}
