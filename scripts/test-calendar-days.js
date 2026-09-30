// The calendar's days, shared by WorkoutCalendarPage and the Train tab's
// calendar block: the week pages, the lookups a day is read from, and the day
// the Workouts cells draw.
//
// src/Utils/calendarDays.js is pure - the icons come in through `iconFor` - so
// it runs here as it is, through the same loader the other app-module tests use.
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const loadAppModule = require("./lib/loadAppModule");

const root = path.resolve(__dirname, "..");
const days = loadAppModule("src/Utils/calendarDays.js");

const labels = (page) => page.days.map((day) => day.dateLabel);

/* --------------------------------------------------------- week pages -- */

// Friday 25 September 2026, late in the evening: the time of day plays no part.
const FRIDAY = new Date(2026, 8, 25, 23, 30);
const thisWeek = days.getWeekPage(FRIDAY, 0);
const lastWeek = days.getWeekPage(FRIDAY, -1);

assert.deepEqual(days.WEEKDAY_LABELS, ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
assert.deepEqual(
  labels(thisWeek),
  ["21.09.2026", "22.09.2026", "23.09.2026", "24.09.2026", "25.09.2026", "26.09.2026", "27.09.2026"],
  "this week runs from Monday to Sunday"
);
assert.deepEqual(
  labels(lastWeek),
  ["14.09.2026", "15.09.2026", "16.09.2026", "17.09.2026", "18.09.2026", "19.09.2026", "20.09.2026"],
  "last week is the seven days before it"
);
assert.deepEqual(thisWeek.days.map((day) => day.label), days.WEEKDAY_LABELS, "Monday first");
assert.deepEqual(
  thisWeek.days.map((day) => day.isoDate),
  ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]
);
assert.equal(thisWeek.key, "2026-09-21", "a week is keyed by its Monday");
assert.equal(lastWeek.key, "2026-09-14");
assert.equal(thisWeek.weekOffset, 0);
assert.equal(lastWeek.weekOffset, -1);
assert.ok(thisWeek.days.every((day) => day.inMonth), "a week page has no days outside its month");
assert.ok(
  thisWeek.days.every((day) => day.date.getHours() === 0 && day.date.getMinutes() === 0),
  "every day starts at midnight"
);

// getDay() calls Sunday 0, so it is the one day that could land in the wrong week.
assert.equal(days.getWeekPage(new Date(2026, 8, 27), 0).key, "2026-09-21", "a Sunday is the last day of its week");
assert.equal(days.getWeekPage(new Date(2026, 8, 21), 0).key, "2026-09-21", "a Monday is the first");

assert.deepEqual(
  labels(days.getWeekPage(new Date(2026, 8, 30), 0)),
  ["28.09.2026", "29.09.2026", "30.09.2026", "01.10.2026", "02.10.2026", "03.10.2026", "04.10.2026"],
  "a week across a month end"
);
assert.deepEqual(
  labels(days.getWeekPage(new Date(2026, 9, 1), -1)),
  labels(thisWeek),
  "last week, seen from the 1st of the next month"
);
assert.deepEqual(
  labels(days.getWeekPage(new Date(2026, 11, 31), 0)),
  ["28.12.2026", "29.12.2026", "30.12.2026", "31.12.2026", "01.01.2027", "02.01.2027", "03.01.2027"],
  "a week across a year end"
);
// Summer time ends on Sunday 25 October 2026 in Europe: a day is a calendar
// day, not 24 hours.
assert.deepEqual(
  labels(days.getWeekPage(new Date(2026, 9, 28), -1)),
  ["19.10.2026", "20.10.2026", "21.10.2026", "22.10.2026", "23.10.2026", "24.10.2026", "25.10.2026"]
);
assert.deepEqual(
  labels(days.getWeekPage(new Date(2026, 9, 28), 0)),
  ["26.10.2026", "27.10.2026", "28.10.2026", "29.10.2026", "30.10.2026", "31.10.2026", "01.11.2026"]
);

assert.equal(days.formatLocalDate(new Date(2026, 0, 5)), "05.01.2026");
assert.equal(days.formatIsoDate(new Date(2026, 0, 5)), "2026-01-05");
assert.equal(days.getMondayWeekdayIndex(new Date(2026, 8, 21)), 0);
assert.equal(days.getMondayWeekdayIndex(new Date(2026, 8, 27)), 6);

/* ----------------------------------------------------- workout helpers -- */

