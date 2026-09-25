// The Train tab's calendar block: last week and this week, drawn with the
// calendar's own Workouts cells so it reads as a piece of the calendar. The
// whole block opens WorkoutCalendarPage.
//
// It loads its own rows on focus: the range is fixed - Monday of last week to
// Sunday of this week - and nothing else on the tab reads them.
import { useCallback, useMemo, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import styles from "./TrainCalendarBlockStyle";
import { programService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import {
  getWorkoutIconConfig,
  getWorkoutIconShortLabel,
} from "@resources/Icons/WorkoutLabels";
import { ThemedText } from "@resources/ThemedComponents";
import {
  WEEKDAY_LABELS,
  buildCalendarLookups,
  enrichCalendarDay,
  formatLocalDate,
  getWeekPage,
  startOfDay,
} from "@utils/calendarDays";
import {
  DayCell,
  useGridPalette,
} from "../../../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGrid";
import gridStyles from "../../../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGridStyle";

// A workout card's icon and short name, as the calendar gives them. Passed to
// enrichCalendarDay so Utils/calendarDays.js never imports the SVG icons.
function getWorkoutTypeIcon(workoutType) {
  const iconConfig = getWorkoutIconConfig(workoutType);

  return {
    icon: iconConfig?.Icon,
    iconLabel: getWorkoutIconShortLabel(iconConfig),
  };
}

// Last week and this week, Monday first, and the dates the queries cover.
function getBlockWeeks(today) {
  const weeks = [getWeekPage(today, -1), getWeekPage(today, 0)];

  return {
    weeks,
    startIsoDate: weeks[0].days[0].isoDate,
    endIsoDate: weeks[1].days[6].isoDate,
  };
}

// The two weeks with nothing on them yet, so the block has its full height
// from the first frame instead of growing when the rows land.
function createEmptyCalendar() {
  return {
    today: startOfDay(new Date()),
    workouts: [],
    programDays: [],
    sicknessPeriods: [],
    isLoaded: false,
    loadFailed: false,
  };
}

function buildWeekRows(calendar) {
  const { weeks, startIsoDate, endIsoDate } = getBlockWeeks(calendar.today);
  const lookups = buildCalendarLookups({
    workouts: calendar.workouts,
    programDays: calendar.programDays,
    sicknessPeriods: calendar.sicknessPeriods,
    startIsoDate,
    endIsoDate,
  });
  const todayLabel = formatLocalDate(calendar.today);

  return weeks.map((week) => ({
    key: week.key,
    days: week.days.map((day) =>
      enrichCalendarDay(day, lookups, {
        pageKey: week.key,
        todayLabel,
        iconFor: getWorkoutTypeIcon,
      })
    ),
  }));
}

/**
 * `mode` is "program" (an active program: the week is counted against what is
 * planned) or "split" (no program: only what was done).
 */
const TrainCalendarBlock = ({ mode }) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const gridPalette = useGridPalette();
  const [calendar, setCalendar] = useState(createEmptyCalendar);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      // Taken on every focus, so a tab left open over a weekend moves on to
      // the new week.
      const today = startOfDay(new Date());
      const { startIsoDate, endIsoDate } = getBlockWeeks(today);

      Promise.all([
        programService.getWorkoutCalendarWorkouts(db, {
          startIsoDate,
          endIsoDate,
        }),
        programService.getWorkoutCalendarProgramDays(db, {
          startIsoDate,
          endIsoDate,
        }),
        programService.getSicknessPeriods(db),
      ])
        .then(([workouts, programDays, sicknessPeriods]) => {
          if (!isActive) {
            return;
          }

          setCalendar({
            today,
            workouts,
            programDays,
            sicknessPeriods,
            isLoaded: true,
            loadFailed: false,
          });
        })
        .catch((error) => {
          console.warn("Could not load the Train calendar:", error);

          if (isActive) {
            setCalendar((current) => ({ ...current, loadFailed: true }));
          }
        });

      return () => {
        isActive = false;
      };
    }, [db])
  );

  const weekRows = useMemo(() => buildWeekRows(calendar), [calendar]);
  const thisWeekWorkouts = weekRows[1].days.flatMap((day) => day.workouts);
  const doneCount = thisWeekWorkouts.filter(
    (workout) => Number(workout.done) === 1
  ).length;

  const title = t("calendar.title");
  const subtitle = calendar.loadFailed
    ? t("calendar.couldNotLoadWorkouts")
    : !calendar.isLoaded
      ? ""
      : mode === "program"
        ? t("trainCalendar.subtitle.program", {
            done: doneCount,
            count: thisWeekWorkouts.length,
          })
        : t("trainCalendar.subtitle.split", { count: doneCount });

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={() => navigation.navigate("WorkoutCalendarPage")}
      style={[
        styles.block,
        {
          backgroundColor: theme.background,
          borderColor: withAlpha(theme.primary, 0.32),
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: withAlpha(theme.primary, 0.14) },
          ]}
        >
          <Calender width={24} height={24} color={primaryTextColor} />
        </View>

        <View style={styles.headerCopy}>
          <ThemedText
            style={styles.title}
            setColor={theme.title}
            numberOfLines={1}
          >
            {title}
          </ThemedText>
          <ThemedText
            style={styles.subtitle}
            setColor={theme.quietText}
            numberOfLines={2}
          >
            {subtitle}
          </ThemedText>
        </View>

        <ChevronRight width={17} height={17} color={primaryTextColor} />
      </View>

      <View style={styles.workoutsSection}>
        <View
          style={[styles.weekListHeader, { borderTopColor: theme.cardBorder }]}
        >
          <ThemedText style={styles.sectionEyebrow} setColor={primaryTextColor}>
            {t("calendar.workoutsHeading")}
          </ThemedText>
        </View>

        <View style={styles.weekdayHeaderRow}>
          {WEEKDAY_LABELS.map((weekdayLabel) => (
            <View key={weekdayLabel} style={styles.weekdayHeaderCell}>
              <ThemedText
                style={styles.weekdayHeaderText}
                setColor={theme.quietText}
              >
                {t(`home.weekdays.${weekdayLabel.toLowerCase()}`)}
              </ThemedText>
            </View>
          ))}
        </View>

        {weekRows.map((week) => (
          <View key={week.key} style={styles.weekListRow}>
            <View style={gridStyles.weekGrid}>
              {week.days.map((day) => (
                <View key={day.dateLabel} style={gridStyles.cellSlot}>
                  <DayCell day={day} showRestDate palette={gridPalette} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

export default TrainCalendarBlock;
