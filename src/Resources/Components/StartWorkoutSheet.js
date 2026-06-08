import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../GlobalStyling/colors";
import ReplayHistory from "../Icons/UI-icons/ReplayHistory";
import Resistance from "../Icons/WorkoutLabels/Resistance";
import Run from "../Icons/WorkoutLabels/Run";

const noop = () => {};

function colorWithAlpha(color, alpha, fallback) {
  if (typeof color !== "string") {
    return fallback;
  }

  const hexMatch = color.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);

  if (hexMatch) {
    const hex = hexMatch[1];
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgbMatch = color
    .trim()
    .match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/i);

  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return fallback;
}

function createSheetPalette(theme) {
  const fallbackTheme = Colors.dark;
  const primary = theme.primary ?? fallbackTheme.primary;
  const secondary = theme.secondary ?? fallbackTheme.secondary;
  const record = theme.record ?? fallbackTheme.record;
  const sheet = theme.cardBackground ?? theme.background ?? fallbackTheme.cardBackground;
  const border = theme.cardBorder ?? theme.iconColor ?? fallbackTheme.cardBorder;
  const muted = theme.iconColor ?? theme.quietText ?? theme.text ?? fallbackTheme.iconColor;
  const title = theme.title ?? theme.text ?? fallbackTheme.title;

  return {
    backdrop: "rgba(0, 0, 0, 0.62)",
    sheet,
    sheetBorder: border,
    handle: border,
    title,
    muted,
    label: muted,
    card: sheet,
    cardBorder: border,
    cardSoft: colorWithAlpha(primary, 0.08, sheet),
    orange: primary,
    orangeDeep: colorWithAlpha(primary, 0.14, sheet),
    orangeBorder: colorWithAlpha(primary, 0.52, border),
    blue: record,
    blueDeep: colorWithAlpha(record, 0.16, sheet),
    green: secondary,
    greenDeep: colorWithAlpha(secondary, 0.14, sheet),
    iconOnAccent: theme.textInverted ?? sheet,
  };
}

const freshStarts = [
  {
    id: "Resistance",
    title: "Resistance",
    details: "Sets & reps",
    type: "resistance",
  },
  {
    id: "Run",
    title: "Run",
    details: "Distance & pace",
    type: "run",
  },
];

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getWorkoutTypeLabel(workout) {
  const workoutType = getWorkoutType(workout);

  if (workoutType === "StrengthTraining") {
    return "Resistance";
  }

  return workoutType ?? "Workout";
}

function getWorkoutIconType(workout) {
  return getWorkoutType(workout) === "Run" ? "run" : "resistance";
}

function getWorkoutTitle(workout) {
  return workout?.label ?? getWorkoutTypeLabel(workout);
}

function getWorkoutDetail(shortcut) {
  const workout = shortcut?.workout;
  const programName = shortcut?.programName ?? "Program";
  const exerciseCount = workout?.previewItems?.length ?? 0;

  if (exerciseCount > 0) {
    const exerciseLabel = exerciseCount === 1 ? "exercise" : "exercises";
    return `${programName} - ${exerciseCount} ${exerciseLabel}`;
  }

  return `${programName} - Ready`;
}

function getRecentWorkoutDetail(workout) {
  const previewItems = workout?.previewItems ?? [];

  if (getWorkoutType(workout) === "Run" && previewItems.length > 0) {
    const setSummary = previewItems
      .map((item) => item.detail)
      .filter(Boolean)
      .join(", ");

    return setSummary || "Run";
  }

  if (previewItems.length > 0) {
    const exerciseLabel = previewItems.length === 1 ? "exercise" : "exercises";
    return `${previewItems.length} ${exerciseLabel}`;
  }

  return "Ready";
}