assert.equal(days.getWorkoutType({ workout_type: "Run", label: "Easy run" }), "Run", "the type wins over the label");
assert.equal(days.getWorkoutType({ label: "Legs" }), "Legs");
assert.equal(days.getWorkoutType(null), "Resistance", "a workout with neither is a strength workout");
assert.equal(days.getWorkoutIconLabel({ label: "Push day" }), "PD", "two words: their initials");
assert.equal(days.getWorkoutIconLabel({ label: "legs" }), "LE", "one word: its first two letters");
assert.equal(days.getWorkoutIconLabel({ workout_type: "Mobility" }), "MO");
assert.equal(days.getWorkoutIconLabel({}), "WO");
{
  // With the app's language: a label that is a stored type id is read in it
  // first; one the user typed is not.
  const { translate } = loadAppModule("src/Localization/i18n.js");
  const inDanish = (key, params) => translate(key, params, "da");

  assert.equal(days.getWorkoutIconLabel({ label: "Walk", workout_type: "Walk" }, inDanish), "GÅ");
  assert.equal(days.getWorkoutIconLabel({ workout_type: "Walk" }, inDanish), "GÅ", "no label: the type's name");
  assert.equal(days.getWorkoutIconLabel({ label: "Push day" }, inDanish), "PD", "a typed name stays as typed");
  assert.equal(days.getWorkoutIconLabel({ label: "Walk" }), "WA", "without t, as before");
}

for (const sick of [true, "true", 1, "1"]) {
  assert.equal(days.isProgramDaySick({ is_sick: sick }), true, `is_sick ${JSON.stringify(sick)} is sick`);
}

for (const well of [false, "false", 0, "0", null, undefined]) {
  assert.equal(days.isProgramDaySick({ is_sick: well }), false, `is_sick ${JSON.stringify(well)} is not`);
}

assert.equal(days.isProgramDaySick(null), false);

/* ------------------------------------------------------------ lookups -- */

// What the Train block asks for: Monday of last week to Sunday of this week.
const range = { startIsoDate: lastWeek.days[0].isoDate, endIsoDate: thisWeek.days[6].isoDate };
assert.deepEqual(range, { startIsoDate: "2026-09-14", endIsoDate: "2026-09-27" });

const workouts = [
  { workout_id: 1, date: "22.09.2026", done: 1, workout_type: "Resistance", label: "Push day" },
  { workout_id: 2, date: "22.09.2026", done: 0, workout_type: "Run", label: "Easy run" },
  // done as the text SQLite can hand back, and a type with no icon of its own.
  { workout_id: 3, date: "16.09.2026", done: "1", workout_type: "Yoga", label: "Morning yoga" },
  { workout_id: 4, date: null, done: 1, workout_type: "Run" },
];
const programDays = [
  { day_id: 10, program_id: 7, date: "24.09.2026", is_sick: 0 },
  // The same program twice on one date is one program day.
  { day_id: 11, program_id: 7, date: "24.09.2026", is_sick: 0 },
  { day_id: 12, program_id: 8, date: "24.09.2026", is_sick: 0 },
  // Marked sick on the program day itself, with no sickness period behind it.
  { day_id: 13, program_id: 7, date: "23.09.2026", is_sick: "true" },
  { day_id: 14, program_id: 7, date: null, is_sick: 1 },
];
const sicknessPeriods = [
  // Starts before the range and ends inside it.
  { sickness_id: 1, start_date: "10.09.2026", end_date: "15.09.2026" },
  // Still going: runs to the end of the range, and no further.
  { sickness_id: 2, start_date: "26.09.2026", end_date: null },
  // Wholly outside the range, on either side of it.
  { sickness_id: 3, start_date: "01.09.2026", end_date: "13.09.2026" },
  { sickness_id: 4, start_date: "28.09.2026", end_date: "30.09.2026" },
  { sickness_id: 5, start_date: null, end_date: "20.09.2026" },
];

const lookups = days.buildCalendarLookups({ workouts, programDays, sicknessPeriods, ...range });

assert.deepEqual(
  [...lookups.workoutsByDate.keys()],
  ["22.09.2026", "16.09.2026"],
  "workouts are keyed by their date, and one without a date is on no day"
);
assert.deepEqual(lookups.workoutsByDate.get("22.09.2026").map((workout) => workout.workout_id), [1, 2]);
assert.deepEqual(
  lookups.programsByDate.get("24.09.2026").map((programDay) => programDay.day_id),
  [10, 12],
  "one program day per program on a date"
);
assert.deepEqual(lookups.programDates, new Set(["24.09.2026", "23.09.2026"]));
assert.deepEqual(
  lookups.sickDates,
  new Set(["14.09.2026", "15.09.2026", "26.09.2026", "27.09.2026"]),
  "a sickness period is clipped to the range at both ends"
);

