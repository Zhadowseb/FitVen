import { addDays } from "./dailySteps";

// How days and ranges of days are written on the Steps page. Pure: the locale
// tag is handed in, so the app's language - not the phone's - decides.

const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** "monday" ... "sunday" for a "YYYY-MM-DD" day, matching programs.weekdays.*. */
export function weekdayKeyOf(iso) {
  const [year, month, day] = iso.split("-").map(Number);

  return WEEKDAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function part(iso, options, locale) {
  const [year, month, day] = iso.split("-").map(Number);

  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

/** "5-11 Oct", or "29 Sep - 5 Oct" when the range crosses a month. */
export function formatDayRange(fromIso, toIso, locale = "en") {
  if (fromIso === toIso) {
    return part(fromIso, { day: "numeric", month: "short" }, locale);
  }

  const sameMonth = fromIso.slice(0, 7) === toIso.slice(0, 7);

  if (sameMonth) {
    return `${part(fromIso, { day: "numeric" }, locale)}–${part(toIso, { day: "numeric", month: "short" }, locale)}`;
  }

  return `${part(fromIso, { day: "numeric", month: "short" }, locale)} – ${part(toIso, { day: "numeric", month: "short" }, locale)}`;
}

/** The date a week's bar in a month chart starts at: "5" or "12". */
export function dayOfMonthLabel(iso) {
  return String(Number(iso.slice(8, 10)));
}

/** The seven days of the week the day is in, Monday first. */
export function weekDays(mondayIso) {
  return Array.from({ length: 7 }, (_, index) => addDays(mondayIso, index));
}

/** "Mon" / "man." - a day's short weekday in the app's language. */
export function formatWeekdayShort(iso, locale = "en") {
  return part(iso, { weekday: "short" }, locale);
}

/** "October" - the month a day is in. */
export function formatMonthName(iso, locale = "en") {
  return part(iso, { month: "long" }, locale);
}
