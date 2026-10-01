// The calendar's Workouts rows: one row of day cells per week of a month,
// each day tappable. WorkoutCalendarPage draws it under the month grid, and
// the split editor draws the same rows to pick a workout from, so the two
// read as one calendar.
import { Pressable, View } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CalendarWeekRowsStyle";
import {
  getWorkoutIconConfig,
  getWorkoutIconShortLabel,
} from "@resources/Icons/WorkoutLabels";
import { ThemedText } from "@resources/ThemedComponents";
import { WEEKDAY_LABELS, enrichCalendarDay } from "@utils/calendarDays";
import { DayCell } from "../../../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGrid";
import gridStyles from "../../../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGridStyle";

// A workout card's icon and short name, for enrichCalendarDay. Passed in so
// Utils/calendarDays.js never imports the SVG icons and can run in plain Node.
export function getWorkoutTypeIcon(workoutType) {
  const iconConfig = getWorkoutIconConfig(workoutType);

  return {
    icon: iconConfig?.Icon,
    iconLabel: getWorkoutIconShortLabel(iconConfig),
  };
}

/** A month page (getMonthPage) as the rows below draw it. */
export function buildCalendarWeekRows(monthPage, lookups, { todayLabel, t }) {
  return (monthPage?.weeks ?? []).map((week) => ({
    key: `${monthPage?.key}-${week[0].isoDate}`,
    days: week.map((day) =>
      enrichCalendarDay(day, lookups, {
        pageKey: monthPage?.key,
        todayLabel,
        iconFor: getWorkoutTypeIcon,
        t,
      })
    ),
    isCurrentWeek: week.some((day) => day.dateLabel === todayLabel),
  }));
}

function getWeekdayName(weekday, t) {
  return t(`calendar.weekdays.${String(weekday ?? "").slice(0, 3).toLowerCase()}`);
}

/**
 * `weeks` from buildCalendarWeekRows. `showWeekdays` adds the weekday row on
 * top, for where no month grid above it carries one.
 */
export default function CalendarWeekRows({
  weeks = [],
  palette,
  onPressDay,
  showWeekdays = false,
}) {
  const { t } = useTranslation();

  return (
    <View>
      {showWeekdays ? (
        <View style={gridStyles.weekGrid} pointerEvents="none">
          {WEEKDAY_LABELS.map((weekdayLabel) => (
            <View key={weekdayLabel} style={gridStyles.cellSlot}>
              <ThemedText style={styles.weekdayText} setColor={palette.quietText}>
                {t(`home.weekdays.${weekdayLabel.toLowerCase()}`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {weeks.map((week) => (
        <View key={week.key} style={styles.weekRow}>
          <View style={gridStyles.weekGrid}>
            {week.days.map((day) => (
              <Pressable
                key={`${week.key}-${day.dateLabel}`}
                accessibilityRole="button"
                accessibilityLabel={`${getWeekdayName(day.label, t)} ${day.dateLabel}`}
                style={[gridStyles.cellSlot, !day.inMonth && styles.outsideMonth]}
                onPress={() => onPressDay?.(day)}
                onLongPress={() => onPressDay?.(day)}
              >
                <DayCell day={day} showRestDate palette={palette} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