const spanning = days.buildCalendarLookups({
  sicknessPeriods: [{ start_date: "01.09.2026", end_date: "31.10.2026" }],
  ...range,
});
assert.deepEqual(
  [...spanning.sickDates],
  [...labels(lastWeek), ...labels(thisWeek)],
  "a period over both edges covers each of the range's fourteen days, and no more"
);
assert.equal(
  days.buildCalendarLookups({ sicknessPeriods }).sickDates.size,
  0,
  "without a range there is nothing to mark sick"
);

const empty = days.buildCalendarLookups();
assert.equal(empty.workoutsByDate.size + empty.programsByDate.size + empty.programDates.size + empty.sickDates.size, 0);

/* --------------------------------------------------------- enrichment -- */

const TODAY_LABEL = days.formatLocalDate(FRIDAY);
// Shaped like the screens' own iconFor: a type with no icon gets neither.
const ICONS = {
  Resistance: { icon: "ResistanceIcon", iconLabel: "Resist..." },
  Run: { icon: "RunIcon", iconLabel: "Run" },
};
const iconCalls = [];
const iconFor = (workoutType) => {
  iconCalls.push(workoutType);
  return ICONS[workoutType] ?? { icon: undefined, iconLabel: null };
};

const rows = [lastWeek, thisWeek].map((week) =>
  week.days.map((day) =>
    days.enrichCalendarDay(day, lookups, { pageKey: week.key, todayLabel: TODAY_LABEL, iconFor })
  )
);
const enriched = rows.flat();
const day = (dateLabel) => enriched.find((candidate) => candidate.dateLabel === dateLabel);
const cardsOf = (enrichedDay) =>
  enrichedDay.workoutCards.map(({ key, icon, iconLabel, completed }) => ({ key, icon, iconLabel, completed }));

assert.deepEqual(iconCalls, ["Yoga", "Resistance", "Run"], "iconFor is asked about each workout's type");

const tuesday = day("22.09.2026");
assert.deepEqual(cardsOf(tuesday), [
  { key: 1, icon: "ResistanceIcon", iconLabel: "Resist...", completed: true },
  { key: 2, icon: "RunIcon", iconLabel: "Run", completed: false },
]);
assert.equal(tuesday.workoutCards[0].workout, workouts[0], "a card keeps its workout row");
assert.deepEqual(tuesday.workouts, [workouts[0], workouts[1]]);
assert.equal(tuesday.microcycleId, "2026-09-21", "a day carries its week's key");
assert.equal(tuesday.isoDate, "2026-09-22", "and keeps what the week page gave it");
assert.equal(tuesday.label, "TUE");
assert.equal(tuesday.hasProgram, false);
assert.equal(tuesday.isSick, false);

assert.deepEqual(
  cardsOf(day("16.09.2026")),
  [{ key: 3, icon: undefined, iconLabel: "MY", completed: true }],
  "a type with no icon falls back to the workout's initials"
);

const thursday = day("24.09.2026");
assert.equal(thursday.hasProgram, true, "a program day");
assert.equal(thursday.isSick, false);
assert.deepEqual(thursday.workouts, []);
assert.deepEqual(thursday.workoutCards, []);

assert.equal(day("23.09.2026").isSick, true, "a program day marked sick is a sick day");
assert.equal(day("23.09.2026").hasProgram, true);
assert.deepEqual(
  enriched.filter((candidate) => candidate.isSick).map((candidate) => candidate.dateLabel),
  ["14.09.2026", "15.09.2026", "23.09.2026", "26.09.2026", "27.09.2026"],
  "sick: the period's days inside the range, the sick program day, and the open period to the end"
);

assert.deepEqual(
  enriched.filter((candidate) => candidate.active).map((candidate) => candidate.dateLabel),
  ["25.09.2026"],
  "today, and only today, is active"
);
assert.equal(day("25.09.2026").microcycleId, "2026-09-21");
assert.equal(day("18.09.2026").microcycleId, "2026-09-14");
assert.equal("workouts" in thisWeek.days[1], false, "the week page's own days are left as they were");

const withoutIcons = days.enrichCalendarDay(thisWeek.days[1], lookups, {
  pageKey: thisWeek.key,
  todayLabel: TODAY_LABEL,
});
assert.deepEqual(
  withoutIcons.workoutCards.map((card) => [card.icon, card.iconLabel]),
  [[undefined, "PD"], [undefined, "ER"]],
  "with no iconFor, every card falls back to the workout's initials"
);

