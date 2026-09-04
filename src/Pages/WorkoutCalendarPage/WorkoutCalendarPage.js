import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./WorkoutCalendarPageStyle";
import { programService } from "../../Services";
import { Colors } from "../../Resources/GlobalStyling/colors";
import WorkoutCopyTargetModal from "../../Resources/Components/WorkoutCopyTargetModal";
import ArrowLeft from "../../Resources/Icons/UI-icons/ArrowLeft";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import Copy from "../../Resources/Icons/UI-icons/Copy";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import PlusCircled from "../../Resources/Icons/UI-icons/PlusCircled";
import { getWorkoutIconConfig } from "../../Resources/Icons/WorkoutLabels";
import WeekdayIndicator from "../../Resources/Figures/WeekdayIndicator";
import {
  DayCell,
  useGridPalette,
} from "../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGrid";
import gridStyles from "../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGridStyle";
import CalendarWeekView from "./Components/CalendarWeekView/CalendarWeekView";
import {
  ThemedBottomSheet,
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedModal,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { parseCustomDate } from "../../Utils/dateUtils";
import { isWorkoutComingSoon } from "../../Utils/workoutTypeAvailability";
import { requestOpenQuickWorkoutMenu } from "../../Utils/quickWorkoutMenuEvents";

const ADJACENT_MONTH_COUNT = 1;
const INITIAL_VISIBLE_MONTH_OFFSET = 0;
const INITIAL_VISIBLE_MONTH_INDEX = ADJACENT_MONTH_COUNT;
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const CALENDAR_VIEWS = [
  { value: "block", label: "Block" },
  { value: "week", label: "Week" },
];
const WEEKDAY_FULL_LABELS = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatLocalDate(date) {
  return `${padDatePart(date.getDate())}.${padDatePart(
    date.getMonth() + 1
  )}.${date.getFullYear()}`;
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;
}

function parseIsoDateLocal(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
}

function getMonthTitle(date) {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function getMondayWeekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}



function getMonthPage(baseDate, monthOffset) {
  const monthDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + monthOffset,
    1
  );
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const gridStart = addDays(monthStart, -getMondayWeekdayIndex(monthStart));
  const gridEnd = addDays(monthEnd, 6 - getMondayWeekdayIndex(monthEnd));
  const weeks = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    const week = [];

    for (let index = 0; index < WEEKDAY_LABELS.length; index += 1) {
      const dayDate = new Date(cursor);
      week.push({
        date: dayDate,
        dateLabel: formatLocalDate(dayDate),
        isoDate: formatIsoDate(dayDate),
        inMonth: dayDate.getMonth() === monthStart.getMonth(),
        label: WEEKDAY_LABELS[index],
      });
      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
  }

  return {
    key: getMonthKey(monthStart),
    title: getMonthTitle(monthStart),
    monthDate: monthStart,
    startIsoDate: formatIsoDate(gridStart),
    endIsoDate: formatIsoDate(gridEnd),
    weeks,
  };
}

/** The seven days of one week, `weekOffset` weeks from the week holding today. */
function getWeekPage(baseDate, weekOffset) {
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

/**
 * Which month a week belongs to, counted from today's month. A week that
 * straddles two months belongs to the one holding its Thursday, the way an ISO
 * week number does - so switching back to Block lands on the month the week
 * reads as.
 */
function getMonthOffsetForWeek(baseDate, weekOffset) {
  const thursday = addDays(
    startOfDay(baseDate),
    -getMondayWeekdayIndex(baseDate) + weekOffset * 7 + 3
  );

  return (
    (thursday.getFullYear() - baseDate.getFullYear()) * 12 +
    (thursday.getMonth() - baseDate.getMonth())
  );
}

function getWeekOffsetRange(weekOffset) {
  return { start: weekOffset - 1, end: weekOffset + 1 };
}

function getMonthOffsetRange(monthOffset) {
  return {
    start: monthOffset - ADJACENT_MONTH_COUNT,
    end: monthOffset + ADJACENT_MONTH_COUNT,
  };
}

function hasCalendarRange(range) {
  return Boolean(range?.startIsoDate && range?.endIsoDate);
}

function isSameCalendarRange(leftRange, rightRange) {
  return (
    leftRange?.startIsoDate === rightRange?.startIsoDate &&
    leftRange?.endIsoDate === rightRange?.endIsoDate
  );
}

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? "Resistance";
}

