import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";

const MONTH_LABELS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

const getMonthLabel = (monthNumber) => {
  const monthIndex = Number(monthNumber);

  if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return monthNumber;
  }

  return MONTH_LABELS[monthIndex - 1];
};


const WeekdayIndicator = ({
  label,
  dateLabel,
  active,
  completed,
  overdue = false,
  icon: Icon,
  iconLabel,
  programActive = false,
  workoutCards = [],
  onWorkoutPress,
  onDayLongPress,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const hasWorkoutCards = workoutCards.length > 0;
  const hasWorkout = hasWorkoutCards || Boolean(Icon || iconLabel);
  const [dayNumber, monthNumber] = (dateLabel ?? "").split(".");
  const monthLabel = monthNumber ? getMonthLabel(monthNumber) : null;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const surfaceColor = theme.uiBackground ?? theme.cardBackground ?? theme.background;
  const activeSurface =
    colorScheme === "dark"
      ? "rgba(247, 116, 46, 0.13)"
      : theme.primaryLight ?? surfaceColor;
  const completedSurface =
    colorScheme === "dark"
      ? "rgba(96, 218, 172, 0.12)"
      : theme.secondaryLight ?? surfaceColor;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const activeBorder = theme.primary ?? cardBorder;
  const completedBorder = theme.secondary ?? cardBorder;
  const dangerColor = theme.danger ?? Colors.dark.danger ?? "#ba0000ff";
  const activeText = theme.primary ?? titleColor;
  const completedText = theme.secondary ?? titleColor;
  const todayBadgeText = theme.textInverted ?? theme.cardBackground ?? "#141414";
  const badgeBackgroundColor = active
    ? activeSurface
    : completed
      ? completedSurface
      : surfaceColor;
  const badgeBorderColor = active
    ? activeBorder
    : completed
      ? completedBorder
      : cardBorder;
  const badgeLabelColor = active
    ? activeText
    : completed
      ? completedText
      : quietText;
  const badgeDateColor = active
    ? titleColor
    : completed
      ? titleColor
      : titleColor;
  const weekdayTextColor = completed
    ? completedText
    : active
      ? activeText
      : quietText;

  return (
    <View style={styles.container}>
      {active && (
        <View pointerEvents="none" style={styles.todayBadgeSlot}>
          <View
            style={[
              styles.todayBadge,
              {
                backgroundColor: activeBorder,
                borderColor: theme.cardBackground ?? theme.background,
              },
            ]}
          >
            <Text style={[styles.todayBadgeText, { color: todayBadgeText }]}>
              TODAY
            </Text>
          </View>
        </View>
      )}

      <Pressable
        delayLongPress={600}
        onLongPress={onDayLongPress}
        style={[
          styles.headerBadge,
          {
            backgroundColor: badgeBackgroundColor,
            borderColor: badgeBorderColor,
            borderWidth: active ? 2 : 1,
          },
        ]}
      >
        {programActive && (
          <View
            pointerEvents="none"
            style={[
              styles.programDot,
              { backgroundColor: theme.primary ?? "#f7742e" },
            ]}
          />
        )}

        <Text
          style={[
            styles.weekdayLabel,
            active && styles.weekdayLabelActive,
            { color: weekdayTextColor },
          ]}
        >
          {label}
        </Text>

        {!!dateLabel && (
          <View style={styles.dateStack}>
            <Text style={[styles.dateNumber, { color: badgeDateColor }]}>
              {dayNumber ?? dateLabel}
            </Text>

            {!!monthLabel && (
              <Text style={[styles.dateMonth, { color: badgeLabelColor }]}>
                {monthLabel}
              </Text>
            )}
          </View>
        )}
      </Pressable>

      {hasWorkoutCards && (
        <View style={styles.workoutCards}>
          {workoutCards.map((workoutCard, index) => {
            const WorkoutIcon = workoutCard.icon;
            const workoutSurfaceColor = workoutCard.overdue
              ? dangerColor
              : workoutCard.completed
                ? theme.secondary
                : theme.primary;
            const workoutBorderColor = workoutCard.overdue
              ? dangerColor
              : workoutCard.completed
                ? theme.secondaryDark
                : theme.primaryDark;

            return (
              <TouchableOpacity
                key={workoutCard.key ?? `${workoutCard.iconLabel}-${index}`}
                activeOpacity={0.85}
                delayLongPress={600}
                onPress={() => onWorkoutPress?.(workoutCard.workout)}
                onLongPress={onDayLongPress}
                style={[
                  styles.circle,
                  styles.multiWorkoutCard,
                  index < workoutCards.length - 1 && styles.workoutCardSpacing,
                  {
                    backgroundColor: workoutSurfaceColor,
                    borderColor: workoutBorderColor,
                  },
                ]}
              >
                {WorkoutIcon && (
                  <WorkoutIcon
                    width={28}
                    height={28}
                    color={theme.cardBackground}
                    fill={theme.cardBackground}
                    primaryColor={theme.cardBackground}
                    backgroundColor="transparent"
                  />
                )}

                {!WorkoutIcon && workoutCard.iconLabel && (
                  <Text
                    style={[
                      styles.iconLabel,
                      styles.iconLabelOnly,
                      { color: theme.cardBackground },
                    ]}
                  >
                    {workoutCard.iconLabel}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!hasWorkoutCards && hasWorkout && (
        <View
          style={[
            styles.circle,
            {
              backgroundColor: overdue
                ? dangerColor
                : completed
                  ? theme.secondary
                  : theme.primary,
              borderColor: overdue
                ? dangerColor
                : completed
                  ? theme.secondaryDark
                  : theme.primaryDark,
            },
          ]}
        >
          {Icon && (
            <Icon
              width={28}
              height={28}
              color={theme.cardBackground}
              fill={theme.cardBackground}
              primaryColor={theme.cardBackground}
              backgroundColor="transparent"
            />
          )}

          {!Icon && iconLabel && (
            <Text
              style={[
                styles.iconLabel,
                styles.iconLabelOnly,
                { color: theme.cardBackground },
              ]}
            >
              {iconLabel}
            </Text>
          )}
        </View>
      )}

    </View>
  );
};

export default WeekdayIndicator;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 8,
    position: "relative",
    width: "100%",
  },
  headerBadge: {
    width: "92%",
    maxWidth: 58,
    minWidth: 44,
    minHeight: 60,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 6,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
    position: "relative",
  },
  weekdayLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0,
    lineHeight: 11,
  },
  weekdayLabelActive: {
    fontSize: 9,
    letterSpacing: 0,
  },
  programDot: {
    position: "absolute",
    top: 5,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  todayBadgeSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  todayBadge: {
    width: "80%",
    maxWidth: 58,
    minWidth: 42,
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  todayBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 10,
  },
  dateStack: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  dateNumber: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 21,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 10,
    opacity: 0.8,
    textTransform: "lowercase",
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    marginBottom: 10,
  },
  workoutCards: {
    alignItems: "center",
  },
  multiWorkoutCard: {
    marginBottom: 0,
  },
  workoutCardSpacing: {
    marginBottom: 4,
  },
  iconLabel: {
    fontSize: 8,
    opacity: 0.85,
    marginTop: 1,
  },
  iconLabelOnly: {
    fontSize: 9,
    marginTop: 0,
  },
});
