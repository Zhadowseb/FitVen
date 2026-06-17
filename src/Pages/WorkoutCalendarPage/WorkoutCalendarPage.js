import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import ArrowLeft from "../../Resources/Icons/UI-icons/ArrowLeft";
import Copy from "../../Resources/Icons/UI-icons/Copy";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import PlusCircled from "../../Resources/Icons/UI-icons/PlusCircled";
import { getWorkoutIconConfig } from "../../Resources/Icons/WorkoutLabels";
import WeekdayIndicator from "../../Resources/Figures/WeekdayIndicator";
import PickWorkoutModal from "../WeekPage/Components/Day/Components/PickWorkoutModal/PickWorkoutModal";
import {
  ThemedText,
  ThemedTitle,
  ThemedModal,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { parseCustomDate } from "../../Utils/dateUtils";
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
const DAY_CONTEXT_MENU_WIDTH = 266;
const DAY_CONTEXT_MENU_HEIGHT = 274;
const DAY_CONTEXT_MENU_MARGIN = 18;
const WORKOUT_PICK_MODE = {
  COPY: "copy",
  DELETE: "delete",
};

const DayContextMenuAction = ({
  children,
  icon,
  onPress,
  textColor,
}) => (
  <TouchableOpacity
    activeOpacity={0.78}
    onPress={onPress}
    style={styles.dayContextAction}
  >
    <View style={styles.dayContextActionIcon}>{icon}</View>
    <ThemedText style={styles.dayContextActionText} setColor={textColor}>
      {children}
    </ThemedText>
  </TouchableOpacity>
);

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

function getMonthOffsetRange(monthOffset) {
  return {
    start: monthOffset - ADJACENT_MONTH_COUNT,
    end: monthOffset + ADJACENT_MONTH_COUNT,
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
      ? `Mesocycle ${programDay.mesocycle_number}`
      : null,
    programDay?.microcycle_number ? `Week ${programDay.microcycle_number}` : null,
    [programDay?.weekday, programDay?.date].filter(Boolean).join(" "),
  ].filter(Boolean);

  return locationParts.length ? locationParts.join(" - ") : "Program day";
}

function getProgramCopyLocation(programDay) {
  return `Add to ${getProgramDayLocation(programDay)}`;
}

const WorkoutCalendarPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const monthPagerRef = useRef(null);
  const visibleMonthOffsetRef = useRef(INITIAL_VISIBLE_MONTH_OFFSET);
  const pendingScrollModeRef = useRef("instant");
  const previousPageWidthRef = useRef(null);
  const hasSyncedCalendarRef = useRef(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { width, height } = useWindowDimensions();
  const pageWidth = Math.max(width, 1);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayLabel = useMemo(() => formatLocalDate(today), [today]);
  const todayIsoDate = useMemo(() => formatIsoDate(today), [today]);
  const [workouts, setWorkouts] = useState([]);
  const [programDays, setProgramDays] = useState([]);
  const [sicknessPeriods, setSicknessPeriods] = useState([]);
  const [selectedProgramDate, setSelectedProgramDate] = useState(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [dayOptionsVisible, setDayOptionsVisible] = useState(false);
  const [dayOptionsPosition, setDayOptionsPosition] = useState({
    left: DAY_CONTEXT_MENU_MARGIN,
    top: 120,
  });
  const [programTargetModalVisible, setProgramTargetModalVisible] =
    useState(false);
  const [pickWorkoutModalVisible, setPickWorkoutModalVisible] = useState(false);
  const [workoutPickMode, setWorkoutPickMode] = useState(null);
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
  const [isCopyingWorkout, setIsCopyingWorkout] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const modalCardSurface = theme.fields ?? theme.cardBackground ?? theme.background;
  const actionTextColor = theme.textInverted ?? theme.cardBackground ?? "#141414";
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
  const visibleMonthKey = visibleMonth ? getMonthKey(visibleMonth.monthDate) : "";
  const visibleMonthWorkouts = workouts.filter((workout) =>
    String(workout?.date_iso ?? "").startsWith(visibleMonthKey)
  );
  const visibleMonthDoneCount = visibleMonthWorkouts.filter(
    (workout) => Number(workout.done) === 1
  ).length;
  const selectedProgramDayRows = selectedProgramDate
    ? programsByDate.get(selectedProgramDate) ?? []
    : [];
  const selectedProgramModalTitle =
    selectedProgramDayRows.length === 1
      ? selectedProgramDayRows[0].program_name
      : selectedProgramDate
        ? `Programs on ${selectedProgramDate}`
        : "Programs";
  const copyDatePickerValue = useMemo(() => {
    const fallbackDate = new Date();

    if (!copySourceWorkout?.date) {
      return fallbackDate;
    }

    const parsedDate = parseCustomDate(copySourceWorkout.date);
    return Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;
  }, [copySourceWorkout?.date]);

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
  }, [
    monthOffsetRange.end,
    monthOffsetRange.start,
    pageWidth,
    visibleMonthIndex,
  ]);

  const loadCalendarWorkouts = useCallback(async () => {
    if (!calendarRange.startIsoDate || !calendarRange.endIsoDate) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      if (!hasSyncedCalendarRef.current) {
        hasSyncedCalendarRef.current = true;

        try {
          await programService.syncWorkoutTypeInstancesWithCloud(db);
        } catch (syncError) {
          console.warn("Could not refresh workouts before loading calendar:", syncError);
        }
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
      const sicknessRows = await programService.getSicknessPeriods(db);

      setWorkouts(workoutRows);
      setProgramDays(programDayRows);
      setSicknessPeriods(sicknessRows);
    } catch (error) {
      setWorkouts([]);
      setProgramDays([]);
      setSicknessPeriods([]);
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

  const showMonthOffset = useCallback(
    (nextMonthOffset) => {
      pendingScrollModeRef.current = "instant";
      visibleMonthOffsetRef.current = nextMonthOffset;
      setVisibleMonthOffset(nextMonthOffset);
      setMonthOffsetRange(getMonthOffsetRange(nextMonthOffset));
    },
    []
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
    pendingScrollModeRef.current = "instant";
    visibleMonthOffsetRef.current = nextMonthOffset;
    setVisibleMonthOffset(nextMonthOffset);
    setMonthOffsetRange(getMonthOffsetRange(nextMonthOffset));
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

  const openProgramDayModal = (day) => {
    const datePrograms = programsByDate.get(day?.dateLabel) ?? [];

    if (datePrograms.length === 0) {
      return;
    }

    setSelectedProgramDate(day.dateLabel);
  };

  const closeProgramDayModal = () => {
    setSelectedProgramDate(null);
  };

  const openProgramOverview = (programDay) => {
    closeProgramDayModal();
    navigation.navigate("ProgramOverviewPage", {
      program_id: programDay.program_id,
      program_name: programDay.program_name,
      start_date: programDay.start_date,
    });
  };

  const closeDayOptions = () => {
    setDayOptionsVisible(false);
  };

  const handleDayLongPress = (day, event) => {
    const pageX = event?.nativeEvent?.pageX ?? width / 2;
    const pageY = event?.nativeEvent?.pageY ?? 160;
    const maxLeft = Math.max(
      DAY_CONTEXT_MENU_MARGIN,
      width - DAY_CONTEXT_MENU_WIDTH - DAY_CONTEXT_MENU_MARGIN
    );
    const maxTop = Math.max(
      DAY_CONTEXT_MENU_MARGIN,
      height - DAY_CONTEXT_MENU_HEIGHT - DAY_CONTEXT_MENU_MARGIN
    );

    setSelectedCalendarDay({
      ...day,
      programDays: programsByDate.get(day.dateLabel) ?? [],
      workouts: workoutsByDate.get(day.dateLabel) ?? [],
    });
    setDayOptionsPosition({
      left: Math.min(Math.max(DAY_CONTEXT_MENU_MARGIN, pageX - 42), maxLeft),
      top: Math.min(Math.max(DAY_CONTEXT_MENU_MARGIN, pageY - 48), maxTop),
    });
    setDayOptionsVisible(true);
  };

  const beginAddWorkout = () => {
    const programDayRows = selectedCalendarDay?.programDays ?? [];

    closeDayOptions();

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

    try {
      await programService.deleteWorkout(db, workout.workout_id);
      setPickWorkoutModalVisible(false);
      setWorkoutPickMode(null);
      setDayOptionsVisible(false);
      setSelectedCalendarDay(null);
      await loadCalendarWorkouts();
    } catch (error) {
      console.error("Failed to delete workout from calendar:", error);
      Alert.alert("Could not delete workout", "Please try again.");
    }
  };

  const completeWorkoutCopy = async () => {
    setPendingCopyTarget(null);
    setCopySourceWorkout(null);
    setSelectedCalendarDay(null);
    setDayOptionsVisible(false);
    setPickWorkoutModalVisible(false);
    setWorkoutPickMode(null);
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
    if (!workout?.workout_id) {
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

    closeDayOptions();
    setCopySourceWorkout(workout);
    setPickWorkoutModalVisible(false);
    setWorkoutPickMode(null);
    setCopyDatePickerVisible(true);
  };

  const beginCopyWorkout = () => {
    const dayWorkouts = selectedCalendarDay?.workouts ?? [];

    if (dayWorkouts.length === 0) {
      return;
    }

    if (dayWorkouts.length === 1) {
      startWorkoutCopy(dayWorkouts[0]);
      return;
    }

    closeDayOptions();
    setWorkoutPickMode(WORKOUT_PICK_MODE.COPY);
    setPickWorkoutModalVisible(true);
  };

  const beginDeleteWorkout = () => {
    const dayWorkouts = selectedCalendarDay?.workouts ?? [];

    if (dayWorkouts.length === 1) {
      deleteWorkoutFromCalendar(dayWorkouts[0]);
      return;
    }

    closeDayOptions();
    setWorkoutPickMode(WORKOUT_PICK_MODE.DELETE);
    setPickWorkoutModalVisible(true);
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
                          onWorkoutPress={openWorkout}
                          onDayLongPress={(event) =>
                            handleDayLongPress(day, event)
                          }
                          onDayPress={
                            dayHasProgram
                              ? () => openProgramDayModal(day)
                              : undefined
                          }
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

      <Modal
        visible={dayOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDayOptions}
      >
        <View style={styles.dayContextOverlay}>
          <Pressable
            style={styles.dayContextBackdrop}
            onPress={closeDayOptions}
          />

          <View
            style={[
              styles.dayContextMenu,
              {
                left: dayOptionsPosition.left,
                top: dayOptionsPosition.top,
                backgroundColor:
                  colorScheme === "dark"
                    ? "#151922"
                    : theme.cardBackground ?? theme.background,
                borderColor: cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.dayContextHeader,
                { borderBottomColor: cardBorder },
              ]}
            >
              <ThemedText style={styles.dayContextMeta} setColor={quietText}>
                {selectedCalendarDay?.dateLabel ?? ""}
              </ThemedText>
              <ThemedText style={styles.dayContextTitle} setColor={titleColor}>
                {selectedCalendarDay?.label ?? "Day options"}
              </ThemedText>
            </View>

            <View style={styles.dayContextBody}>
              <DayContextMenuAction
                icon={
                  <PlusCircled
                    width={22}
                    height={22}
                    color={primaryColor}
                  />
                }
                onPress={beginAddWorkout}
                textColor={primaryColor}
              >
                Add new workout
              </DayContextMenuAction>

              {!!selectedCalendarDay?.workouts?.length && (
                <DayContextMenuAction
                  icon={<Copy width={22} height={22} />}
                  onPress={beginCopyWorkout}
                  textColor={secondaryColor}
                >
                  Copy workout
                </DayContextMenuAction>
              )}

              {!!selectedCalendarDay?.workouts?.length && (
                <DayContextMenuAction
                  icon={
                    <Delete
                      width={22}
                      height={22}
                      color={theme.danger ?? Colors.dark.danger}
                    />
                  }
                  onPress={beginDeleteWorkout}
                  textColor={theme.danger ?? Colors.dark.danger}
                >
                  Delete workout
                </DayContextMenuAction>
              )}
            </View>
          </View>
        </View>
      </Modal>

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
          {(selectedCalendarDay?.programDays ?? []).map((programDay) => (
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
                {programDay.program_name}
              </ThemedText>
              <ThemedText style={styles.programTargetMeta} setColor={quietText}>
                {getProgramCopyLocation(programDay)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedModal>

      <ThemedModal
        visible={Boolean(pendingCopyTarget)}
        onClose={closeCopyTargetModal}
        title="Copy to program?"
        style={styles.programTargetModal}
        contentStyle={styles.programTargetModalBody}
      >
        <ThemedText style={styles.programTargetDate} setColor={quietText}>
          {pendingCopyTarget?.dateLabel
            ? `There is a program on ${pendingCopyTarget.dateLabel}. Add this workout to the program or keep it as a single workout?`
            : "There is a program on this date. Add this workout to the program or keep it as a single workout?"}
        </ThemedText>
        <ScrollView
          style={styles.programTargetList}
          contentContainerStyle={styles.programTargetListContent}
          showsVerticalScrollIndicator={false}
        >
          {(pendingCopyTarget?.programTargets ?? []).map((programDay) => (
            <TouchableOpacity
              key={`${programDay.program_id}-${programDay.day_id}`}
              activeOpacity={0.82}
              disabled={isCopyingWorkout}
              onPress={() => copyWorkoutToProgramTarget(programDay)}
              style={[
                styles.programTargetOption,
                {
                  backgroundColor: modalCardSurface,
                  borderColor: cardBorder,
                  opacity: isCopyingWorkout ? 0.62 : 1,
                },
              ]}
            >
              <ThemedText
                style={styles.programTargetName}
                setColor={titleColor}
              >
                {programDay.program_name ?? "Program"}
              </ThemedText>
              <ThemedText style={styles.programTargetMeta} setColor={quietText}>
                {getProgramCopyLocation(programDay)}
              </ThemedText>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            activeOpacity={0.82}
            disabled={isCopyingWorkout}
            onPress={() =>
              copyWorkoutToCalendarOnly(
                pendingCopyTarget?.workout,
                pendingCopyTarget?.date
              )
            }
            style={[
              styles.programTargetOption,
              {
                backgroundColor: modalCardSurface,
                borderColor: cardBorder,
                opacity: isCopyingWorkout ? 0.62 : 1,
              },
            ]}
          >
            <ThemedText style={styles.programTargetName} setColor={titleColor}>
              Single workout
            </ThemedText>
            <ThemedText style={styles.programTargetMeta} setColor={quietText}>
              Keep it standing on its own in Workout Calendar.
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedModal>

      <PickWorkoutModal
        workouts={selectedCalendarDay?.workouts ?? []}
        visible={pickWorkoutModalVisible}
        onClose={() => {
          setPickWorkoutModalVisible(false);
          setWorkoutPickMode(null);
        }}
        onSubmit={(workout) => {
          if (workoutPickMode === WORKOUT_PICK_MODE.COPY) {
            startWorkoutCopy(workout);
            return;
          }

          deleteWorkoutFromCalendar(workout);
        }}
      />

      <ThemedModal
        visible={Boolean(selectedProgramDate)}
        onClose={closeProgramDayModal}
        title={selectedProgramModalTitle}
        style={styles.programDayModal}
        contentStyle={styles.programDayModalBody}
      >
        {selectedProgramDate ? (
          <ThemedText style={styles.programDayDate} setColor={quietText}>
            {selectedProgramDate}
          </ThemedText>
        ) : null}

        <ScrollView
          style={styles.programDayList}
          contentContainerStyle={styles.programDayListContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedProgramDayRows.map((programDay) => (
            <View
              key={`${programDay.program_id}-${programDay.day_id}`}
              style={[
                styles.programDayCard,
                {
                  backgroundColor: modalCardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.programDayHeader}>
                <View
                  style={[
                    styles.programDayDot,
                    { backgroundColor: primaryColor },
                  ]}
                />
                <View style={styles.programDayText}>
                  <ThemedText style={styles.programDayName} setColor={titleColor}>
                    {programDay.program_name}
                  </ThemedText>
                  <ThemedText style={styles.programDayMeta} setColor={quietText}>
                    {getProgramDayLocation(programDay)}
                  </ThemedText>
                </View>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={() => openProgramOverview(programDay)}
                style={[
                  styles.programDayAction,
                  { backgroundColor: primaryColor },
                ]}
              >
                <ThemedText
                  style={styles.programDayActionText}
                  setColor={actionTextColor}
                >
                  Open program
                </ThemedText>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </ThemedModal>
    </ThemedView>
  );
};

export default WorkoutCalendarPage;