function getWorkoutIconLabel(workout) {
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

function isProgramDaySick(programDay) {
  return (
    programDay?.is_sick === true ||
    programDay?.is_sick === "true" ||
    Number(programDay?.is_sick) === 1
  );
}

function getProgramDayLocation(programDay) {
  const locationParts = [
    programDay?.mesocycle_number
      ? `Block ${programDay.mesocycle_number}`
      : null,
    programDay?.microcycle_number ? `Week ${programDay.microcycle_number}` : null,
    [programDay?.weekday, programDay?.date].filter(Boolean).join(" "),
  ].filter(Boolean);

  return locationParts.length ? locationParts.join(" - ") : "Program day";
}

function getProgramCopyLocation(programDay) {
  return `Add to ${getProgramDayLocation(programDay)}`;
}

function getWorkoutDayStatus(workout, { isSick = false, isPast = false } = {}) {
  const isDone = Number(workout?.done) === 1;

  if (isDone) {
    return Number(workout?.has_personal_record) === 1
      ? { label: "Completed - personal record", tone: "record" }
      : { label: "Completed", tone: "done" };
  }

  if (isSick) {
    return { label: isPast ? "Missed - sick day" : "Sick day", tone: "sick" };
  }

  return isPast
    ? { label: "Overdue", tone: "overdue" }
    : { label: "Planned", tone: "planned" };
}

const WorkoutCalendarPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const monthPagerRef = useRef(null);
  const weekPagerRef = useRef(null);
  const weekPagerRecenteringRef = useRef(false);
  const pendingWeekScrollRef = useRef(null);
  const visibleMonthOffsetRef = useRef(INITIAL_VISIBLE_MONTH_OFFSET);
  const pendingScrollModeRef = useRef("instant");
  const previousPageWidthRef = useRef(null);
  const hasSyncedCalendarRef = useRef(false);
  const calendarMountedRef = useRef(false);
  const calendarLoadRequestRef = useRef(0);
  const loadCalendarWorkoutsRef = useRef(null);
  const monthPagerRecenteringRef = useRef(false);
  const monthPagerRecenteringTimeoutRef = useRef(null);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(width, 1);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayLabel = useMemo(() => formatLocalDate(today), [today]);
  const todayIsoDate = useMemo(() => formatIsoDate(today), [today]);
  const [workouts, setWorkouts] = useState([]);
  const [programDays, setProgramDays] = useState([]);
  const [sicknessPeriods, setSicknessPeriods] = useState([]);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [daySheetVisible, setDaySheetVisible] = useState(false);
  const [programTargetModalVisible, setProgramTargetModalVisible] =
    useState(false);
  const [copyDatePickerVisible, setCopyDatePickerVisible] = useState(false);
  const [copySourceWorkout, setCopySourceWorkout] = useState(null);
  const [pendingCopyTarget, setPendingCopyTarget] = useState(null);
  const [monthOffsetRange, setMonthOffsetRange] = useState(
    () => getMonthOffsetRange(INITIAL_VISIBLE_MONTH_OFFSET)
  );
  const [visibleMonthOffset, setVisibleMonthOffset] = useState(
    INITIAL_VISIBLE_MONTH_OFFSET
  );
  const [isLoading, setIsLoading] = useState(false);
  const [calendarView, setCalendarView] = useState("block");
  const [viewMenuVisible, setViewMenuVisible] = useState(false);
  // Weeks from the week holding today. In Week view this is what a swipe moves.
  const [visibleWeekOffset, setVisibleWeekOffset] = useState(0);
  const [weekOffsetRange, setWeekOffsetRange] = useState(() =>
    getWeekOffsetRange(0)
  );
  const [isCopyingWorkout, setIsCopyingWorkout] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary;
  const gridPalette = useGridPalette();
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary;
  const modalCardSurface = theme.fields ?? theme.cardBackground ?? theme.background;
  const actionTextColor = theme.textInverted ?? theme.cardBackground;
  const dangerColor = theme.danger;
  const recordColor = theme.record ?? secondaryColor;
  const sickColor = theme.planned;
  const rawVisibleMonthIndex = visibleMonthOffset - monthOffsetRange.start;
  const monthPages = useMemo(
    () =>
      Array.from(
        { length: monthOffsetRange.end - monthOffsetRange.start + 1 },
        (_, index) => getMonthPage(today, monthOffsetRange.start + index)
      ),
    [monthOffsetRange.end, monthOffsetRange.start, today]
  );
  const visibleMonthIndex = Math.min(
    Math.max(rawVisibleMonthIndex, 0),
    Math.max(monthPages.length - 1, 0)
  );
  const calendarRange = useMemo(
    () => ({
      startIsoDate: monthPages[0]?.startIsoDate,
      endIsoDate: monthPages[monthPages.length - 1]?.endIsoDate,
    }),
    [monthPages]
  );
  const workoutsByDate = useMemo(() => {
    const nextWorkoutsByDate = new Map();

    for (const workout of workouts) {
      const date = workout?.date;

      if (!date) {
        continue;
      }

      const dateWorkouts = nextWorkoutsByDate.get(date) ?? [];
      dateWorkouts.push(workout);
      nextWorkoutsByDate.set(date, dateWorkouts);
    }

    return nextWorkoutsByDate;
  }, [workouts]);
  const programsByDate = useMemo(() => {
    const nextProgramsByDate = new Map();

    for (const programDay of programDays) {
      const date = programDay?.date;

      if (!date) {
        continue;
      }

      const datePrograms = nextProgramsByDate.get(date) ?? [];
      if (
        !datePrograms.some(
          (dateProgram) => dateProgram.program_id === programDay.program_id
        )
      ) {
        datePrograms.push(programDay);
      }
      nextProgramsByDate.set(date, datePrograms);
    }

    return nextProgramsByDate;
  }, [programDays]);
  const programDates = useMemo(
    () => new Set(programsByDate.keys()),
    [programsByDate]
  );
  const sickDates = useMemo(() => {
    const nextSickDates = new Set();

    if (!calendarRange.startIsoDate || !calendarRange.endIsoDate) {
      return nextSickDates;
    }

    const calendarStartDate = startOfDay(
      parseIsoDateLocal(calendarRange.startIsoDate)
    );
    const calendarEndDate = startOfDay(
      parseIsoDateLocal(calendarRange.endIsoDate)
    );

    for (const sicknessPeriod of sicknessPeriods) {
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
        nextSickDates.add(formatLocalDate(cursor));
        cursor = addDays(cursor, 1);
      }
    }

    return nextSickDates;
  }, [calendarRange.endIsoDate, calendarRange.startIsoDate, sicknessPeriods]);
  const visibleMonth = monthPages[visibleMonthIndex] ?? monthPages[0];
  const visibleMonthRange = useMemo(
    () => ({
      startIsoDate: visibleMonth?.startIsoDate,
      endIsoDate: visibleMonth?.endIsoDate,
    }),
    [visibleMonth?.endIsoDate, visibleMonth?.startIsoDate]
  );
  const weekPages = useMemo(
    () =>
      Array.from(
        { length: weekOffsetRange.end - weekOffsetRange.start + 1 },
        (_, index) => getWeekPage(today, weekOffsetRange.start + index)
      ),
    [today, weekOffsetRange.end, weekOffsetRange.start]
  );
  const visibleWeekIndex = Math.min(
    Math.max(visibleWeekOffset - weekOffsetRange.start, 0),
    Math.max(weekPages.length - 1, 0)
  );

  // One routine for both views: the calendar's lookups turned into the day
  // shape the grid and the week rows both read.
  const enrichDay = (day, pageKey) => {
    const dayWorkouts = workoutsByDate.get(day.dateLabel) ?? [];
    const dayProgramRows = programsByDate.get(day.dateLabel) ?? [];

    return {
      ...day,
      microcycleId: pageKey,
      active: day.dateLabel === todayLabel,
      hasProgram: programDates.has(day.dateLabel),
      isSick:
        sickDates.has(day.dateLabel) || dayProgramRows.some(isProgramDaySick),
      workouts: dayWorkouts,
      workoutCards: dayWorkouts.map((workout) => {
        const iconConfig = getWorkoutIconConfig(getWorkoutType(workout));

        return {
          key: workout.workout_id,
          workout,
          icon: iconConfig?.Icon,
          iconLabel: iconConfig?.short ?? getWorkoutIconLabel(workout),
          completed: Number(workout.done) === 1,
        };
      }),
    };
  };

  const buildMonthWeeks = (monthPage) =>
    (monthPage?.weeks ?? []).map((week) => ({
      key: `${monthPage?.key}-${week[0].isoDate}`,
      days: week.map((day) => enrichDay(day, monthPage?.key)),
      isCurrentWeek: week.some((day) => day.dateLabel === todayLabel),
    }));

  const buildWeek = (weekPage) => ({
    key: weekPage.key,
    days: weekPage.days.map((day) => enrichDay(day, weekPage.key)),
    dateRange: `${MONTH_LABELS[weekPage.days[0].date.getMonth()].slice(0, 3)} ${
      weekPage.days[0].date.getDate()
    } - ${
      weekPage.days[0].date.getMonth() === weekPage.days[6].date.getMonth()
        ? ""
        : `${MONTH_LABELS[weekPage.days[6].date.getMonth()].slice(0, 3)} `
    }${weekPage.days[6].date.getDate()}`,
  });

  const getWeekPageTitle = (weekPage) => {
    const thursday = weekPage.days[3].date;

    return `${MONTH_LABELS[thursday.getMonth()]} ${thursday.getFullYear()}`;
  };

  const getWeekPageLabel = (weekPage) => {
    if (weekPage.weekOffset === 0) {
      return "This week";
    }

    if (weekPage.weekOffset === -1) {
      return "Last week";
    }

    if (weekPage.weekOffset === 1) {
      return "Next week";
    }

    const monday = weekPage.days[0].date;

    return `Week of ${MONTH_LABELS[monday.getMonth()].slice(0, 3)} ${monday.getDate()}`;
  };

  // Only the loading state: the workout counts live on each week's own line.
  const monthSummaryText = isLoading ? "Loading..." : "";
  // Derived, not stored: the sheet keeps showing the truth after a workout is
  // deleted or copied, without having to be reopened.
  const selectedDayWorkouts = selectedCalendarDay
    ? workoutsByDate.get(selectedCalendarDay.dateLabel) ?? []
    : [];
  const selectedDayPrograms = selectedCalendarDay
    ? programsByDate.get(selectedCalendarDay.dateLabel) ?? []
    : [];
  const selectedDayIsSick = Boolean(
    selectedCalendarDay &&
      (sickDates.has(selectedCalendarDay.dateLabel) ||
        selectedDayPrograms.some(isProgramDaySick))
  );
  const selectedDayIsPast = Boolean(
    selectedCalendarDay && selectedCalendarDay.isoDate < todayIsoDate
  );
  const selectedDayIsToday = selectedCalendarDay?.dateLabel === todayLabel;
  const selectedDayWeekday =
    WEEKDAY_FULL_LABELS[selectedCalendarDay?.label] ??
    selectedCalendarDay?.label ??
    "";
  const copyDatePickerValue = useMemo(() => {
    const fallbackDate = new Date();

    if (!copySourceWorkout?.date) {
      return fallbackDate;
    }

    const parsedDate = parseCustomDate(copySourceWorkout.date);
    return Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
  }, [copySourceWorkout?.date]);

  useEffect(() => {
    calendarMountedRef.current = true;

    return () => {
      calendarMountedRef.current = false;
      clearTimeout(monthPagerRecenteringTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    visibleMonthOffsetRef.current = visibleMonthOffset;
  }, [visibleMonthOffset]);

  // The month follows the week on show, so the data loader keeps covering it
  // and switching back to Block lands on the month that week belongs to.
  useEffect(() => {
    if (calendarView !== "week") {
      return;
    }

    const targetMonthOffset = getMonthOffsetForWeek(today, visibleWeekOffset);

    if (targetMonthOffset !== visibleMonthOffsetRef.current) {
      showMonthOffset(targetMonthOffset);
    }
  }, [calendarView, showMonthOffset, today, visibleWeekOffset]);

  useEffect(() => {
    const scrollMode = pendingWeekScrollRef.current;

    if (!scrollMode) {
      return;
    }

    pendingWeekScrollRef.current = null;
    weekPagerRef.current?.scrollTo({
      x: visibleWeekIndex * pageWidth,
      y: 0,
      animated: false,
    });
  }, [pageWidth, visibleWeekIndex, weekOffsetRange.end, weekOffsetRange.start]);

  useEffect(() => {
    const scrollMode = pendingScrollModeRef.current;
    const pageWidthChanged = previousPageWidthRef.current !== pageWidth;
    previousPageWidthRef.current = pageWidth;

    if (!scrollMode && !pageWidthChanged) {
      return;
    }

    pendingScrollModeRef.current = null;
    monthPagerRef.current?.scrollTo({
      x: visibleMonthIndex * pageWidth,
      y: 0,
      animated: scrollMode === "animated" && !pageWidthChanged,
    });
  }, [
    monthOffsetRange.end,
    monthOffsetRange.start,
    pageWidth,
    visibleMonthIndex,
  ]);

  const loadCalendarRows = useCallback(
    async (range) => {
      if (!hasCalendarRange(range)) {
        return {
          workoutRows: [],
          programDayRows: [],
          sicknessRows: [],
        };
      }

      const [workoutRows, programDayRows, sicknessRows] = await Promise.all([
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate: range.startIsoDate,
          endIsoDate: range.endIsoDate,
        }),
        programService.getWorkoutCalendarProgramDays(db, {
          startIsoDate: range.startIsoDate,
          endIsoDate: range.endIsoDate,
        }),
        programService.getSicknessPeriods(db),
      ]);

      return { workoutRows, programDayRows, sicknessRows };
    },
    [db]
  );

  const loadCalendarWorkouts = useCallback(async () => {
    if (!hasCalendarRange(visibleMonthRange)) {
      return;
    }

    const requestId = calendarLoadRequestRef.current + 1;
    calendarLoadRequestRef.current = requestId;
    const isCurrentRequest = () =>
      calendarMountedRef.current && calendarLoadRequestRef.current === requestId;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const visibleRows = await loadCalendarRows(visibleMonthRange);

      if (!isCurrentRequest()) {
        return;
      }

      setWorkouts(visibleRows.workoutRows);
      setProgramDays(visibleRows.programDayRows);
      setSicknessPeriods(visibleRows.sicknessRows);
      setIsLoading(false);
    } catch (error) {
      if (!isCurrentRequest()) {
        return;
      }

      setWorkouts([]);
      setProgramDays([]);
      setSicknessPeriods([]);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load workouts."
      );
      setIsLoading(false);
      return;
    }

    if (
      !hasCalendarRange(calendarRange) ||
      isSameCalendarRange(calendarRange, visibleMonthRange)
    ) {
      return;
    }

    try {
      const prefetchedRows = await loadCalendarRows(calendarRange);

      if (!isCurrentRequest()) {
        return;
      }

      setWorkouts(prefetchedRows.workoutRows);
      setProgramDays(prefetchedRows.programDayRows);
      setSicknessPeriods(prefetchedRows.sicknessRows);
    } catch (prefetchError) {
      console.warn("Could not prefetch adjacent calendar months:", prefetchError);
    }
  }, [
    calendarRange.endIsoDate,
    calendarRange.startIsoDate,
    loadCalendarRows,
    visibleMonthRange,
  ]);

  useEffect(() => {
    loadCalendarWorkoutsRef.current = loadCalendarWorkouts;
  }, [loadCalendarWorkouts]);

  useFocusEffect(
    useCallback(() => {
      loadCalendarWorkouts();
    }, [loadCalendarWorkouts])
  );

  useEffect(() => {
    if (hasSyncedCalendarRef.current) {
      return undefined;
    }

    hasSyncedCalendarRef.current = true;

    const syncTimer = setTimeout(() => {
      programService
        .syncWorkoutTypeInstancesWithCloud(db)
        .then(() => {
          if (!calendarMountedRef.current) {
            return;
          }

          loadCalendarWorkoutsRef.current?.();
        })
        .catch((syncError) => {
          console.warn("Could not refresh workouts for calendar:", syncError);
        });
    }, 0);

    return () => clearTimeout(syncTimer);
  }, [db]);

  const showMonthOffset = useCallback(
    (nextMonthOffset) => {
      pendingScrollModeRef.current = "instant";
      monthPagerRecenteringRef.current = false;
      clearTimeout(monthPagerRecenteringTimeoutRef.current);
      visibleMonthOffsetRef.current = nextMonthOffset;
      setVisibleMonthOffset(nextMonthOffset);
      setMonthOffsetRange(getMonthOffsetRange(nextMonthOffset));
    },
    []
  );

  const showWeekOffset = (nextWeekOffset) => {
    pendingWeekScrollRef.current = "instant";
    weekPagerRecenteringRef.current = false;
    setVisibleWeekOffset(nextWeekOffset);
    setWeekOffsetRange(getWeekOffsetRange(nextWeekOffset));
  };

  const handleWeekScrollEnd = (event) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const weekDelta = nextIndex - visibleWeekIndex;

    if (weekPagerRecenteringRef.current) {
      if (weekDelta === 0) {
        weekPagerRecenteringRef.current = false;
      }

      return;
    }

    if (weekDelta === 0) {
      return;
    }

    const nextWeekOffset = visibleWeekOffset + weekDelta;
    weekPagerRecenteringRef.current = true;
    pendingWeekScrollRef.current = null;
    weekPagerRef.current?.scrollTo({
      x: INITIAL_VISIBLE_MONTH_INDEX * pageWidth,
      y: 0,
      animated: false,
    });
    setVisibleWeekOffset(nextWeekOffset);
    setWeekOffsetRange(getWeekOffsetRange(nextWeekOffset));
  };

  const handleScrollEnd = (event) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / pageWidth
    );
    const clampedIndex = Math.min(
      Math.max(nextIndex, 0),
      monthPages.length - 1
    );
    const monthDelta = clampedIndex - visibleMonthIndex;

    if (monthPagerRecenteringRef.current) {
      if (monthDelta === 0) {
        monthPagerRecenteringRef.current = false;
        clearTimeout(monthPagerRecenteringTimeoutRef.current);
      }

      return;
    }

    if (monthDelta === 0) {
      return;
    }

    const nextMonthOffset = visibleMonthOffsetRef.current + monthDelta;
    monthPagerRecenteringRef.current = true;
    pendingScrollModeRef.current = null;
    visibleMonthOffsetRef.current = nextMonthOffset;
    monthPagerRef.current?.scrollTo({
      x: INITIAL_VISIBLE_MONTH_INDEX * pageWidth,
      y: 0,
      animated: false,
    });
    setVisibleMonthOffset(nextMonthOffset);
    setMonthOffsetRange(getMonthOffsetRange(nextMonthOffset));
    clearTimeout(monthPagerRecenteringTimeoutRef.current);
    monthPagerRecenteringTimeoutRef.current = setTimeout(() => {
      monthPagerRecenteringRef.current = false;
    }, 160);
  };

  const openWorkout = (workout) => {
    if (!workout) {
      return;
    }

    closeDaySheet();
    navigation.navigate("WorkoutPage", {
      workout_id: workout.workout_id,
      workout_label: workout.label,
      workout_type: getWorkoutType(workout),
      day: workout.weekday,
      date: workout.date,
      program_id: workout.program_id,
    });
  };

  // Every gesture on a day opens this one sheet - the date badge, a workout
  // card and a long press alike - and every action for the day lives inside it,
  // so there is a single rule to learn.
  const openDaySheet = (day) => {
    if (!day?.dateLabel) {
      return;
    }

    setSelectedCalendarDay({
      dateLabel: day.dateLabel,
      isoDate: day.isoDate,
      label: day.label,
    });
    setDaySheetVisible(true);
  };

  const closeDaySheet = () => {
    setDaySheetVisible(false);
  };

  const openProgramOverview = (programDay) => {
    closeDaySheet();
    navigation.navigate("ProgramOverviewPage", {
      program_id: programDay.program_id,
      program_name: programDay.program_name,
      start_date: programDay.start_date,
    });
  };

  const beginAddWorkout = () => {
    const programDayRows = selectedDayPrograms;

    closeDaySheet();

    if (programDayRows.length > 1) {
      setProgramTargetModalVisible(true);
      return;
    }

    openAddWorkoutMenu(programDayRows[0] ?? null);
  };

  const chooseProgramTarget = (programDay) => {
    setProgramTargetModalVisible(false);
    openAddWorkoutMenu(programDay);
  };

  const openAddWorkoutMenu = (programDay = null) => {
    if (!selectedCalendarDay) {
      return;
    }

    requestOpenQuickWorkoutMenu({
      date: selectedCalendarDay.dateLabel,
      day: programDay?.weekday ?? selectedCalendarDay.label,
      dayId: programDay?.day_id ?? null,
      programId: programDay?.program_id ?? null,
      programName: programDay?.program_name ?? null,
    });
    setSelectedCalendarDay(null);
  };

  const deleteWorkoutFromCalendar = async (workout) => {
    if (!workout?.workout_id) {
      return;
    }

    // The sheet stays open on purpose: it is derived from the calendar data, so
    // it shows what is left on the day right after the delete.
    try {
      await programService.deleteWorkout(db, workout.workout_id);
      await loadCalendarWorkouts();
    } catch (error) {
      console.error("Failed to delete workout from calendar:", error);
      Alert.alert("Could not delete workout", "Please try again.");
    }
  };

  const confirmDeleteWorkoutFromCalendar = (workout) => {
    if (!workout?.workout_id) {
      return;
    }

    Alert.alert(
      "Delete workout?",
      "This removes the workout and all sets saved inside it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete workout",
          style: "destructive",
          onPress: () => {
            void deleteWorkoutFromCalendar(workout);
          },
        },
      ]
    );
  };

  const completeWorkoutCopy = async () => {
    setPendingCopyTarget(null);
    setCopySourceWorkout(null);
    await loadCalendarWorkouts();
  };

  const copyWorkoutToProgramTarget = async (target) => {
    const workout = pendingCopyTarget?.workout;

    if (!target?.day_id || !workout?.workout_id || isCopyingWorkout) {
      return;
    }

    setIsCopyingWorkout(true);

    try {
      const copiedWorkoutId = await programService.copyWorkoutToProgramDay(db, {
        workoutId: workout.workout_id,
        dayId: target.day_id,
        date: target.date ?? pendingCopyTarget.date,
      });

      if (!copiedWorkoutId) {
        throw new Error("The workout could not be copied.");
      }

      await completeWorkoutCopy();
    } catch (error) {
      console.error("Failed to copy workout to program day:", error);
      Alert.alert("Could not copy workout", "Please try again.");
    } finally {
      setIsCopyingWorkout(false);
    }
  };

  const copyWorkoutToCalendarOnly = async (workout, selectedDate) => {
    if (!workout?.workout_id || isCopyingWorkout) {
      return;
    }

    setIsCopyingWorkout(true);

    try {
      await programService.copyWorkoutToStandaloneDate(db, {
        workoutId: workout.workout_id,
        date: selectedDate,
      });
      await completeWorkoutCopy();
    } catch (error) {
      console.error("Failed to copy workout to calendar:", error);
      Alert.alert("Could not copy workout", "Please try again.");
    } finally {
      setIsCopyingWorkout(false);
    }
  };

  const copyProgramWorkoutToDate = async (workout, selectedDate) => {
    if (!workout?.workout_id || isCopyingWorkout) {
      return;
    }

    setIsCopyingWorkout(true);

    try {
      const copiedWorkoutId = await programService.copyProgramWorkoutToDate(db, {
        workoutId: workout.workout_id,
        programId: workout.program_id,
        date: selectedDate,
      });

      if (!copiedWorkoutId) {
        throw new Error("The workout could not be copied.");
      }

      await completeWorkoutCopy();
    } catch (error) {
      console.error("Failed to copy program workout from calendar:", error);
      Alert.alert("Could not copy workout", "Please try again.");
    } finally {
      setIsCopyingWorkout(false);
    }
  };

  const copyWorkoutToDate = async (workout, selectedDate) => {
    if (!workout?.workout_id || isWorkoutComingSoon(workout)) {
      return;
    }

    if (workout.program_id) {
      await copyProgramWorkoutToDate(workout, selectedDate);
      return;
    }

    try {
      const programTargets = await programService.getWorkoutCopyProgramTargets(db, {
        date: selectedDate,
      });

      if (programTargets.length === 0) {
        await copyWorkoutToCalendarOnly(workout, selectedDate);
        return;
      }

      setPendingCopyTarget({
        workout,
        date: selectedDate,
        dateLabel: formatLocalDate(selectedDate),
        programTargets,
      });
      setCopySourceWorkout(null);
    } catch (error) {
      console.error("Failed to resolve workout copy target:", error);
      Alert.alert("Could not copy workout", "Please try again.");
    }
  };

  const closeCopyTargetModal = () => {
    if (isCopyingWorkout) {
      return;
    }

    setPendingCopyTarget(null);
  };

  const startWorkoutCopy = (workout) => {
    if (!workout?.workout_id) {
      return;
    }

    closeDaySheet();
    setCopySourceWorkout(workout);
    setCopyDatePickerVisible(true);
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        rightWidth={92}
        right={
          <View style={styles.monthControls}>
            <TouchableOpacity
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              activeOpacity={0.78}
              onPress={() => showMonthOffset(visibleMonthOffset - 1)}
              style={[
                styles.monthControl,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ArrowLeft width={20} height={20} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Next month"
              accessibilityRole="button"
              activeOpacity={0.78}
              onPress={() => showMonthOffset(visibleMonthOffset + 1)}
              style={[
                styles.monthControl,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.nextMonthIcon}>
                <ArrowLeft width={20} height={20} />
              </View>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.headerTitleGroup}>
          <ThemedTitle type="pageTitle" numberOfLines={1}>
            Calendar
          </ThemedTitle>
          {monthSummaryText ? (
            <ThemedText style={styles.monthMeta} setColor={quietText}>
              {monthSummaryText}
            </ThemedText>
          ) : null}
        </View>
      </ThemedHeader>

      {errorMessage ? (
        <ThemedStateBlock
          fill
          variant="error"
          title="Calendar unavailable"
          message={errorMessage}
          actionLabel="Try again"
          actionDisabled={isLoading}
          onAction={() => {
            void loadCalendarWorkouts();
          }}
        />
      ) : calendarView === "week" ? (
        <ScrollView
          ref={weekPagerRef}
          style={styles.monthPager}
          horizontal
          pagingEnabled
          contentOffset={{ x: INITIAL_VISIBLE_MONTH_INDEX * pageWidth, y: 0 }}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleWeekScrollEnd}
          scrollEventThrottle={16}
        >
          {weekPages.map((weekPage) => (
            <ScrollView
              key={weekPage.key}
              style={[styles.monthPage, { width: pageWidth }]}
              contentContainerStyle={styles.monthPageContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.monthSectionHeader}>
                <ThemedText
                  style={styles.sectionEyebrow}
                  setColor={primaryTextColor}
                >
                  {getWeekPageTitle(weekPage)}
                </ThemedText>

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Change calendar layout"
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setViewMenuVisible(true)}
                    style={[
                      styles.viewPill,
                      {
                        backgroundColor: cardSurface,
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.viewPillText}
                      setColor={titleColor}
                    >
                      {CALENDAR_VIEWS.find(
                        (view) => view.value === calendarView
                      )?.label ?? "Block"}
                    </ThemedText>
                    <View style={styles.viewPillChevron}>
                      <ChevronRight
                        width={13}
                        height={13}
                        color={quietText}
                        thickness={2.4}
                      />
                    </View>
                  </TouchableOpacity>
                </View>

              <CalendarWeekView
                week={buildWeek(weekPage)}
                weekLabel={getWeekPageLabel(weekPage)}
                canGoBack
                canGoForward
                onPrevious={() => showWeekOffset(weekPage.weekOffset - 1)}
                onNext={() => showWeekOffset(weekPage.weekOffset + 1)}
                onOpenWorkout={(workout, day) =>
                  workout ? openWorkout(workout) : openDaySheet(day)
                }
                onOpenDay={openDaySheet}
                palette={gridPalette}
              />
            </ScrollView>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          ref={monthPagerRef}
          style={styles.monthPager}
          horizontal
          pagingEnabled
          contentOffset={{ x: INITIAL_VISIBLE_MONTH_INDEX * pageWidth, y: 0 }}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
        >
          {monthPages.map((monthPage) => (
            <ScrollView
              key={monthPage.key}
              style={[styles.monthPage, { width: pageWidth }]}
              contentContainerStyle={styles.monthPageContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.monthSectionHeader}>
                <ThemedText
                  style={styles.sectionEyebrow}
                  setColor={primaryTextColor}
                >
                  {monthPage.title}
                </ThemedText>

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Change calendar layout"
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setViewMenuVisible(true)}
                    style={[
                      styles.viewPill,
                      {
                        backgroundColor: cardSurface,
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.viewPillText}
                      setColor={titleColor}
                    >
                      {CALENDAR_VIEWS.find(
                        (view) => view.value === calendarView
                      )?.label ?? "Block"}
                    </ThemedText>
                    <View style={styles.viewPillChevron}>
                      <ChevronRight
                        width={13}
                        height={13}
                        color={quietText}
                        thickness={2.4}
                      />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.weekdayHeaderRow} pointerEvents="none">
                  {WEEKDAY_LABELS.map((weekdayLabel) => (
                    <View
                      key={`${monthPage.key}-${weekdayLabel}`}
                      style={styles.weekdayHeaderCell}
                    >
                      <ThemedText
                        style={styles.weekdayHeaderText}
                        setColor={quietText}
                      >
                        {weekdayLabel}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {monthPage.weeks.map((week, weekIndex) => (
                    <View key={`${monthPage.key}-${weekIndex}`} style={styles.weekRow}>
                      {week.map((day) => {
                        const dayWorkouts = workoutsByDate.get(day.dateLabel) ?? [];
                        const dayProgramRows = programsByDate.get(day.dateLabel) ?? [];
                        const dayHasProgram = programDates.has(day.dateLabel);
                        const dayIsSick =
                          sickDates.has(day.dateLabel) ||
                          dayProgramRows.some(isProgramDaySick);
                        const dayHasWorkouts = dayWorkouts.length > 0;
                        const dayCompleted =
                          dayHasWorkouts &&
                          dayWorkouts.every((workout) => Number(workout.done) === 1);
                        const dayOverdue =
                          !dayIsSick &&
                          day.isoDate < todayIsoDate &&
                          dayWorkouts.some((workout) => Number(workout.done) !== 1);
                        const workoutCards = dayWorkouts.map((workout) => {
                          const iconConfig = getWorkoutIconConfig(getWorkoutType(workout));
                          const isCompleted = Number(workout.done) === 1;
                          const isPastWorkout = day.isoDate < todayIsoDate;

                          return {
                            key: workout.workout_id,
                            workout,
                            icon: iconConfig?.Icon,
                            iconLabel: iconConfig?.short ?? getWorkoutIconLabel(workout),
                            completed: isCompleted,
                            hasPersonalRecord: Number(workout.has_personal_record) === 1,
                            sickCompleted: dayIsSick && isCompleted,
                            overdue: !dayIsSick && isPastWorkout && !isCompleted,
                            sickOverdue: dayIsSick && isPastWorkout && !isCompleted,
                          };
                        });

                        return (
                          <View
                            key={`${monthPage.key}-${day.dateLabel}`}
                            style={[
                              styles.daySlot,
                              !day.inMonth && styles.daySlotOutsideMonth,
                            ]}
                          >
                            <WeekdayIndicator
                              label={day.label}
                              dateLabel={day.dateLabel}
                              active={day.dateLabel === todayLabel}
                              completed={dayCompleted}
                              isSick={dayIsSick}
                              overdue={dayOverdue}
                              programActive={dayHasProgram}
                              compact
                              showWeekdayLabel={false}
                              showMonthLabel={false}
                              workoutCards={workoutCards}
                              onWorkoutPress={() => openDaySheet(day)}
                              onDayLongPress={() => openDaySheet(day)}
                              onDayPress={() => openDaySheet(day)}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <View style={styles.weekListSection}>
                  <View
                    style={[
                      styles.weekListHeader,
                      { borderTopColor: cardBorder },
                    ]}
                  >
                    <ThemedText
                      style={styles.sectionEyebrow}
                      setColor={primaryTextColor}
                    >
                      Workouts
                    </ThemedText>
                  </View>

                  {buildMonthWeeks(monthPage).map((week) => (
                    <View key={week.key} style={styles.weekListRow}>
                      <View style={gridStyles.weekGrid}>
                        {week.days.map((day) => (
                          <Pressable
                            key={`${week.key}-${day.dateLabel}`}
                            accessibilityRole="button"
                            accessibilityLabel={`${day.label} ${day.dateLabel}`}
                            style={[
                              gridStyles.cellSlot,
                              !day.inMonth && styles.daySlotOutsideMonth,
                            ]}
                            onPress={() => openDaySheet(day)}
                            onLongPress={() => openDaySheet(day)}
                          >
                            <DayCell
                              day={day}
                              showRestDate
                              palette={gridPalette}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
            </ScrollView>
          ))}
        </ScrollView>
      )}

      <ThemedBottomSheet
        visible={viewMenuVisible}
        onClose={() => setViewMenuVisible(false)}
      >
        <ThemedText style={styles.viewMenuTitle} setColor={quietText}>
          Layout
        </ThemedText>

        {CALENDAR_VIEWS.map((view) => (
          <TouchableOpacity
            key={view.value}
            accessibilityRole="button"
            accessibilityState={{ selected: calendarView === view.value }}
            activeOpacity={0.82}
            onPress={() => {
              setCalendarView(view.value);
              setViewMenuVisible(false);
            }}
            style={styles.viewMenuOption}
          >
            <ThemedText
              style={styles.viewMenuOptionText}
              setColor={
                calendarView === view.value ? primaryTextColor : titleColor
              }
            >
              {view.label}
            </ThemedText>

            {calendarView === view.value ? (
              <Checkmark width={16} height={16} color={primaryColor} />
            ) : null}
          </TouchableOpacity>
        ))}
      </ThemedBottomSheet>

      <ThemedBottomSheet
        visible={daySheetVisible}
        onClose={closeDaySheet}
        footer={
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={beginAddWorkout}
            style={[
              styles.daySheetAddButton,
              { backgroundColor: primaryColor },
            ]}
          >
            <PlusCircled width={20} height={20} color={actionTextColor} />
            <ThemedText
              style={styles.daySheetAddText}
              setColor={actionTextColor}
            >
              Add workout
            </ThemedText>
          </TouchableOpacity>
        }
      >
        <View style={[styles.daySheetHeader, { borderBottomColor: cardBorder }]}>
          <View style={styles.daySheetHeaderText}>
            <ThemedText style={styles.daySheetEyebrow} setColor={primaryTextColor}>
              {selectedDayWeekday}
            </ThemedText>
            <ThemedText style={styles.daySheetTitle} setColor={titleColor}>
              {selectedCalendarDay?.dateLabel ?? ""}
            </ThemedText>
          </View>

          {selectedDayIsSick || selectedDayIsToday ? (
            <View
              style={[
                styles.daySheetBadge,
                { backgroundColor: selectedDayIsSick ? sickColor : primaryColor },
              ]}
            >
              <ThemedText
                style={styles.daySheetBadgeText}
                setColor={actionTextColor}
              >
                {selectedDayIsSick ? "SICK DAY" : "TODAY"}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {selectedDayWorkouts.length > 0 && (
          <ThemedText style={styles.daySheetSectionLabel} setColor={quietText}>
            {selectedDayWorkouts.length === 1
              ? "1 workout"
              : `${selectedDayWorkouts.length} workouts`}
          </ThemedText>
        )}

        {selectedDayWorkouts.length === 0 ? (
          <ThemedText style={styles.daySheetEmptyText} setColor={quietText}>
            Nothing planned on this day yet.
          </ThemedText>
        ) : (
          <View style={styles.daySheetList}>
            {selectedDayWorkouts.map((workout) => {
              const iconConfig = getWorkoutIconConfig(getWorkoutType(workout));
              const WorkoutIcon = iconConfig?.Icon;
              const status = getWorkoutDayStatus(workout, {
                isSick: selectedDayIsSick,
                isPast: selectedDayIsPast,
              });
              const statusColor =
                status.tone === "record"
                  ? recordColor
                  : status.tone === "done"
                  ? secondaryColor
                  : status.tone === "sick"
                  ? sickColor
                  : status.tone === "overdue"
                    ? dangerColor
                    : primaryColor;
              const comingSoon = isWorkoutComingSoon(workout);

              return (
                <View
                  key={workout.workout_id}
                  style={[
                    styles.dayWorkoutCard,
                    {
                      backgroundColor: modalCardSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.82}
                    onPress={() => openWorkout(workout)}
                    style={styles.dayWorkoutMain}
                  >
                    <View
                      style={[
                        styles.dayWorkoutIcon,
                        { backgroundColor: statusColor },
                      ]}
                    >
                      {WorkoutIcon ? (
                        <WorkoutIcon
                          width={20}
                          height={20}
                          color={cardSurface}
                          fill={cardSurface}
                          primaryColor={cardSurface}
                          backgroundColor="transparent"
                        />
                      ) : (
                        <ThemedText
                          style={styles.dayWorkoutIconLabel}
                          setColor={cardSurface}
                        >
                          {iconConfig?.short ?? getWorkoutIconLabel(workout)}
                        </ThemedText>
                      )}
                    </View>

                    <View style={styles.dayWorkoutText}>
                      <ThemedText
                        style={styles.dayWorkoutName}
                        setColor={titleColor}
                        numberOfLines={1}
                      >
                        {workout.label ?? getWorkoutType(workout)}
                      </ThemedText>
                      <ThemedText
                        style={styles.dayWorkoutStatus}
                        setColor={statusColor}
                      >
                        {status.label}
                      </ThemedText>
                      {!!workout.program_name && (
                        <ThemedText
                          style={styles.dayWorkoutMeta}
                          setColor={quietText}
                          numberOfLines={1}
                        >
                          {workout.program_name}
                        </ThemedText>
                      )}
                    </View>

                    <ChevronRight width={18} height={18} color={quietText} />
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.dayWorkoutActions,
                      { borderTopColor: cardBorder },
                    ]}
                  >
                    {!comingSoon && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        activeOpacity={0.78}
                        onPress={() => startWorkoutCopy(workout)}
                        style={styles.dayWorkoutAction}
                      >
                        <Copy width={17} height={17} />
                        <ThemedText
                          style={styles.dayWorkoutActionText}
                          setColor={secondaryColor}
                        >
                          Copy to date
                        </ThemedText>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      accessibilityRole="button"
                      activeOpacity={0.78}
                      onPress={() => confirmDeleteWorkoutFromCalendar(workout)}
                      style={styles.dayWorkoutAction}
                    >
                      <Delete width={17} height={17} color={dangerColor} />
                      <ThemedText
                        style={styles.dayWorkoutActionText}
                        setColor={dangerColor}
                      >
                        Delete
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {selectedDayPrograms.length > 0 && (
          <View>
            <ThemedText
              style={styles.daySheetSectionLabel}
              setColor={quietText}
            >
              {selectedDayPrograms.length === 1 ? "Program" : "Programs"}
            </ThemedText>

            <View style={styles.daySheetList}>
              {selectedDayPrograms.map((programDay) => (
                <TouchableOpacity
                  key={`${programDay.program_id}-${programDay.day_id}`}
                  accessibilityRole="button"
                  activeOpacity={0.82}
                  onPress={() => openProgramOverview(programDay)}
                  style={[
                    styles.dayProgramRow,
                    {
                      backgroundColor: modalCardSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.programDayDot,
                      { backgroundColor: primaryColor },
                    ]}
                  />
                  <View style={styles.programDayText}>
                    <ThemedText
                      style={styles.programDayName}
                      setColor={titleColor}
                      numberOfLines={1}
                    >
                      {programDay.program_name}
                    </ThemedText>
                    <ThemedText
                      style={styles.programDayMeta}
                      setColor={quietText}
                    >
                      {getProgramDayLocation(programDay)}
                    </ThemedText>
                  </View>
                  <ChevronRight width={18} height={18} color={quietText} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ThemedBottomSheet>

      {copyDatePickerVisible && (
        <DateTimePicker
          value={copyDatePickerValue}
          mode="date"
          display="default"
          onChange={async (event, selectedDate) => {
            const sourceWorkout = copySourceWorkout;
            setCopyDatePickerVisible(false);

            if (event.type !== "set" || !selectedDate || !sourceWorkout) {
              setCopySourceWorkout(null);
              return;
            }

            await copyWorkoutToDate(sourceWorkout, selectedDate);
          }}
        />
      )}

      <ThemedModal
        visible={programTargetModalVisible}
        onClose={() => setProgramTargetModalVisible(false)}
        title="Choose program"
        style={styles.programTargetModal}
        contentStyle={styles.programTargetModalBody}
      >
        <ThemedText style={styles.programTargetDate} setColor={quietText}>
          Add workout on {selectedCalendarDay?.dateLabel ?? ""}
        </ThemedText>
        <ScrollView
          style={styles.programTargetList}
          contentContainerStyle={styles.programTargetListContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedDayPrograms.map((programDay) => (
            <TouchableOpacity
              key={`${programDay.program_id}-${programDay.day_id}`}
              activeOpacity={0.82}
              onPress={() => chooseProgramTarget(programDay)}
              style={[
                styles.programTargetOption,
                {
                  backgroundColor: modalCardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ThemedText
                style={styles.programTargetName}
                setColor={titleColor}
              >
                {getProgramCopyLocation(programDay)}
              </ThemedText>
              <ThemedText style={styles.programTargetMeta} setColor={quietText}>
                {programDay.program_name ?? "Program"}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedModal>

      <WorkoutCopyTargetModal
        visible={Boolean(pendingCopyTarget)}
        onClose={closeCopyTargetModal}
        dateLabel={pendingCopyTarget?.dateLabel}
        programTargets={pendingCopyTarget?.programTargets ?? []}
        isSubmitting={isCopyingWorkout}
        onConfirmProgramTarget={copyWorkoutToProgramTarget}
        onConfirmSingleWorkout={() =>
          copyWorkoutToCalendarOnly(
            pendingCopyTarget?.workout,
            pendingCopyTarget?.date
          )
        }
      />

    </ThemedView>
  );
};

export default WorkoutCalendarPage;
