import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import Svg, { Path, Polygon } from "react-native-svg";

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
  isSick = false,
  overdue = false,
  sickOverdue = false,
  icon: Icon,
  iconLabel,
  programActive = false,
  hasPersonalRecord = false,
  workoutCards = [],
  onWorkoutPress,
  onDayPress,
  onDayLongPress,
  compact = false,
  showWeekdayLabel = true,
  showMonthLabel = true,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const workoutIconSize = compact ? 22 : 28;
  const hasWorkoutCards = workoutCards.length > 0;
  const hasWorkout = hasWorkoutCards || Boolean(Icon || iconLabel);
  const [dayNumber, monthNumber] = (dateLabel ?? "").split(".");
  const monthLabel =
    showMonthLabel && monthNumber ? getMonthLabel(monthNumber) : null;
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
  const recordColor =
    theme.record ?? Colors.dark.record ?? theme.secondary ?? titleColor;
  const recordBorder = theme.recordDark ?? Colors.dark.recordDark ?? recordColor;
  const dangerColor = theme.danger ?? Colors.dark.danger ?? "#ba0000ff";
  const sickColor = theme.planned ?? Colors.dark.planned ?? "#ffdd00";
  const sickBorderColor = theme.plannedDark ?? Colors.dark.plannedDark ?? sickColor;
  const sickSurface =
    colorScheme === "dark" ? "rgba(255, 221, 0, 0.13)" : "rgba(255, 221, 0, 0.28)";
  const activeText = theme.primary ?? titleColor;
  const completedText = theme.secondary ?? titleColor;
  const todayBadgeText = theme.textInverted ?? theme.cardBackground ?? "#141414";
  const statusBadgeLabel = active ? "TODAY" : isSick ? "SICK" : null;
  const statusBadgeColor = active ? activeBorder : isSick ? sickColor : activeBorder;
  const statusBadgeTextColor =
    active ? todayBadgeText : theme.textInverted ?? "#141414";
  const badgeBackgroundColor = isSick
    ? sickSurface
    : active
    ? activeSurface
    : completed
      ? completedSurface
      : surfaceColor;
  const badgeBorderColor = isSick
    ? sickColor
    : active
    ? activeBorder
    : completed
      ? completedBorder
      : cardBorder;
  const badgeLabelColor = isSick
    ? sickColor
    : active
    ? activeText
    : completed
      ? completedText
      : quietText;
  const badgeDateColor = isSick
    ? titleColor
    : active
    ? titleColor
    : completed
      ? titleColor
      : titleColor;
  const weekdayTextColor = isSick
    ? sickColor
    : completed
    ? completedText
    : active
      ? activeText
      : quietText;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {!!statusBadgeLabel && (
        <View
          pointerEvents="none"
          style={[
            styles.todayBadgeSlot,
            compact && styles.todayBadgeSlotCompact,
          ]}
        >
          <View
            style={[
              styles.todayBadge,
              compact && styles.todayBadgeCompact,
              {
                backgroundColor: statusBadgeColor,
                borderColor: theme.cardBackground ?? theme.background,
              },
            ]}
          >
            <Text style={[styles.todayBadgeText, { color: statusBadgeTextColor }]}>
              {statusBadgeLabel}
            </Text>
          </View>
        </View>
      )}

      <Pressable
        delayLongPress={600}
        onPress={onDayPress}
        onLongPress={onDayLongPress}
        accessibilityRole={onDayPress ? "button" : undefined}
        accessibilityLabel={[label, dateLabel].filter(Boolean).join(" ")}
        style={[
          styles.headerBadge,
          compact && styles.headerBadgeCompact,
          {
            backgroundColor: badgeBackgroundColor,
            borderColor: badgeBorderColor,
            borderWidth: active || isSick ? 2 : 1,
            borderStyle: isSick ? "dashed" : "solid",
          },
        ]}
      >
        {programActive && (
          <View
            pointerEvents="none"
            style={[
              styles.programDot,
              compact && styles.programDotCompact,
              { backgroundColor: theme.primary ?? "#f7742e" },
            ]}
          />
        )}

        {showWeekdayLabel && Boolean(label) && (
          <Text
            style={[
              styles.weekdayLabel,
              active && styles.weekdayLabelActive,
              { color: weekdayTextColor },
            ]}
          >
            {label}
          </Text>
        )}

        {!!dateLabel && (
          <View style={[styles.dateStack, compact && styles.dateStackCompact]}>
            <Text
              style={[
                styles.dateNumber,
                compact && styles.dateNumberCompact,
                { color: badgeDateColor },
              ]}
            >
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
            const isPersonalRecordWorkout =
              workoutCard.completed && Boolean(workoutCard.hasPersonalRecord);
            const completedWorkoutSurfaceColor = isPersonalRecordWorkout
              ? recordColor
              : theme.secondary;
            const completedWorkoutBorderColor = isPersonalRecordWorkout
              ? recordBorder
              : theme.secondaryDark;
            const isSickCompletedWorkout =
              workoutCard.completed && Boolean(workoutCard.sickCompleted);
            const workoutSurfaceColor = isSickCompletedWorkout
              ? sickColor
              : workoutCard.sickOverdue
              ? sickColor
              : workoutCard.overdue
              ? dangerColor
              : isPersonalRecordWorkout
                ? recordColor
              : workoutCard.completed
                ? theme.secondary
                : theme.primary;
            const workoutBorderColor = isSickCompletedWorkout
              ? sickBorderColor
              : workoutCard.sickOverdue
              ? sickBorderColor
              : workoutCard.overdue
              ? dangerColor
              : isPersonalRecordWorkout
                ? completedWorkoutBorderColor
              : workoutCard.completed
                ? completedWorkoutBorderColor
                : theme.primaryDark;
            const workoutBorderStyle =
              workoutCard.sickOverdue || isSickCompletedWorkout
                ? "dashed"
                : "solid";

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
                  compact && styles.circleCompact,
                  index < workoutCards.length - 1 && styles.workoutCardSpacing,
                  index < workoutCards.length - 1 &&
                    compact &&
                    styles.workoutCardSpacingCompact,
                  {
                    backgroundColor: workoutSurfaceColor,
                    borderWidth: isSickCompletedWorkout ? 0 : compact ? 2 : 3,
                    borderColor: workoutBorderColor,
                    borderStyle: workoutBorderStyle,
                  },
                ]}
              >
                {isSickCompletedWorkout && (
                  <Svg
                    pointerEvents="none"
                    style={styles.splitWorkoutBackground}
                    viewBox="0 0 40 40"
                  >
                    <Polygon
                      points="0,0 40,0 0,40"
                      fill={sickColor}
                    />
                    <Polygon
                      points="40,0 40,40 0,40"
                      fill={completedWorkoutSurfaceColor}
                    />
                    <Path
                      d="M2 38 V14 A12 12 0 0 1 14 2 H38"
                      fill="none"
                      stroke={sickBorderColor}
                      strokeDasharray="4 9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={4}
                    />
                    <Path
                      d="M38 2 V26 A12 12 0 0 1 26 38 H2"
                      fill="none"
                      stroke={completedWorkoutBorderColor}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={4}
                    />
                  </Svg>
                )}

                <View pointerEvents="none" style={styles.workoutContent}>
                  {WorkoutIcon && (
                    <WorkoutIcon
                      width={workoutIconSize}
                      height={workoutIconSize}
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
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!hasWorkoutCards && hasWorkout && (
        <View
          style={[
            styles.circle,
            compact && styles.circleCompact,
            {
              backgroundColor: sickOverdue
                ? sickColor
                : overdue
                ? dangerColor
                : completed && hasPersonalRecord
                  ? recordColor
                : completed
                  ? theme.secondary
                  : theme.primary,
              borderColor: sickOverdue
                ? sickBorderColor
                : overdue
                ? dangerColor
                : completed && hasPersonalRecord
                  ? recordBorder
                : completed
                  ? theme.secondaryDark
                  : theme.primaryDark,
              borderStyle: sickOverdue ? "dashed" : "solid",
            },
          ]}
        >
          {Icon && (
            <Icon
              width={workoutIconSize}
              height={workoutIconSize}
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
  containerCompact: {
    paddingTop: 4,
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
  headerBadgeCompact: {
    width: "78%",
    maxWidth: 44,
    minWidth: 34,
    minHeight: 38,
    paddingHorizontal: 2,
    paddingTop: 3,
    paddingBottom: 3,
    borderRadius: 12,
    marginBottom: 4,
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
  programDotCompact: {
    top: 4,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayBadgeSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  todayBadgeSlotCompact: {
    top: 0,
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
  todayBadgeCompact: {
    width: "70%",
    maxWidth: 42,
    minWidth: 34,
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
  dateStackCompact: {
    marginTop: 0,
  },
  dateNumber: {
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 21,
  },
  dateNumberCompact: {
    fontSize: 17,
    lineHeight: 19,
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
    overflow: "hidden",
    position: "relative",
  },
  circleCompact: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginBottom: 6,
  },
  splitWorkoutBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  workoutContent: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
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
  workoutCardSpacingCompact: {
    marginBottom: 3,
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
