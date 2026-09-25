// The calendar's days: the week pages, the lookups a day is read from, and the
// day shape the Workouts cells (DayCell) and the week rows draw. Shared by
// WorkoutCalendarPage and the Train tab's calendar block, so the two can never
// disagree about what a day shows.
//
// Pure: no React, no database and no icons - a workout's icon comes in through
// `iconFor` - so scripts/test-calendar-days.js runs it in Node.

import { addDays, parseCustomDate } from "./dateUtils";

// Weekday codes: passed on as the day of a new workout, so they stay English.
// What is shown goes through calendar.weekdays / home.weekdays.
export const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "25.09.2026": how workouts, program days and sickness are dated. */
export function formatLocalDate(date) {
  return `${padDatePart(date.getDate())}.${padDatePart(
    date.getMonth() + 1
  )}.${date.getFullYear()}`;
}

/** "2026-09-25": what the calendar queries take. */
export function formatIsoDate(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;
}

function parseIsoDateLocal(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** 0 for Monday through 6 for Sunday. */
export function getMondayWeekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

/** The seven days of one week, `weekOffset` weeks from the week holding `baseDate`. */
export function getWeekPage(baseDate, weekOffset) {
  const monday = addDays(
    startOfDay(baseDate),
    -getMondayWeekdayIndex(baseDate) + weekOffset * 7
  );

  return {
    key: formatIsoDate(monday),
    weekOffset,
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(monday, index);

      return {
        date,
        dateLabel: formatLocalDate(date),
        isoDate: formatIsoDate(date),
        inMonth: true,
        label: WEEKDAY_LABELS[index],
      };
    }),
  };
}

export function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? "Resistance";
}

/** Two letters for a workout with no icon: "Push day" -> "PD", "Legs" -> "LE". */
export function getWorkoutIconLabel(workout) {
  const label = workout?.label ?? workout?.workout_type ?? "WO";
  const words = String(label)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return String(label).slice(0, 2).toUpperCase();
}

export function isProgramDaySick(programDay) {
  return (
    programDay?.is_sick === true ||
    programDay?.is_sick === "true" ||
    Number(programDay?.is_sick) === 1
  );
}

/**
 * What a day is read from, each keyed by the stored date ("25.09.2026"):
 * the day's workouts, its program days (one per program), the dates with a
 * program day, and the sick dates. A sickness period is clipped to the range,
 * and one with no end runs to the end of it.
 */
export function buildCalendarLookups({
  workouts,
  programDays,
  sicknessPeriods,
  startIsoDate,
  endIsoDate,
} = {}) {
  const workoutsByDate = new Map();

  for (const workout of workouts ?? []) {
    const date = workout?.date;

    if (!date) {
      continue;
    }

    const dateWorkouts = workoutsByDate.get(date) ?? [];
    dateWorkouts.push(workout);
    workoutsByDate.set(date, dateWorkouts);
  }

  const programsByDate = new Map();

  for (const programDay of programDays ?? []) {
    const date = programDay?.date;

    if (!date) {
      continue;
    }

    const datePrograms = programsByDate.get(date) ?? [];
    if (
      !datePrograms.some(
        (dateProgram) => dateProgram.program_id === programDay.program_id
      )
    ) {
      datePrograms.push(programDay);
    }
    programsByDate.set(date, datePrograms);
  }

  const sickDates = new Set();

  if (startIsoDate && endIsoDate) {
    const calendarStartDate = startOfDay(parseIsoDateLocal(startIsoDate));
    const calendarEndDate = startOfDay(parseIsoDateLocal(endIsoDate));

    for (const sicknessPeriod of sicknessPeriods ?? []) {
      if (!sicknessPeriod?.start_date) {
        continue;
      }

      let cursor = startOfDay(parseCustomDate(sicknessPeriod.start_date));
      let sicknessEndDate = sicknessPeriod.end_date
        ? startOfDay(parseCustomDate(sicknessPeriod.end_date))
        : calendarEndDate;

      if (sicknessEndDate < calendarStartDate || cursor > calendarEndDate) {
        continue;
      }

      if (cursor < calendarStartDate) {
        cursor = calendarStartDate;
      }

      if (sicknessEndDate > calendarEndDate) {
        sicknessEndDate = calendarEndDate;
      }

      while (cursor <= sicknessEndDate) {
        sickDates.add(formatLocalDate(cursor));
        cursor = addDays(cursor, 1);
      }
    }
  }

  return {
    workoutsByDate,
    programsByDate,
    programDates: new Set(programsByDate.keys()),
    sickDates,
  };
}

/**
 * One day of a week page with what is on it, in the shape DayCell and the
 * week rows read. `iconFor(workoutType)` gives a workout card its
 * `{ icon, iconLabel }`; without one, the card falls back to the workout's
 * initials.
 */
export function enrichCalendarDay(
  day,
  lookups,
  { pageKey, todayLabel, iconFor } = {}
) {
  const dayWorkouts = lookups.workoutsByDate.get(day.dateLabel) ?? [];
  const dayProgramRows = lookups.programsByDate.get(day.dateLabel) ?? [];

  return {
    ...day,
    microcycleId: pageKey,
    active: day.dateLabel === todayLabel,
    hasProgram: lookups.programDates.has(day.dateLabel),
    isSick:
      lookups.sickDates.has(day.dateLabel) ||
      dayProgramRows.some(isProgramDaySick),
    workouts: dayWorkouts,
    workoutCards: dayWorkouts.map((workout) => {
      const typeIcon = iconFor?.(getWorkoutType(workout));

      return {
        key: workout.workout_id,
        workout,
        icon: typeIcon?.icon,
        iconLabel: typeIcon?.iconLabel ?? getWorkoutIconLabel(workout),
        completed: Number(workout.done) === 1,
      };
    }),
  };
}
