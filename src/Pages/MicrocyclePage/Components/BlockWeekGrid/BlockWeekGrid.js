import { View, useColorScheme } from "react-native";

import styles from "./BlockWeekGridStyle";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import { ThemedText } from "../../../../Resources/ThemedComponents";

export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

// The grid's own palette, mapped onto theme tokens so light mode and the
// accent themes keep working.
export function useGridPalette() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return {
    theme,
    title: theme.title ?? theme.text,
    bodyText: theme.text,
    quietText: theme.quietText ?? theme.iconColor ?? theme.text,
    primary: theme.primary,
    primaryText: theme.primaryText ?? theme.primary,
    secondary: theme.secondary,
    cellIdle: theme.cardBackground ?? theme.background,
    cellIdleBorder: colorScheme === "light" ? theme.cardBorder : "transparent",
    cellDone: withAlpha(theme.secondary, 0.13),
    cellToday: withAlpha(theme.primary, 0.14),
    cellRest: withAlpha(
      theme.title ?? theme.text,
      colorScheme === "light" ? 0.14 : 0.1
    ),
    band: theme.chipBackground ?? theme.uiBackground,
    sick: theme.planned ?? theme.primary,
    sheet: theme.cardBackground ?? theme.background,
    sheetBorder: theme.cardBorder ?? theme.border,
    divider: theme.hairline ?? theme.cardBorder,
    dotIdle: theme.textDisabled ?? theme.quietText,
  };
}

/** The weekday initials. One row for the whole block, so it can stay put. */
export function WeekdayHeader() {
  const palette = useGridPalette();

  return (
    <View
      style={[
        styles.weekdayHeader,
        { backgroundColor: palette.theme.background },
      ]}
    >
      {WEEKDAY_INITIALS.map((initial, index) => (
        <View key={`${initial}-${index}`} style={styles.weekdayCell}>
          <ThemedText
            style={styles.weekdayInitial}
            setColor={palette.quietText}
          >
            {initial}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Week number, focus, dates and the workout count, on a filled band. */
export function WeekBand({
  weekLabel,
  focusLabel,
  dateRange,
  isCurrentWeek,
  palette,
}) {
  const hasFocus = Boolean(focusLabel);

  return (
    <View
      style={[
        styles.weekBand,
        {
          backgroundColor: isCurrentWeek
            ? withAlpha(palette.primary, 0.12)
            : palette.band,
        },
      ]}
    >
      <ThemedText
        style={styles.weekNumber}
        setColor={isCurrentWeek ? palette.primaryText : palette.title}
      >
        {weekLabel}
      </ThemedText>

      {hasFocus ? (
        <ThemedText
          style={styles.weekFocus}
          setColor={palette.quietText}
          numberOfLines={1}
        >
          {focusLabel}
        </ThemedText>
      ) : (
        <View style={styles.weekFocusSpacer} />
      )}

      <ThemedText style={styles.weekDates} setColor={palette.quietText}>
        {dateRange}
      </ThemedText>
    </View>
  );
}

/** The seven dates, aligned to the cells below them. */
export function WeekDateRow({ days, isCurrentWeek, palette }) {
  return (
    <View style={styles.dateRow}>
      {days.map((day) => {
        const dayNumber = Number((day.dateLabel ?? "").split(".")[0]);

        return (
          <View key={`${day.microcycleId}-${day.day}-date`} style={styles.dateCell}>
            <ThemedText
              style={[styles.dateText, day.active ? styles.dateTextToday : null]}
              setColor={
                day.active || day.hasProgram
                  ? palette.primaryText
                  : isCurrentWeek
                    ? palette.bodyText
                    : palette.quietText
              }
            >
              {Number.isFinite(dayNumber) ? dayNumber : ""}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One day. A single workout shows its type icon; several show the count with a
 * dot each, which says "three of five done" without opening anything.
 */
export function DayCell({
  day,
  isSelected = false,
  showRestDate = false,
  palette,
}) {
  const workouts = day?.workouts ?? [];
  const cards = day?.workoutCards ?? [];
  const isRest = workouts.length === 0;
  const isDone = !isRest && cards.every((card) => card.completed);
  const isToday = Boolean(day?.active);
  const isSick = Boolean(day?.isSick);

  const background = isToday
    ? palette.cellToday
    : isDone
      ? palette.cellDone
      : isRest
        ? "transparent"
        : palette.cellIdle;

  const contentColor = isDone
    ? palette.secondary
    : isToday
      ? palette.primaryText
      : palette.quietText;

  const cellStyle = [
    styles.cell,
    {
      backgroundColor: background,
      borderColor: isSelected
        ? palette.title
        : isSick
          ? palette.sick
          : isToday
            ? palette.primary
            : isRest
              ? palette.cellRest
              : palette.cellIdleBorder,
      borderWidth: isSelected || isToday || isSick ? 1.5 : 1,
      borderStyle:
        isSick || (isRest && !isToday && !isSelected) ? "dashed" : "solid",
    },
    isSelected ? styles.cellSelected : null,
  ];

  if (isRest) {
    const dayNumber = Number((day?.dateLabel ?? "").split(".")[0]);

    return (
      <View style={cellStyle}>
        {showRestDate && Number.isFinite(dayNumber) ? (
          <ThemedText style={styles.cellRestDate} setColor={palette.dotIdle}>
            {dayNumber}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  if (workouts.length === 1) {
    const Icon = cards[0]?.icon;

    return (
      <View style={cellStyle}>
        {Icon ? (
          <Icon
            width={19}
            height={19}
            color={contentColor}
            primaryColor={contentColor}
            backgroundColor="transparent"
          />
        ) : (
          <ThemedText style={styles.cellFallbackLabel} setColor={contentColor}>
            {cards[0]?.iconLabel ?? ""}
          </ThemedText>
        )}
      </View>
    );
  }

  // Six dots is the most that fits; the number stays exact either way.
  const dots = cards.slice(0, 6);

  return (
    <View style={cellStyle}>
      <ThemedText
        style={styles.cellCount}
        setColor={isDone ? palette.secondary : palette.bodyText}
      >
        {workouts.length}
      </ThemedText>

      <View style={styles.cellDotRow}>
        {dots.map((card, index) => (
          <View
            key={card.key ?? index}
            style={[
              styles.cellDot,
              {
                backgroundColor: card.completed
                  ? palette.secondary
                  : palette.dotIdle,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}
