import { StatusBar } from "expo-status-bar";
import {
  Alert,
  FlatList,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./WorkoutLibraryPageStyle";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import RepeatWorkoutSheet from "../../Resources/Components/RepeatWorkoutSheet";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import Eye from "../../Resources/Icons/UI-icons/Eye";
import ReplayHistory from "../../Resources/Icons/UI-icons/ReplayHistory";
import Star from "../../Resources/Icons/UI-icons/Star";
import Resistance from "../../Resources/Icons/WorkoutLabels/Resistance";
import Run from "../../Resources/Icons/WorkoutLabels/Run";
import {
  ThemedBottomSheet,
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { programService } from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";
import {
  isWorkoutComingSoon,
  isWorkoutTypeComingSoon,
} from "../../Utils/workoutTypeAvailability";
import ComingSoonBadge from "../../Resources/Components/ComingSoonBadge";

const SORT_OPTIONS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "name", label: "Name (A-Z)" },
  { key: "exercises", label: "Most exercises" },
];

const TYPE_FILTERS = [
  { key: "all", label: "All types" },
  { key: "resistance", label: "Resistance" },
  { key: "run", label: "Run" },
  { key: "walk", label: "Walk" },
];

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getIconType(workout) {
  const workoutType = workout?.workout_type;

  if (workoutType === "Run") {
    return "run";
  }

  if (workoutType === "Walk") {
    return "walk";
  }

  return "resistance";
}

function getIconColors(iconType, theme) {
  if (iconType === "run") {
    return { color: theme.record, backgroundColor: withAlpha(theme.record, 0.14) };
  }

  if (iconType === "walk") {
    return {
      color: theme.secondary,
      backgroundColor: withAlpha(theme.secondary, 0.14),
    };
  }

  return { color: theme.primary, backgroundColor: withAlpha(theme.primary, 0.12) };
}

// "2026-07-12" -> "12 Jul 2026"
function formatWorkoutDate(isoDate) {
  if (typeof isoDate !== "string" || isoDate.length < 10) {
    return "No date";
  }

  const [year, month, day] = isoDate.slice(0, 10).split("-");
  const monthLabel = MONTH_LABELS[Number(month) - 1];

  if (!monthLabel) {
    return isoDate.slice(0, 10);
  }

  return `${Number(day)} ${monthLabel} ${year}`;
}

function sortWorkouts(workouts, sortKey) {
  const sorted = [...workouts];

  if (sortKey === "oldest") {
    return sorted.sort((left, right) =>
      String(left.date_iso ?? "").localeCompare(String(right.date_iso ?? ""))
    );
  }

  if (sortKey === "name") {
    return sorted.sort((left, right) =>
      String(left.label ?? "").localeCompare(String(right.label ?? ""))
    );
  }

  if (sortKey === "exercises") {
    return sorted.sort((left, right) => right.exerciseCount - left.exerciseCount);
  }

  return sorted.sort((left, right) =>
    String(right.date_iso ?? "").localeCompare(String(left.date_iso ?? ""))
  );
}

function WorkoutGlyph({ iconType, size, color }) {
  if (iconType === "run" || iconType === "walk") {
    return <Run width={size} height={size} primaryColor={color} />;
  }

  return <Resistance width={size} height={size} color={color} />;
}

