import { useCallback, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Path } from "react-native-svg";

import styles from "./TrainLibraryGridStyle";
import LibraryTile from "./LibraryTile";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ProgressBar from "@resources/Components/ProgressBar";
import Dumbbell from "@resources/Icons/UI-icons/Dumbbell";
import Fire from "@resources/Icons/UI-icons/Fire";
import Layers from "@resources/Icons/UI-icons/Layers";
import Library from "@resources/Icons/UI-icons/Library";
import Star from "@resources/Icons/UI-icons/Star";
import { ThemedText } from "@resources/ThemedComponents";
import { formatNumber, useTranslation } from "@localization";
import { trainService } from "@services";
import { muscleGroupLabel } from "@utils/exerciseMuscleGroups";
import {
  FORM_WEEKS,
  RECORD_TILE_WEEKS,
  STREAK_MIN_WORKOUTS,
  WORKOUT_TILE_WEEKS,
  buildStaircasePath,
} from "@utils/trainLibrary";

// The six muscle-group colours, busiest group first. Data colours rather than
// theme tokens: a group keeps its colour whatever the accent.
const MUSCLE_GROUP_COLORS = ["#F7742E", "#4ED39A", "#B48CFF", "#E8B44A", "#E85C4A", "#5AA9FF"];

const WORKOUT_BAR_HEIGHT = 30;
const FORM_BAR_HEIGHT = 40;
const STAIRS_HEIGHT = 30;
const STAIRS_STROKE = 2;
// An empty week still stands this tall, so a quiet stretch reads as weeks
// rather than as nothing drawn.
const MIN_BAR_HEIGHT = 3;
// Until the numbers are in: a dash, not a confident zero.
const PENDING = "–";

function pendingBars(weeks) {
  return Array.from({ length: weeks }, (_, index) => ({
    weekStart: index,
    count: 0,
    ratio: 0,
    isCurrent: index === weeks - 1,
    inStreak: false,
  }));
}

function WeekBars({ bars, height, gap, radius, colorOf }) {
  return (
    <View style={[styles.bars, { height, gap }]}>
      {bars.map((bar) => (
        <View
          key={bar.weekStart}
          style={[
            styles.bar,
            {
              height: Math.max(MIN_BAR_HEIGHT, bar.ratio * height),
              borderRadius: radius,
              backgroundColor: colorOf(bar),
            },
          ]}
        />
      ))}
    </View>
  );
}