{
  // `t` reaches the initials through enrichCalendarDay, which is how both
  // screens call it (PR #288's review: only getWorkoutIconLabel was tested).
  // An unnamed walk is read in Danish; "Run" typed on a strength workout is
  // a name, and stays one.
  const { translate } = loadAppModule("src/Localization/i18n.js");
  const inDanish = (key, params) => translate(key, params, "da");
  const oneDay = {
    workoutsByDate: new Map([
      [
        "22.09.2026",
        [
          { workout_id: 21, workout_type: "Walk", label: "Walk", done: 0 },
          { workout_id: 22, workout_type: "Resistance", label: "Run", done: 0 },
        ],
      ],
    ]),
    programsByDate: new Map(),
    programDates: new Set(),
    sickDates: new Set(),
  };
  const initials = (options) =>
    days
      .enrichCalendarDay({ dateLabel: "22.09.2026" }, oneDay, { pageKey: "2026-09-21", todayLabel: TODAY_LABEL, ...options })
      .workoutCards.map((card) => card.iconLabel);

  assert.deepEqual(initials({ t: inDanish }), ["GÅ", "RU"], "enrichCalendarDay does not pass t on");
  assert.deepEqual(initials({}), ["WA", "RU"], "without t, as before");
}

/* --------------------------------------------------------- month pages -- */

{
  // September 2026 starts on a Tuesday and ends on a Wednesday.
  const september = days.getMonthPage(new Date(2026, 8, 30), 0);

  assert.equal(september.key, "2026-09");
  assert.equal(september.startIsoDate, "2026-08-31", "the first week starts on the Monday before the 1st");
  assert.equal(september.endIsoDate, "2026-10-04", "the last week runs to the Sunday after the 30th");
  assert.equal(september.weeks.length, 5);
  assert.ok(september.weeks.every((week) => week.length === 7 && week[0].label === "MON"));
  assert.equal(september.weeks[0][0].inMonth, false, "the 31st of August is outside the month");
  assert.equal(september.weeks[0][1].dateLabel, "01.09.2026");
  assert.equal(september.weeks[0][1].inMonth, true);

  // Paging across the year, both ways.
  assert.equal(days.getMonthPage(new Date(2026, 11, 15), 1).key, "2027-01");
  assert.equal(days.getMonthPage(new Date(2026, 0, 31), -1).key, "2025-12");
  // The 31st plus one month is not the 3rd of the month after.
  assert.equal(days.getMonthPage(new Date(2026, 0, 31), 1).key, "2026-02");

  const t = (key, params) => (params ? `${key}:${params.month}:${params.year}` : key);

  assert.equal(days.getMonthTitle(september.monthDate, t), "calendar.monthTitle:calendar.months.sep:2026");
}

/* ------------------------------------------------------------- wiring -- */

// The point of the util is one set of rules for both screens.
const calendarPage = fs.readFileSync(
  path.join(root, "src/Pages/WorkoutCalendarPage/WorkoutCalendarPage.js"),
  "utf8"
);
const trainBlock = fs.readFileSync(
  path.join(root, "src/Pages/ExerciseLibraryPage/Components/TrainCalendarBlock/TrainCalendarBlock.js"),
  "utf8"
);

for (const [name, source] of [
  ["WorkoutCalendarPage", calendarPage],
  ["TrainCalendarBlock", trainBlock],
]) {
  assert.ok(source.includes('from "@utils/calendarDays"'), `${name} reads its days from Utils/calendarDays.js`);
  assert.ok(source.includes("enrichCalendarDay("), `${name} builds its days with enrichCalendarDay`);
}

// The Workouts rows under the month are one component, drawn by the calendar
// and by the split editor's calendar - not a copy in each.
const weekRows = fs.readFileSync(
  path.join(root, "src/Pages/WorkoutCalendarPage/Components/CalendarWeekRows/CalendarWeekRows.js"),
  "utf8"
);
const splitPicker = fs.readFileSync(
  path.join(root, "src/Pages/ExerciseLibraryPage/Components/SplitCard/SplitWorkoutPicker.js"),
  "utf8"
);

assert.ok(weekRows.includes("enrichCalendarDay("), "CalendarWeekRows builds its days with enrichCalendarDay");
for (const [name, source] of [
  ["WorkoutCalendarPage", calendarPage],
  ["SplitWorkoutPicker", splitPicker],
]) {
  assert.ok(/<CalendarWeekRows\b/.test(source), `${name} draws the Workouts rows with CalendarWeekRows`);
  assert.ok(!/<DayCell\b/.test(source), `${name} draws day cells of its own again`);
}

for (const helper of ["getWeekPage", "getMonthPage", "getMonthTitle", "getWorkoutType", "getWorkoutIconLabel", "isProgramDaySick", "startOfDay"]) {
  assert.ok(
    !new RegExp(`function ${helper}\\b`).test(calendarPage),
    `WorkoutCalendarPage has its own ${helper} again`
  );
}

console.log("calendar-days: the week pages, the lookups, the day enrichment and the wiring passed.");
