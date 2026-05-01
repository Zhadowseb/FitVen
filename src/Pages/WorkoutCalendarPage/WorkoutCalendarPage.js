import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./WorkoutCalendarPageStyle";
import { programService } from "../../Services";
import { Colors } from "../../Resources/GlobalStyling/colors";
import ArrowLeft from "../../Resources/Icons/UI-icons/ArrowLeft";
import { getWorkoutIconConfig } from "../../Resources/Icons/WorkoutLabels";
import WeekdayIndicator from "../../Resources/Figures/WeekdayIndicator";
import {
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const INITIAL_MONTHS_BEFORE_TODAY = 12;
const INITIAL_MONTHS_AFTER_TODAY = 12;
const MONTH_PAGE_BATCH_SIZE = 12;
const MONTH_PAGE_LOAD_THRESHOLD = 2;
const INITIAL_MONTH_OFFSET_RANGE = {
  start: -INITIAL_MONTHS_BEFORE_TODAY,
  end: INITIAL_MONTHS_AFTER_TODAY,
};
const INITIAL_VISIBLE_MONTH_OFFSET = 0;
const INITIAL_VISIBLE_MONTH_INDEX =
  INITIAL_VISIBLE_MONTH_OFFSET - INITIAL_MONTH_OFFSET_RANGE.start;
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

const WorkoutCalendarPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const monthPagerRef = useRef(null);
  const monthOffsetRangeRef = useRef(INITIAL_MONTH_OFFSET_RANGE);
  const visibleMonthOffsetRef = useRef(INITIAL_VISIBLE_MONTH_OFFSET);
  const pendingScrollModeRef = useRef("instant");
  const previousPageWidthRef = useRef(null);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(width, 1);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayLabel = useMemo(() => formatLocalDate(today), [today]);
  const todayIsoDate = useMemo(() => formatIsoDate(today), [today]);
  const [workouts, setWorkouts] = useState([]);
  const [programDays, setProgramDays] = useState([]);
  const [monthOffsetRange, setMonthOffsetRange] = useState(
    INITIAL_MONTH_OFFSET_RANGE
  );
  const [visibleMonthOffset, setVisibleMonthOffset] = useState(
    INITIAL_VISIBLE_MONTH_OFFSET
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
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
  const programDates = useMemo(
    () => new Set(programDays.map((programDay) => programDay.date).filter(Boolean)),
    [programDays]
  );
  const visibleMonth = monthPages[visibleMonthIndex] ?? monthPages[0];
  const visibleMonthKey = visibleMonth ? getMonthKey(visibleMonth.monthDate) : "";
  const visibleMonthWorkouts = workouts.filter((workout) =>
    String(workout?.date_iso ?? "").startsWith(visibleMonthKey)
  );
  const visibleMonthDoneCount = visibleMonthWorkouts.filter(
    (workout) => Number(workout.done) === 1
  ).length;

  useEffect(() => {
    monthOffsetRangeRef.current = monthOffsetRange;
  }, [monthOffsetRange]);

  useEffect(() => {
    visibleMonthOffsetRef.current = visibleMonthOffset;
  }, [visibleMonthOffset]);

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
  }, [monthPages.length, pageWidth, visibleMonthIndex]);

  const loadCalendarWorkouts = useCallback(async () => {
    if (!calendarRange.startIsoDate || !calendarRange.endIsoDate) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      try {
        await programService.syncWorkoutTypeInstancesWithCloud(db);
      } catch (syncError) {
        console.warn("Could not refresh workouts before loading calendar:", syncError);
      }

      const [workoutRows, programDayRows] = await Promise.all([
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate: calendarRange.startIsoDate,
          endIsoDate: calendarRange.endIsoDate,
        }),
        programService.getWorkoutCalendarProgramDays(db, {
          startIsoDate: calendarRange.startIsoDate,
          endIsoDate: calendarRange.endIsoDate,
        }),
      ]);

      setWorkouts(workoutRows);
      setProgramDays(programDayRows);
    } catch (error) {
      setWorkouts([]);
      setProgramDays([]);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load workouts."
      );
    } finally {
      setIsLoading(false);
    }
  }, [calendarRange.endIsoDate, calendarRange.startIsoDate, db]);

  useFocusEffect(
    useCallback(() => {
      loadCalendarWorkouts();
    }, [loadCalendarWorkouts])
  );

  const getRangeForMonthOffset = useCallback((monthOffset, range) => {
    let nextRange = range;
    const monthsBeforeOffset = monthOffset - nextRange.start;
    const monthsAfterOffset = nextRange.end - monthOffset;

    if (monthsBeforeOffset <= MONTH_PAGE_LOAD_THRESHOLD) {
      const monthsToAdd = Math.max(
        MONTH_PAGE_BATCH_SIZE,
        MONTH_PAGE_LOAD_THRESHOLD - monthsBeforeOffset + 1
      );
      nextRange = {
        ...nextRange,
        start: nextRange.start - monthsToAdd,
      };
    }

    if (monthsAfterOffset <= MONTH_PAGE_LOAD_THRESHOLD) {
      const monthsToAdd = Math.max(
        MONTH_PAGE_BATCH_SIZE,
        MONTH_PAGE_LOAD_THRESHOLD - monthsAfterOffset + 1
      );
      nextRange = {
        ...nextRange,
        end: nextRange.end + monthsToAdd,
      };
    }

    return nextRange;
  }, []);

  const setLoadedMonthRange = useCallback(
    (monthOffset, scrollMode) => {
      setMonthOffsetRange((currentRange) => {
        const nextRange = getRangeForMonthOffset(monthOffset, currentRange);

        if (
          nextRange.start === currentRange.start &&
          nextRange.end === currentRange.end
        ) {
          return currentRange;
        }

        pendingScrollModeRef.current = scrollMode;
        monthOffsetRangeRef.current = nextRange;
        return nextRange;
      });
    },
    [getRangeForMonthOffset]
  );

  const showMonthOffset = useCallback(
    (nextMonthOffset) => {
      pendingScrollModeRef.current = "animated";
      visibleMonthOffsetRef.current = nextMonthOffset;
      setLoadedMonthRange(nextMonthOffset, "animated");
      setVisibleMonthOffset(nextMonthOffset);
    },
    [setLoadedMonthRange]
  );

  const handleScrollEnd = (event) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / pageWidth
    );
    const clampedIndex = Math.min(
      Math.max(nextIndex, 0),
      monthPages.length - 1
    );
    const nextMonthOffset = monthOffsetRange.start + clampedIndex;
    visibleMonthOffsetRef.current = nextMonthOffset;
    setLoadedMonthRange(nextMonthOffset, "instant");
    setVisibleMonthOffset(nextMonthOffset);
  };

  const openWorkout = (workout) => {
    if (!workout) {
      return;
    }

    navigation.navigate("WorkoutPage", {
      workout_id: workout.workout_id,
      workout_label: workout.label,
      workout_type: getWorkoutType(workout),
      day: workout.weekday,
      date: workout.date,
      program_id: workout.program_id,
    });
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText style={styles.eyebrow} setColor={primaryColor}>
            CALENDAR
          </ThemedText>
          <ThemedTitle type="h2" style={[styles.title, { color: titleColor }]}>
            Workout Calendar
          </ThemedTitle>
        </View>

        <View
          style={[
            styles.summaryPill,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.summaryValue} setColor={titleColor}>
            {visibleMonthWorkouts.length}
          </ThemedText>
          <ThemedText style={styles.summaryLabel} setColor={quietText}>
            workouts
          </ThemedText>
        </View>
      </View>

      <View style={styles.monthHeader}>
        <View style={styles.monthHeaderText}>
          <ThemedTitle type="h3" style={styles.monthTitle}>
            {visibleMonth?.title ?? ""}
          </ThemedTitle>
          <ThemedText style={styles.monthMeta} setColor={quietText}>
            {visibleMonthDoneCount}/{visibleMonthWorkouts.length} done
          </ThemedText>
        </View>

        <View style={styles.monthActions}>
          {isLoading ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : null}

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
        </View>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.stateCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.stateText} setColor={quietText}>
            {errorMessage}
          </ThemedText>
        </View>
      ) : null}

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
          <View
            key={monthPage.key}
            style={[styles.monthPage, { width: pageWidth }]}
          >
            <View style={styles.calendarGrid}>
              {monthPage.weeks.map((week, weekIndex) => (
                <View key={`${monthPage.key}-${weekIndex}`} style={styles.weekRow}>
                  {week.map((day) => {
                    const dayWorkouts = workoutsByDate.get(day.dateLabel) ?? [];
                    const dayHasProgram = programDates.has(day.dateLabel);
                    const dayHasWorkouts = dayWorkouts.length > 0;
                    const dayCompleted =
                      dayHasWorkouts &&
                      dayWorkouts.every((workout) => Number(workout.done) === 1);
                    const dayOverdue =
                      day.isoDate < todayIsoDate &&
                      dayWorkouts.some((workout) => Number(workout.done) !== 1);
                    const workoutCards = dayWorkouts.map((workout) => {
                      const iconConfig = getWorkoutIconConfig(getWorkoutType(workout));
                      const isCompleted = Number(workout.done) === 1;

                      return {
                        key: workout.workout_id,
                        workout,
                        icon: iconConfig?.Icon,
                        iconLabel: iconConfig?.short ?? getWorkoutIconLabel(workout),
                        completed: isCompleted,
                        overdue: day.isoDate < todayIsoDate && !isCompleted,
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
                          overdue={dayOverdue}
                          programActive={dayHasProgram}
                          workoutCards={workoutCards}
                          onWorkoutPress={openWorkout}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {visibleMonthWorkouts.length === 0 && monthPage.key === visibleMonthKey ? (
              <View style={styles.emptyMonth}>
                <View
                  style={[
                    styles.emptyDot,
                    { backgroundColor: secondaryColor },
                  ]}
                />
                <ThemedText style={styles.emptyText} setColor={quietText}>
                  No workouts this month.
                </ThemedText>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
};

export default WorkoutCalendarPage;