function ToolbarPill({ label, isActive, onPress, theme }) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.toolbarPill,
        isActive
          ? {
              backgroundColor: withAlpha(theme.primary, 0.12),
              borderColor: withAlpha(theme.primary, 0.45),
            }
          : {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
      ]}
    >
      <ThemedText
        style={styles.toolbarPillText}
        setColor={isActive ? theme.primary : theme.quietText}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
      {/* Rotated a quarter turn: the pill opens a panel from the bottom, so the
          arrow has to point down, not on to a new screen. */}
      <View style={styles.pillChevron}>
        <ChevronRight
          width={14}
          height={14}
          color={isActive ? theme.primary : theme.quietText}
          thickness={2.4}
        />
      </View>
    </TouchableOpacity>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
  theme,
}) {
  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <ThemedText style={styles.optionSheetTitle} setColor={theme.quietText}>
        {title}
      </ThemedText>

      {options.map((option) => {
        const isSelected = option.key === selectedKey;
        const isComingSoon = isWorkoutTypeComingSoon(option.key);

        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.82}
            accessibilityRole="button"
            disabled={isComingSoon}
            accessibilityState={{
              selected: isSelected,
              disabled: isComingSoon,
            }}
            onPress={() => onSelect(option.key)}
            style={[
              styles.optionSheetRow,
              isSelected
                ? { backgroundColor: withAlpha(theme.primary, 0.12) }
                : null,
            ]}
          >
            <ThemedText
              style={styles.optionSheetLabel}
              setColor={
                isComingSoon
                  ? theme.quietText
                  : isSelected
                    ? theme.primary
                    : theme.title
              }
            >
              {option.label}
            </ThemedText>
            {isComingSoon ? (
              <ComingSoonBadge size="small" inline angle={-8} />
            ) : isSelected ? (
              <Checkmark width={15} height={15} color={primaryTextColor} />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ThemedBottomSheet>
  );
}

function WorkoutRow({
  workout,
  theme,
  isExpanded,
  previewItems,
  isLoadingPreview,
  onToggleExercises,
  onToggleFavorite,
  onRepeat,
  onOpen,
}) {
  const iconType = getIconType(workout);
  const isComingSoon = isWorkoutComingSoon(workout);
  const iconColors = isComingSoon
    ? {
        color: theme.quietText,
        backgroundColor: withAlpha(theme.quietText, 0.14),
      }
    : getIconColors(iconType, theme);
  const programLabel = workout.program_name ?? "No program";

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.rowTop}>
        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel={
            isComingSoon
              ? `${workout.label} — coming soon`
              : `Open workout ${workout.label}`
          }
          disabled={isComingSoon}
          accessibilityState={{ disabled: isComingSoon }}
          onPress={() => onOpen(workout)}
          style={[styles.rowMain, isComingSoon ? styles.comingSoonRow : null]}
        >
          <View
            style={[
              styles.iconTile,
              { backgroundColor: iconColors.backgroundColor },
            ]}
          >
            <WorkoutGlyph iconType={iconType} size={22} color={iconColors.color} />
          </View>

          <View style={styles.rowCopy}>
            <ThemedText
              style={styles.rowTitle}
              setColor={theme.title}
              numberOfLines={1}
            >
              {workout.label}
            </ThemedText>

            <ThemedText
              style={styles.rowMeta}
              setColor={theme.quietText}
              numberOfLines={1}
            >
              {`${formatWorkoutDate(workout.date_iso)} · ${programLabel}`}
            </ThemedText>

            <View style={styles.rowChips}>
              <View
                style={[styles.rowChip, { backgroundColor: theme.chipBackground }]}
              >
                <ThemedText style={styles.rowChipText} setColor={theme.text}>
                  {`${workout.exerciseCount} ${
                    workout.exerciseCount === 1 ? "exercise" : "exercises"
                  }`}
                </ThemedText>
              </View>

              <View
                style={[styles.rowChip, { backgroundColor: theme.chipBackground }]}
              >
                <ThemedText style={styles.rowChipText} setColor={theme.text}>
                  {`${workout.completedSetCount}/${workout.setCount} sets`}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.rowChip,
                  {
                    backgroundColor: workout.isCompleted
                      ? withAlpha(theme.secondary, 0.14)
                      : withAlpha(theme.primary, 0.12),
                  },
                ]}
              >
                <ThemedText
                  style={styles.rowChipText}
                  setColor={workout.isCompleted ? theme.secondary : theme.primary}
                >
                  {workout.isCompleted ? "Completed" : "Planned"}
                </ThemedText>
              </View>

              {isComingSoon ? (
                <ComingSoonBadge size="small" inline angle={-6} />
              ) : null}

              {workout.hasPersonalRecord ? (
                <View
                  style={[
                    styles.rowChip,
                    { backgroundColor: withAlpha(theme.planned, 0.16) },
                  ]}
                >
                  <ThemedText style={styles.rowChipText} setColor={theme.planned}>
                    PR
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: workout.isFavorite }}
          accessibilityLabel={
            workout.isFavorite
              ? `Remove ${workout.label} from favorites`
              : `Save ${workout.label} to favorites`
          }
          onPress={() => onToggleFavorite(workout)}
          style={styles.favoriteButton}
        >
          <Star
            width={20}
            height={20}
            color={workout.isFavorite ? theme.planned : theme.quietText}
            filled={workout.isFavorite}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.actionsRow, { borderTopColor: theme.cardBorder }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            isExpanded
              ? `Hide exercises in ${workout.label}`
              : `Show exercises in ${workout.label}`
          }
          onPress={() => onToggleExercises(workout)}
          style={[
            styles.actionButton,
            isExpanded
              ? {
                  backgroundColor: withAlpha(theme.primary, 0.12),
                  borderColor: withAlpha(theme.primary, 0.45),
                }
              : { borderColor: theme.cardBorder },
          ]}
        >
          <Eye
            width={15}
            height={15}
            color={isExpanded ? theme.primary : theme.quietText}
          />
          <ThemedText
            style={styles.actionButtonText}
            setColor={isExpanded ? theme.primary : theme.quietText}
          >
            Exercises
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Repeat ${workout.label}`}
          disabled={isComingSoon}
          accessibilityState={{ disabled: isComingSoon }}
          onPress={() => onRepeat(workout)}
          style={[
            styles.actionButton,
            isComingSoon
              ? {
                  backgroundColor: withAlpha(theme.quietText, 0.1),
                  borderColor: withAlpha(theme.quietText, 0.32),
                }
              : {
                  backgroundColor: withAlpha(theme.primary, 0.12),
                  borderColor: withAlpha(theme.primary, 0.45),
                },
          ]}
        >
          <ReplayHistory
            width={15}
            height={15}
            color={isComingSoon ? theme.quietText : theme.primary}
          />
          <ThemedText
            style={styles.actionButtonText}
            setColor={isComingSoon ? theme.quietText : theme.primary}
          >
            Repeat
          </ThemedText>
        </TouchableOpacity>
      </View>

      {isExpanded ? (
        <View style={[styles.exerciseList, { borderTopColor: theme.cardBorder }]}>
          {isLoadingPreview ? (
            <ThemedText style={styles.exerciseDetail} setColor={theme.quietText}>
              Loading exercises...
            </ThemedText>
          ) : previewItems.length > 0 ? (
            previewItems.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.exerciseRow}>
                <ThemedText
                  style={styles.exerciseName}
                  setColor={theme.title}
                  numberOfLines={1}
                >
                  {item.label}
                </ThemedText>
                {item.detail ? (
                  <ThemedText
                    style={styles.exerciseDetail}
                    setColor={theme.quietText}
                    numberOfLines={1}
                  >
                    {item.detail}
                  </ThemedText>
                ) : null}
              </View>
            ))
          ) : (
            <ThemedText style={styles.exerciseDetail} setColor={theme.quietText}>
              No exercises on this workout.
            </ThemedText>
          )}
        </View>
      ) : null}
    </View>
  );
}

const WorkoutLibraryPage = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [workouts, setWorkouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState("newest");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState(null);
  const [previewsByWorkoutId, setPreviewsByWorkoutId] = useState({});
  const [loadingPreviewId, setLoadingPreviewId] = useState(null);
  const [repeatWorkout, setRepeatWorkout] = useState(null);
  const [isRepeating, setIsRepeating] = useState(false);

  const loadWorkouts = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await programService.getWorkoutLibrary(db);
      setWorkouts(rows);
    } catch (error) {
      console.error("Failed to load workout library:", error);
      setWorkouts([]);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  const visibleWorkouts = useMemo(() => {
    let filtered = workouts;

    if (favoritesOnly) {
      filtered = filtered.filter((workout) => workout.isFavorite);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(
        (workout) => getIconType(workout) === typeFilter
      );
    }

    return sortWorkouts(filtered, sortKey);
  }, [favoritesOnly, sortKey, typeFilter, workouts]);

  const handleToggleFavorite = useCallback(
    async (workout) => {
      const nextIsFavorite = !workout.isFavorite;

      // Optimistic: the star should not wait for the write.
      setWorkouts((current) =>
        current.map((item) =>
          item.workout_id === workout.workout_id
            ? { ...item, isFavorite: nextIsFavorite }
            : item
        )
      );

      try {
        await programService.setWorkoutFavorite(db, {
          workoutId: workout.workout_id,
          isFavorite: nextIsFavorite,
        });
      } catch (error) {
        console.error("Failed to update favorite:", error);
        setWorkouts((current) =>
          current.map((item) =>
            item.workout_id === workout.workout_id
              ? { ...item, isFavorite: workout.isFavorite }
              : item
          )
        );
      }
    },
    [db]
  );

  const handleToggleExercises = useCallback(
    async (workout) => {
      const workoutId = workout.workout_id;

      if (expandedWorkoutId === workoutId) {
        setExpandedWorkoutId(null);
        return;
      }

      setExpandedWorkoutId(workoutId);

      if (previewsByWorkoutId[workoutId]) {
        return;
      }

      try {
        setLoadingPreviewId(workoutId);
        const previewItems = await programService.getWorkoutExercisePreview(
          db,
          workoutId
        );
        setPreviewsByWorkoutId((current) => ({
          ...current,
          [workoutId]: previewItems,
        }));
      } catch (error) {
        console.error("Failed to load workout exercises:", error);
        setPreviewsByWorkoutId((current) => ({ ...current, [workoutId]: [] }));
      } finally {
        setLoadingPreviewId(null);
      }
    },
    [db, expandedWorkoutId, previewsByWorkoutId]
  );

  const handleOpenWorkout = useCallback(
    (workout) => {
      if (isWorkoutComingSoon(workout)) {
        return;
      }

      navigation.navigate("WorkoutPage", {
        workout_id: workout.workout_id,
        workout_label: workout.label,
        workout_type: workout.workout_type,
        day: workout.weekday,
        date: workout.date,
        program_id: workout.program_id,
      });
    },
    [navigation]
  );

  const handleStartRepeat = useCallback(async () => {
    if (!repeatWorkout || isRepeating || isWorkoutComingSoon(repeatWorkout)) {
      return;
    }

    setIsRepeating(true);

    try {
      const today = getTodaysDate();
      const programTargets = await programService.getWorkoutCopyProgramTargets(
        db,
        { date: today }
      );
      const target = programTargets[0] ?? null;
      let copiedWorkout = null;

      if (target?.day_id) {
        const copiedWorkoutId = await programService.copyWorkoutToProgramDay(db, {
          workoutId: repeatWorkout.workout_id,
          dayId: target.day_id,
          date: target.date,
        });

        copiedWorkout = copiedWorkoutId
          ? {
              workout_id: copiedWorkoutId,
              workout_label: repeatWorkout.label,
              workout_type: repeatWorkout.workout_type,
              day: target.weekday,
              date: target.date,
              program_id: target.program_id,
            }
          : null;
      } else {
        copiedWorkout = await programService.copyWorkoutToStandaloneDate(db, {
          workoutId: repeatWorkout.workout_id,
          date: today,
        });
      }

      if (!copiedWorkout) {
        throw new Error("The workout could not be copied.");
      }

      setRepeatWorkout(null);
      navigation.navigate("WorkoutPage", {
        workout_id: copiedWorkout.workout_id,
        workout_label: copiedWorkout.workout_label,
        workout_type: copiedWorkout.workout_type,
        day: copiedWorkout.day,
        date: copiedWorkout.date,
        program_id: copiedWorkout.program_id,
      });
    } catch (error) {
      console.error("Failed to start repeated workout:", error);
      Alert.alert("Could not start", "The workout could not be copied to today.");
    } finally {
      setIsRepeating(false);
    }
  }, [db, isRepeating, navigation, repeatWorkout]);

  const handlePlanRepeat = useCallback(
    async (target) => {
      if (!repeatWorkout || isRepeating || isWorkoutComingSoon(repeatWorkout)) {
        return;
      }

      setIsRepeating(true);

      try {
        const copiedWorkoutId = await programService.copyWorkoutToProgramDay(db, {
          workoutId: repeatWorkout.workout_id,
          dayId: target.dayId,
          date: target.date,
        });

        if (!copiedWorkoutId) {
          throw new Error("The workout could not be planned.");
        }

        setRepeatWorkout(null);
        await loadWorkouts();
        Alert.alert(
          "Workout planned",
          `${repeatWorkout.label} was added to ${target.weekday ?? "the day"}.`
        );
      } catch (error) {
        console.error("Failed to plan repeated workout:", error);
        Alert.alert("Could not plan", "The workout could not be copied there.");
      } finally {
        setIsRepeating(false);
      }
    },
    [db, isRepeating, loadWorkouts, repeatWorkout]
  );

  // Sorting cannot empty the list, so only the two real filters are reset.
  const hasActiveFilters = favoritesOnly || typeFilter !== "all";

  const clearFilters = useCallback(() => {
    setFavoritesOnly(false);
    setTypeFilter("all");
  }, []);

  const sortOption =
    SORT_OPTIONS.find((option) => option.key === sortKey) ?? SORT_OPTIONS[0];
  const typeOption =
    TYPE_FILTERS.find((option) => option.key === typeFilter) ?? TYPE_FILTERS[0];

  const listHeader = (
    <View style={styles.toolbar}>
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityState={{ selected: favoritesOnly }}
        accessibilityLabel={
          favoritesOnly ? "Show all workouts" : "Show favorites only"
        }
        onPress={() => setFavoritesOnly((isOn) => !isOn)}
        style={[
          styles.toolbarIconButton,
          favoritesOnly
            ? {
                backgroundColor: withAlpha(theme.primary, 0.12),
                borderColor: withAlpha(theme.primary, 0.45),
              }
            : {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
        ]}
      >
        <Star
          width={16}
          height={16}
          color={favoritesOnly ? theme.planned : theme.quietText}
          filled={favoritesOnly}
        />
      </TouchableOpacity>

      <ToolbarPill
        label={sortOption.label}
        isActive={sortKey !== "newest"}
        onPress={() => setOpenMenu("sort")}
        theme={theme}
      />

      <ToolbarPill
        label={typeOption.label}
        isActive={typeFilter !== "all"}
        onPress={() => setOpenMenu("type")}
        theme={theme}
      />

      <ThemedText style={styles.resultCount} setColor={theme.quietText}>
        {visibleWorkouts.length}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <ThemedTitle type="h3" numberOfLines={1}>
          Your workouts
        </ThemedTitle>
      </ThemedHeader>

      {isLoading ? (
        <ThemedStateBlock />
      ) : (
        <FlatList
          data={visibleWorkouts}
          keyExtractor={(workout) => String(workout.workout_id)}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <ThemedStateBlock
              variant="empty"
              message={
                !hasActiveFilters
                  ? "Your finished workouts show up here."
                  : favoritesOnly
                    ? "You have not saved any favorites yet."
                    : "No workouts match these filters."
              }
              actionLabel={hasActiveFilters ? "Reset filters" : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
            />
          }
          renderItem={({ item }) => (
            <WorkoutRow
              workout={item}
              theme={theme}
              isExpanded={expandedWorkoutId === item.workout_id}
              previewItems={previewsByWorkoutId[item.workout_id] ?? []}
              isLoadingPreview={loadingPreviewId === item.workout_id}
              onToggleExercises={handleToggleExercises}
              onToggleFavorite={handleToggleFavorite}
              onRepeat={setRepeatWorkout}
              onOpen={handleOpenWorkout}
            />
          )}
        />
      )}

      <OptionSheet
        visible={openMenu === "sort"}
        title="SORT BY"
        options={SORT_OPTIONS}
        selectedKey={sortKey}
        onSelect={(key) => {
          setSortKey(key);
          setOpenMenu(null);
        }}
        onClose={() => setOpenMenu(null)}
        theme={theme}
      />

      <OptionSheet
        visible={openMenu === "type"}
        title="WORKOUT TYPE"
        options={TYPE_FILTERS}
        selectedKey={typeFilter}
        onSelect={(key) => {
          setTypeFilter(key);
          setOpenMenu(null);
        }}
        onClose={() => setOpenMenu(null)}
        theme={theme}
      />

      <RepeatWorkoutSheet
        visible={Boolean(repeatWorkout)}
        workout={repeatWorkout}
        isWorking={isRepeating}
        onClose={() => setRepeatWorkout(null)}
        onStart={handleStartRepeat}
        onPlan={handlePlanRepeat}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default WorkoutLibraryPage;