// Records added up week by week. Drawn to the measured width, so the steps
// fall on the same weeks as the bars in the tile beside it.
function RecordStairs({ ratios, color }) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={{ height: STAIRS_HEIGHT }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={STAIRS_HEIGHT}>
          <Path
            d={buildStaircasePath(ratios, {
              width,
              height: STAIRS_HEIGHT,
              inset: STAIRS_STROKE / 2,
            })}
            stroke={color}
            strokeWidth={STAIRS_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function MuscleGroups({ muscles, theme, t }) {
  const groups = muscles?.groups ?? [];
  const legend = muscles?.legend ?? [];

  return (
    <View style={styles.exercisesBody}>
      <View style={styles.muscleBar}>
        {groups.length > 0 ? (
          groups.map((group) => (
            <View
              key={group.label}
              style={[
                styles.muscleSegment,
                {
                  flex: group.share,
                  backgroundColor: MUSCLE_GROUP_COLORS[group.rank % MUSCLE_GROUP_COLORS.length],
                },
              ]}
            />
          ))
        ) : (
          <View
            style={[styles.muscleSegment, { flex: 1, backgroundColor: theme.raisedSurface }]}
          />
        )}
      </View>

      {legend.length > 0 ? (
        <View style={styles.legend}>
          {legend.map((group) => (
            <View key={group.label} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      MUSCLE_GROUP_COLORS[group.rank % MUSCLE_GROUP_COLORS.length],
                  },
                ]}
              />
              <ThemedText style={styles.legendLabel} setColor={theme.text} numberOfLines={1}>
                {muscleGroupLabel(group.label, t)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ProgramBars({ programs, theme }) {
  const bars = programs?.bars ?? [];

  return (
    <View style={styles.programBars}>
      {bars.map((bar) => (
        <ProgressBar
          key={bar.programId}
          progress={bar.progress}
          height={6}
          trackColor={theme.raisedSurface}
          fillColor={bar.kind === "complete" ? theme.secondary : theme.primary}
        />
      ))}
      {!programs || programs.showEmptySlot ? (
        <View style={[styles.programSlot, { borderColor: theme.textDisabled }]} />
      ) : null}
    </View>
  );
}

function FormCard({ form, theme, t, onPress }) {
  const primaryText = theme.primaryText ?? theme.primary;
  const streak = form?.streak ?? 0;
  const weeksLabel = t("trainLibrary.form.weeksInRow", { count: streak });
  const threshold = t("trainLibrary.form.threshold", {
    count: form?.minWorkouts ?? STREAK_MIN_WORKOUTS,
  });
  const average = form
    ? formatNumber(form.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : PENDING;
  const streakWeek = withAlpha(theme.primary, 0.38);
  const otherWeek = withAlpha(theme.title, 0.1);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={
        form
          ? t("trainLibrary.a11y.form", {
              streak: formatNumber(streak),
              weeks: weeksLabel,
              threshold,
              average,
            })
          : undefined
      }
      onPress={onPress}
      style={[
        styles.formCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: withAlpha(theme.primary, 0.32),
        },
      ]}
    >
      <View style={styles.formTop}>
        <View style={[styles.formIcon, { backgroundColor: withAlpha(theme.primary, 0.14) }]}>
          <Fire width={22} height={22} color={primaryText} />
        </View>

        <View style={styles.formCopy}>
          <View style={styles.formStreakRow}>
            <ThemedText style={styles.formStreakValue} setColor={theme.title}>
              {form ? formatNumber(streak) : PENDING}
            </ThemedText>
            <ThemedText style={styles.formStreakLabel} setColor={primaryText} numberOfLines={1}>
              {weeksLabel}
            </ThemedText>
          </View>
          <ThemedText style={styles.formThreshold} setColor={theme.quietText} numberOfLines={1}>
            {threshold}
          </ThemedText>
        </View>

        <View style={styles.formAverage}>
          <ThemedText style={styles.formAverageValue} setColor={theme.title}>
            {average}
          </ThemedText>
          <ThemedText style={styles.formAverageLabel} setColor={theme.quietText} numberOfLines={1}>
            {t("trainLibrary.form.perWeek")}
          </ThemedText>
        </View>
      </View>

      <WeekBars
        bars={form?.bars ?? pendingBars(FORM_WEEKS)}
        height={FORM_BAR_HEIGHT}
        gap={5}
        radius={4}
        colorOf={(bar) =>
          bar.isCurrent ? theme.primary : bar.inStreak ? streakWeek : otherWeek
        }
      />
    </TouchableOpacity>
  );
}

/**
 * The Train tab's library (spec sections 6 and 6.1): Workouts and Records,
 * "Your form" across the full width, then Exercises and Programs. Every tile
 * opens the screen it summarises.
 *
 * It loads its own numbers each time the screen gains focus, in two parts:
 * everything local at once, and the muscle groups when the cloud catalog
 * answers. `refreshKey` loads them again while the screen stays focused - a
 * pull to refresh, say.
 */
export default function TrainLibraryGrid({ style, refreshKey }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryText = theme.primaryText ?? theme.primary;
  const [library, setLibrary] = useState(null);
  const [muscles, setMuscles] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const now = Date.now();

      trainService
        .getLibraryOverview(db, { now })
        .then((next) => {
          if (!cancelled) {
            setLibrary(next);
          }
        })
        .catch((error) => console.error("Failed to load the Train library:", error));

      trainService
        .getLibraryMuscleGroups(db, { now })
        .then((next) => {
          if (!cancelled) {
            setMuscles(next);
          }
        })
        .catch((error) => console.error("Failed to load the Train muscle groups:", error));

      return () => {
        cancelled = true;
      };
    }, [db, refreshKey])
  );

  const workouts = library?.workouts ?? null;
  const records = library?.records ?? null;
  const programs = library?.programs ?? null;
  const exerciseCount = library?.exercises.count ?? null;
  const pastWorkoutWeek = withAlpha(theme.secondary, 0.55);

  return (
    <View style={[styles.grid, style]}>
      <View style={styles.row}>
        <LibraryTile
          title={t("trainLibrary.workouts")}
          icon={<Dumbbell width={17} height={17} color={theme.secondary} thickness={1.8} />}
          tint={theme.secondary}
          value={workouts ? formatNumber(workouts.total) : PENDING}
          addendum={workouts?.thisWeek > 0 ? `+${formatNumber(workouts.thisWeek)}` : null}
          addendumColor={theme.secondary}
          accessibilityLabel={
            workouts
              ? t("trainLibrary.a11y.workouts", {
                  total: formatNumber(workouts.total),
                  week: formatNumber(workouts.thisWeek),
                })
              : undefined
          }
          onPress={() => navigation.navigate("WorkoutLibraryPage")}
        >
          <WeekBars
            bars={workouts?.bars ?? pendingBars(WORKOUT_TILE_WEEKS)}
            height={WORKOUT_BAR_HEIGHT}
            gap={3}
            radius={2}
            colorOf={(bar) => (bar.isCurrent ? theme.primary : pastWorkoutWeek)}
          />
        </LibraryTile>

        <LibraryTile
          title={t("trainLibrary.records")}
          icon={<Star width={17} height={17} color={theme.record} />}
          tint={theme.record}
          borderColor={withAlpha(theme.record, 0.26)}
          value={records ? formatNumber(records.total) : PENDING}
          addendum={records?.thisWeek > 0 ? `+${formatNumber(records.thisWeek)}` : null}
          addendumColor={theme.record}
          accessibilityLabel={
            records
              ? t("trainLibrary.a11y.records", {
                  total: formatNumber(records.total),
                  week: formatNumber(records.thisWeek),
                })
              : undefined
          }
          onPress={() => navigation.navigate("PersonalRecordsPage")}
        >
          <RecordStairs
            ratios={
              records
                ? records.steps.map((step) => step.ratio)
                : Array.from({ length: RECORD_TILE_WEEKS }, () => 0)
            }
            color={theme.record}
          />
        </LibraryTile>
      </View>

      <FormCard
        form={library?.form ?? null}
        theme={theme}
        t={t}
        onPress={() => navigation.navigate("WorkoutLibraryPage")}
      />

      <View style={styles.row}>
        <LibraryTile
          title={t("trainLibrary.exercises")}
          icon={<Library width={17} height={17} color={theme.music} thickness={1.7} />}
          tint={theme.music}
          value={exerciseCount === null ? PENDING : formatNumber(exerciseCount)}
          accessibilityLabel={
            exerciseCount === null
              ? undefined
              : t("trainLibrary.a11y.exercises", { count: formatNumber(exerciseCount) })
          }
          onPress={() => navigation.navigate("ExerciseCatalogPage")}
        >
          <MuscleGroups muscles={muscles} theme={theme} t={t} />
        </LibraryTile>

        <LibraryTile
          title={t("trainLibrary.programs")}
          icon={<Layers width={17} height={17} color={primaryText} thickness={1.8} />}
          tint={theme.primary}
          value={programs ? formatNumber(programs.total) : PENDING}
          addendum={
            programs?.active > 0
              ? t("trainLibrary.activePrograms", { count: programs.active })
              : null
          }
          addendumColor={primaryText}
          accessibilityLabel={
            programs
              ? t("trainLibrary.a11y.programs", {
                  count: formatNumber(programs.total),
                  active: t("trainLibrary.activePrograms", { count: programs.active }),
                })
              : undefined
          }
          onPress={() => navigation.navigate("ProgramPage")}
        >
          <ProgramBars programs={programs} theme={theme} />
        </LibraryTile>
      </View>
    </View>
  );
}
