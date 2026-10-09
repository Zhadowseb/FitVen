// Calendar arithmetic in Copenhagen time, without a date library.
//
// Weeks run Monday to Sunday, like every other series on the dev overview, and
// a date is a plain "YYYY-MM-DD" string. Adding days to a date string is done
// in UTC, where no day is 23 or 25 hours long, so summer time cannot move a
// week boundary.

const TIME_ZONE = "Europe/Copenhagen";
const DAY_MS = 86400000;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallClock(ms) {
  const parts = {};

  for (const { type, value } of formatter.formatToParts(new Date(ms))) {
    parts[type] = value;
  }

  return parts;
}

function splitDate(date) {
  const [year, month, day] = date.split("-").map(Number);

  return { year, month, day };
}

// The calendar date in Copenhagen at that instant.
function localDate(ms) {
  const parts = wallClock(ms);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date, days) {
  const { year, month, day } = splitDate(date);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// The Monday of the week the date falls in.
function mondayOf(date) {
  const { year, month, day } = splitDate(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return addDays(date, -((weekday + 6) % 7));
}

// Midnight in Copenhagen at the start of that date, as epoch milliseconds.
function localMidnight(date) {
  const { year, month, day } = splitDate(date);
  const guess = Date.UTC(year, month - 1, day);
  const offsetAt = (ms) => {
    const parts = wallClock(ms);

    return (
      Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - ms
    );
  };

  // The offset at the guess can differ from the offset at the answer on the
  // night the clocks change; asking twice settles it.
  return guess - offsetAt(guess - offsetAt(guess));
}

// The last `count` complete weeks before the one `nowMs` is in, as their
// Mondays, oldest first. The running week is left out on purpose: on a Monday
// morning it holds a handful of commits, and a percentage of a handful moves
// the line more than a month of work does.
function lastCompleteWeeks(nowMs, count) {
  const thisMonday = mondayOf(localDate(nowMs));

  return Array.from({ length: count }, (_, index) => addDays(thisMonday, -7 * (count - index)));
}

function wholeDaysBetween(fromMs, toMs) {
  return Math.max(0, Math.floor((toMs - fromMs) / DAY_MS));
}

function isoTime(ms) {
  return new Date(ms).toISOString();
}

module.exports = {
  DAY_MS,
  TIME_ZONE,
  addDays,
  isoTime,
  lastCompleteWeeks,
  localDate,
  localMidnight,
  mondayOf,
  wholeDaysBetween,
};