function parseWorkoutDate(workout) {
  const isoDate = workout?.date_iso;

  if (typeof isoDate === "string" && isoDate.length >= 10) {
    return new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  }

  const localDate = workout?.date;

  if (typeof localDate === "string" && localDate.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    const [day, month, year] = localDate.split(".").map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

function getRecentWorkoutMeta(workout) {
  const workoutDate = parseWorkoutDate(workout);

  if (!workoutDate || Number.isNaN(workoutDate.getTime())) {
    return workout?.date ?? "Recent";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  workoutDate.setHours(0, 0, 0, 0);

  const dayDifference = Math.round(
    (today.getTime() - workoutDate.getTime()) / 86400000
  );

  if (dayDifference <= 0) {
    return "Today";
  }

  if (dayDifference === 1) {
    return "Yesterday";
  }

  if (dayDifference <= 6) {
    return `${dayDifference} days ago`;
  }

  return workout?.date ?? "Recent";
}

function getUsualWorkoutDetail(workout) {
  const exerciseCount = Number(workout?.exerciseCount) || 0;

  if (exerciseCount > 0) {
    const exerciseLabel = exerciseCount === 1 ? "exercise" : "exercises";
    return `${exerciseCount} ${exerciseLabel}`;
  }

  return "Workout";
}

function getUsualWorkoutMeta(workout) {
  return getRecentWorkoutMeta({
    date: workout?.latestDate,
    date_iso: workout?.latestDateIso,
  });
}

function WorkoutGlyph({ type, size = 26, color }) {
  if (type === "run" || type === "walk") {
    return <Run width={size} height={size} primaryColor={color} />;
  }

  return <Resistance width={size} height={size} color={color} />;
}

function getIconColors(type, palette) {
  if (type === "run") {
    return {
      backgroundColor: palette.blueDeep,
      color: palette.blue,
    };
  }

  if (type === "walk") {
    return {
      backgroundColor: palette.greenDeep,
      color: palette.green,
    };
  }

  return {
    backgroundColor: palette.orangeDeep,
    color: palette.orange,
  };
}

function IconTile({ type, palette, styles, size = "regular", active = false }) {
  const iconColors = getIconColors(type, palette);
  const tileSize = size === "large" ? 56 : 46;
  const glyphSize = size === "large" ? 30 : 25;

  return (
    <View
      style={[
        styles.iconTile,
        {
          width: tileSize,
          height: tileSize,
          borderRadius: size === "large" ? 14 : 12,
          backgroundColor: active ? palette.orange : iconColors.backgroundColor,
        },
      ]}
    >
      <WorkoutGlyph
        type={type}
        size={glyphSize}
        color={active ? palette.iconOnAccent : iconColors.color}
      />
    </View>
  );
}

function MiniClock({ styles }) {
  return (
    <View style={styles.clock}>
      <View style={styles.clockHandTall} />
      <View style={styles.clockHandWide} />
    </View>
  );
}

function SectionHeader({
  title,
  action,
  palette,
  styles,
  showRotationIcon = false,
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleGroup}>
        {showRotationIcon ? (
          <ReplayHistory width={15} height={15} color={palette.label} />
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <TouchableOpacity activeOpacity={0.75} onPress={noop}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PlannedTodaySection({ shortcut, onOpen, palette, styles }) {
  const workout = shortcut?.workout;

  if (!workout) {
    return null;
  }

  return (
    <View style={styles.plannedTodaySection}>
      <Text style={styles.plannedTodayPrompt}>
        You have something planned in a program. Do you want to open the workout?
      </Text>

      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onOpen}
        style={styles.todayShortcutCard}
      >
        <IconTile
          type={getWorkoutIconType(workout)}
          palette={palette}
          styles={styles}
          size="large"
          active
        />
        <View style={styles.todayShortcutCopy}>
          <Text style={styles.todayShortcutLabel}>TODAY</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {getWorkoutTitle(workout)}
          </Text>
          <Text style={styles.cardDetails} numberOfLines={1}>
            {getWorkoutDetail(shortcut)}
          </Text>
        </View>
        <Text style={styles.chevron}>{">"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function UsualWorkoutCard({ workout, palette, styles }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={noop}
      style={[
        styles.usualCard,
        workout.suggested ? styles.usualCardSuggested : null,
      ]}
    >
      <View style={styles.usualTopRow}>
        <IconTile
          type={getWorkoutIconType(workout)}
          palette={palette}
          styles={styles}
        />
        {workout.suggested ? (
          <View style={styles.suggestedBadge}>
            <Text style={styles.suggestedText}>SUGGESTED</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {workout.title}
      </Text>
      <Text style={styles.cardDetails} numberOfLines={1}>
        {getUsualWorkoutDetail(workout)}
      </Text>
      <View style={styles.cardMetaRow}>
        <View style={styles.inlineMeta}>
          <MiniClock styles={styles} />
          <Text style={styles.metaText} numberOfLines={1}>
            {getUsualWorkoutMeta(workout)}
          </Text>
        </View>
        <Text style={styles.metaText}>{workout.occurrenceCount}x</Text>
      </View>
    </TouchableOpacity>
  );
}

function UsualWorkoutSection({ isLoading, workouts, palette, styles }) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="YOUR USUAL WORKOUTS"
        action="Manage"
        palette={palette}
        styles={styles}
        showRotationIcon
      />
      {isLoading ? (
        <View style={styles.usualStateRow}>
          <Text style={styles.recentStateText}>Finding usual workouts...</Text>
        </View>
      ) : workouts.length > 0 ? (
        <View style={styles.usualGrid}>
          {workouts.map((workout) => (
            <UsualWorkoutCard
              key={workout.id}
              workout={workout}
              palette={palette}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <View style={styles.usualStateRow}>
          <Text style={styles.recentStateText}>
            Repeat a workout twice to see it here.
          </Text>
        </View>
      )}
    </View>
  );
}

function RecentWorkoutRow({ workout, onPress, palette, styles }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={() => onPress(workout)}
      style={styles.recentRow}
    >
      <IconTile
        type={getWorkoutIconType(workout)}
        palette={palette}
        styles={styles}
      />
      <View style={styles.recentCopy}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {getWorkoutTitle(workout)}
        </Text>
        <Text style={styles.cardDetails} numberOfLines={1}>
          {getRecentWorkoutDetail(workout)}
        </Text>
      </View>
      <View style={styles.inlineMeta}>
        <MiniClock styles={styles} />
        <Text style={styles.metaText} numberOfLines={1}>
          {getRecentWorkoutMeta(workout)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function RecentWorkoutSection({
  isLoading,
  workouts,
  onOpenWorkout,
  palette,
  styles,
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="RECENT"
        action="See all"
        palette={palette}
        styles={styles}
      />
      {isLoading ? (
        <View style={styles.recentStateRow}>
          <Text style={styles.recentStateText}>Loading recent workouts...</Text>
        </View>
      ) : workouts.length > 0 ? (
        <View style={styles.listStack}>
          {workouts.map((workout) => (
            <RecentWorkoutRow
              key={workout.workout_id}
              workout={workout}
              onPress={onOpenWorkout}
              palette={palette}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <View style={styles.recentStateRow}>
          <Text style={styles.recentStateText}>No recent workouts yet.</Text>
        </View>
      )}
    </View>
  );
}

function FreshStartCard({ item, disabled, onPress, palette, styles }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={disabled}
      onPress={() =>
        onPress({
          id: item.id,
          displayName: item.title,
        })
      }
      style={[styles.freshCard, disabled ? styles.disabledCard : null]}
    >
      <IconTile type={item.type} palette={palette} styles={styles} />
      <View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDetails}>{item.details}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function StartWorkoutSheet({
  visible,
  onClose,
  onStartFresh = noop,
  onOpenPlannedWorkout = noop,
  plannedTodayShortcut = null,
  usualWorkouts = [],
  isLoadingUsualWorkouts = false,
  recentWorkouts = [],
  isLoadingRecentWorkouts = false,
  onOpenRecentWorkout = noop,
  isStartingWorkout = false,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const palette = useMemo(() => createSheetPalette(theme), [theme]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(insets.top, 10) + 12,
            },
          ]}
        >
          <View style={styles.handle} />

          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityLabel="Close workout starter"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.header}>
              <Text style={styles.eyebrow}>START A WORKOUT</Text>
              <Text style={styles.title}>What are you doing today?</Text>
            </View>

            {plannedTodayShortcut ? (
              <PlannedTodaySection
                shortcut={plannedTodayShortcut}
                onOpen={onOpenPlannedWorkout}
                palette={palette}
                styles={styles}
              />
            ) : null}

            <UsualWorkoutSection
              isLoading={isLoadingUsualWorkouts}
              workouts={usualWorkouts}
              palette={palette}
              styles={styles}
            />

            <RecentWorkoutSection
              isLoading={isLoadingRecentWorkouts}
              workouts={recentWorkouts}
              onOpenWorkout={onOpenRecentWorkout}
              palette={palette}
              styles={styles}
            />

            <View style={styles.section}>
              <SectionHeader
                title="START FRESH"
                palette={palette}
                styles={styles}
              />
              <View style={styles.freshGrid}>
                {freshStarts.map((item) => (
                  <FreshStartCard
                    key={item.id}
                    item={item}
                    disabled={isStartingWorkout}
                    onPress={onStartFresh}
                    palette={palette}
                    styles={styles}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: palette.backdrop,
  },
  sheet: {
    width: "100%",
    maxHeight: "98%",
    backgroundColor: palette.sheet,
    borderTopWidth: 1,
    borderTopColor: palette.sheetBorder,
    overflow: "hidden",
  },
  handle: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.handle,
  },
  closeButton: {
    position: "absolute",
    top: 24,
    right: 22,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  closeText: {
    color: palette.muted,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 28,
  },
  header: {
    gap: 8,
    paddingRight: 36,
  },
  eyebrow: {
    color: palette.label,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: palette.title,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  plannedTodaySection: {
    gap: 12,
  },
  plannedTodayPrompt: {
    color: palette.title,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0,
  },
  todayShortcutCard: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: palette.orangeBorder,
    borderRadius: 16,
    backgroundColor: palette.orangeDeep,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  todayShortcutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  todayShortcutLabel: {
    color: palette.orange,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cardTitle: {
    color: palette.title,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  cardDetails: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    letterSpacing: 0,
  },
  chevron: {
    color: palette.muted,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "300",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: palette.label,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 4,
  },
  sectionAction: {
    color: palette.orange,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  usualGrid: {
    flexDirection: "row",
    gap: 10,
  },
  usualCard: {
    flex: 1,
    minHeight: 144,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    padding: 14,
    gap: 7,
  },
  usualCardSuggested: {
    borderColor: palette.orangeBorder,
    backgroundColor: palette.cardSoft,
  },
  usualTopRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  usualStateRow: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  suggestedBadge: {
    borderRadius: 999,
    backgroundColor: palette.orangeDeep,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  suggestedText: {
    color: palette.orange,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardMetaRow: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  clock: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  clockHandTall: {
    position: "absolute",
    width: 1,
    height: 4,
    top: 2,
    backgroundColor: palette.muted,
  },
  clockHandWide: {
    position: "absolute",
    width: 3,
    height: 1,
    right: 2,
    backgroundColor: palette.muted,
  },
  listStack: {
    gap: 10,
  },
  recentRow: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  recentStateRow: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  recentStateText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  freshGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  freshCard: {
    width: "48%",
    minHeight: 124,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.card,
    padding: 14,
    justifyContent: "space-between",
  },
  disabledCard: {
    opacity: 0.64,
  },
  iconTile: {
    alignItems: "center",
    justifyContent: "center",
  },
  });
}
