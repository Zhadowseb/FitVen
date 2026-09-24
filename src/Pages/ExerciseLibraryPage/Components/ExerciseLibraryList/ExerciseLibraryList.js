import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
// A deep import, because React Native does not re-export this from its root.
// It is the same module Modal pulls it from; see the list below for why.
import { VirtualizedListContextResetter } from "react-native/Libraries/Lists/VirtualizedListContext";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@localization";

import styles, {
  EXERCISE_PREVIEW_WIDTH,
  VISIBLE_EXERCISE_COUNT,
} from "./ExerciseLibraryListStyle";
import ExerciseFilterSheet from "../ExerciseFilterSheet/ExerciseFilterSheet";
import { weightliftingService } from "../../../../Services";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import Cross from "../../../../Resources/Icons/UI-icons/Cross";
import BodyMapPreview from "../../../../Resources/Components/BodyMapPreview/BodyMapPreview";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import Filter from "../../../../Resources/Icons/UI-icons/Filter";
import Library from "../../../../Resources/Icons/UI-icons/Library";
import Plus from "../../../../Resources/Icons/UI-icons/Plus";
import Search from "../../../../Resources/Icons/UI-icons/Search";
import Star from "../../../../Resources/Icons/UI-icons/Star";
import ExerciseMapBody from "../../../ExerciseMapPage/ExerciseMapBody";
import ReplayHistory from "../../../../Resources/Icons/UI-icons/ReplayHistory";
import {
  EXERCISE_MUSCLE_GROUPS,
  EXERCISE_MUSCLE_FILTERS,
  muscleGroupLabel,
  toggleExerciseMuscleFilterKey,
} from "../../../../Utils/exerciseMuscleGroups";
import {
  ThemedCard,
  ThemedModal,
  ThemedText,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";

// Translated at render time, so the labels follow a language switch.
const GROUP_FILTERS = [
  { key: "all", labelKey: "exercises.trainingGroups.all" },
  { key: "push", labelKey: "exercises.trainingGroups.push" },
  { key: "pull", labelKey: "exercises.trainingGroups.pull" },
  { key: "legs", labelKey: "exercises.trainingGroups.legs" },
  { key: "core", labelKey: "exercises.trainingGroups.core" },
  { key: "mobility", labelKey: "exercises.trainingGroups.mobility" },
];

const MUSCLE_FILTERS = EXERCISE_MUSCLE_FILTERS;

// A stable empty array: ExerciseMapBody is memoised, and a fresh [] on every
// render would defeat that for every muscle on both figures.
const EMPTY_REGION_KEYS = [];

const catalogKeyExtractor = (exercise) => exercise.exercise_name;
const EMPTY_ADDED_NAMES = [];

/**
 * One row of the catalog.
 *
 * Pulled out and memoised because every row mounts a body figure - an image
 * plus an SVG overlay - and the list used to build all of them at once. See
 * the FlatList below for the measurements.
 */
const CatalogExerciseRow = memo(function CatalogExerciseRow({
  exercise,
  isLast,
  isSelecting,
  isAdded,
  isFavourite,
  isSelectionBusy,
  isWorkoutPicker,
  colors,
  onPress,
  onToggleFavourite,
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isWorkoutPicker
          ? t(
              isAdded
                ? "exercises.library.addAnotherToWorkoutA11y"
                : "exercises.library.addToWorkoutA11y",
              { name: exercise.exercise_name }
            )
          : t("exercises.library.showMusclesA11y", {
              name: exercise.exercise_name,
            })
      }
      disabled={isSelectionBusy}
      onPress={() => onPress(exercise)}
      style={[
        styles.exerciseRow,
        isLast && styles.exerciseRowLast,
        isSelecting && styles.exerciseRowSelected,
        { borderColor: colors.cardBorder },
      ]}
    >
      {/* Not `ExerciseMapBody`, deliberately. Drawing the map's figure here
          matches it exactly but costs all 33 muscle shapes once per visible
          row: measured at 420 ms against 71 ms for this, for the same tap.
          `BodyMapPreview` draws the body once as an image and only the
          muscles that actually work, in the map's colours. */}
      <BodyMapPreview
        bodyView={exercise.body_map_view}
        crop={exercise.body_map_section}
        primaryRegionKeys={exercise.primary_body_map_region_keys}
        secondaryRegionKeys={exercise.secondary_body_map_region_keys}
        style={styles.exercisePreviewBodyMap}
      />

      <View style={styles.exerciseBody}>
        <View style={styles.exerciseTitleRow}>
          <ThemedText
            style={styles.exerciseName}
            setColor={colors.titleColor}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {exercise.exercise_name}
          </ThemedText>

          {/* Only the ones the user made themselves are worth marking.
              Everything else in the catalog is official, so saying so on
              almost every row said nothing. */}
          {exercise.is_custom ? (
            <View
              style={[
                styles.exerciseStatusBadge,
                { backgroundColor: colors.primaryColor },
              ]}
            >
              <ThemedText
                style={styles.exerciseStatusBadgeText}
                setColor={colors.activeFilterText}
              >
                {t("exercises.library.customBadge")}
              </ThemedText>
            </View>
          ) : null}

          {/* The sheet stays open now, so a row has to say whether it has
              already gone in. */}
          {isAdded ? (
            <View
              style={[
                styles.exerciseStatusBadge,
                { backgroundColor: colors.secondaryColor },
              ]}
            >
              <ThemedText
                style={styles.exerciseStatusBadgeText}
                setColor={colors.activeFilterText}
              >
                {t("exercises.library.addedBadge")}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: isFavourite }}
        accessibilityLabel={
          isFavourite
            ? t("exercises.library.removeFavouriteA11y", {
                name: exercise.exercise_name,
              })
            : t("exercises.library.addFavouriteA11y", {
                name: exercise.exercise_name,
              })
        }
        onPress={(event) => {
          event.stopPropagation?.();
          onToggleFavourite(exercise);
        }}
        style={styles.favouriteToggle}
      >
        <Star
          width={19}
          height={19}
          color={isFavourite ? colors.starColor : colors.quietText}
          filled={isFavourite}
          roundness={1.6}
        />
      </TouchableOpacity>
    </Pressable>
  );
});

// Which group owns each muscle on the figure. The map and the filter sheet are
// one selection, so tapping a muscle has to land on the same key the sheet
// would have set - otherwise the sheet opens showing nothing chosen.
const MUSCLE_FILTER_KEY_BY_REGION_KEY = new Map(
  MUSCLE_FILTERS.flatMap((filter) =>
    filter.regionKeys.map((regionKey) => [regionKey, filter.key])
  )
);


const MUSCLE_LABEL_BY_REGION_KEY = EXERCISE_MUSCLE_GROUPS.reduce(
  (labelsByRegionKey, group) => {
    for (const region of group.regions) {
      labelsByRegionKey.set(region.key, group.label);
    }

    return labelsByRegionKey;
  },
  new Map()
);

const EXERCISE_REGION_KEY_FIELDS = [
  "primary_body_map_region_keys",
  "secondary_body_map_region_keys",
  "primary_front_body_map_region_keys",
  "secondary_front_body_map_region_keys",
  "primary_back_body_map_region_keys",
  "secondary_back_body_map_region_keys",
];

const getExerciseRegionKeySet = (exercise) => {
  const regionKeys = new Set();

  for (const field of EXERCISE_REGION_KEY_FIELDS) {
    const values = Array.isArray(exercise?.[field]) ? exercise[field] : [];

    for (const value of values) {
      if (typeof value === "string" && value.trim() !== "") {
        regionKeys.add(value.trim().toLocaleLowerCase());
      }
    }
  }

  return regionKeys;
};

const getWorkoutPickerName = (workoutPicker) =>
  workoutPicker?.workoutName ??
  workoutPicker?.name ??
  workoutPicker?.title ??
  workoutPicker?.workoutTitle ??
  "";

const getUniqueExerciseMuscleLabels = (exercise, fieldNames) => {
  const labels = [];
  const seenLabels = new Set();

  for (const fieldName of fieldNames) {
    const values = Array.isArray(exercise?.[fieldName])
      ? exercise[fieldName]
      : [];

    for (const rawRegionKey of values) {
      const regionKey =
        typeof rawRegionKey === "string" ? rawRegionKey.trim() : "";
      const label = MUSCLE_LABEL_BY_REGION_KEY.get(regionKey);

      if (!label || seenLabels.has(label)) {
        continue;
      }

      labels.push(label);
      seenLabels.add(label);
    }
  }

  return labels;
};

const getExerciseMuscleLabelFields = (role) =>
  role === "primary"
    ? [
        "primary_body_map_region_keys",
        "primary_front_body_map_region_keys",
        "primary_back_body_map_region_keys",
      ]
    : [
        "secondary_body_map_region_keys",
        "secondary_front_body_map_region_keys",
        "secondary_back_body_map_region_keys",
      ];

const getExerciseMuscleLabels = (exercise, role) =>
  getUniqueExerciseMuscleLabels(exercise, getExerciseMuscleLabelFields(role));

const getExerciseMuscleSummary = (exercise, role) => {
  const labels = getExerciseMuscleLabels(exercise, role);

  if (labels.length > 0) {
    return labels.join(", ");
  }

  const count =
    role === "primary"
      ? Number(exercise?.primary_muscle_count) || 0
      : Number(exercise?.secondary_muscle_count) || 0;

  if (count <= 0) {
    return "";
  }

  return formatMuscleBadgeLabel(count, role === "primary" ? "primary" : "secondary");
};

const formatMuscleBadgeLabel = (count, label) => `${count}\u00A0${label}`;

const ExerciseMuscleBadges = ({
  primaryBadgeSurface,
  primaryBadgeText,
  primaryCount,
  secondaryBadgeSurface,
  secondaryBadgeText,
  secondaryCount,
  style,
}) => {
  const { t } = useTranslation();
  const shouldShowSecondaryBadge = Number(secondaryCount) > 0;

  return (
    <View style={[styles.muscleBadgeRow, style]}>
      <View
        style={[
          styles.muscleBadge,
          styles.primaryMuscleBadge,
          { backgroundColor: primaryBadgeSurface },
        ]}
      >
        <ThemedText
          style={styles.muscleBadgeText}
          setColor={primaryBadgeText}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {formatMuscleBadgeLabel(
            primaryCount,
            t("exercises.library.badgePrimary")
          )}
        </ThemedText>
      </View>

      {shouldShowSecondaryBadge && (
        <View
          style={[
            styles.muscleBadge,
            styles.secondaryMuscleBadge,
            { backgroundColor: secondaryBadgeSurface },
          ]}
        >
          <ThemedText
            style={styles.muscleBadgeText}
            setColor={secondaryBadgeText}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {formatMuscleBadgeLabel(
              secondaryCount,
              t("exercises.library.badgeSecondary")
            )}
          </ThemedText>
        </View>
      )}
    </View>
  );
};

const ExerciseLibraryList = ({
  refreshKey,
  mode = "catalog",
  onSelectExercise,
  onAddCustomExercise,
  selectingExerciseName = null,
  addedExerciseNames = EMPTY_ADDED_NAMES,
  workoutPicker = null,
  initialFilter = null,
}) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [exercises, set_exercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupKey, setSelectedGroupKey] = useState("all");
  const [selectedMuscleKeys, setSelectedMuscleKeys] = useState(["all"]);
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState("all");
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [favouriteNames, setFavouriteNames] = useState(() => new Set());
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(
    initialFilter === "favourites"
  );
  const [showRecentOnly, setShowRecentOnly] = useState(
    initialFilter === "recent"
  );
  const [recentNames, setRecentNames] = useState(() => new Set());

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // The body map is 503x1294, so width-driven sizing makes it far too tall for
  // the modal. Drive it by height and let aspectRatio give the width.
  // Two figures side by side. The model is 503x1294, so the height is about
  // 2.6x whatever width is given - kept small enough that the list starts
  // above the fold, because the map is a control here, not the subject.
  const catalogMapWidth = Math.max(
    72,
    Math.min(96, Math.round((windowWidth - 120) / 2))
  );
  const bodyMapFigureHeight = Math.max(
    140,
    Math.min(210, Math.round(windowHeight * 0.23))
  );
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const primaryColor = theme.primary;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary;
  const cardSurface =
    theme.cardBackground ?? theme.navBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const inputSurface = theme.background ?? cardSurface;
  const activeFilterText = theme.cardBackground ?? theme.textInverted;
  const primaryBadgeSurface = withAlpha(theme.secondary, 0.2);
  const secondaryBadgeSurface = withAlpha(theme.primary, 0.18);
  const primaryBadgeText = secondaryColor;
  const secondaryBadgeText = primaryColor;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const isAllMusclesSelected = selectedMuscleKeys.includes("all");
  // Memoised for its identity, not for the cost of the filter itself. It feeds
  // `highlightedRegionKeys`, which is the `selected` prop of both figures, and
  // a fresh array here made that memo miss on every render - so `ExerciseMapBody`
  // re-rendered both figures, 67 gradient-filled paths, on every keystroke and
  // every filter change for as long as any muscle was selected. Measured at
  // 645 ms of blocked UI for a single tap before this.
  const selectedMuscleFilters = useMemo(
    () =>
      isAllMusclesSelected
        ? [MUSCLE_FILTERS[0]]
        : MUSCLE_FILTERS.filter((filter) =>
            selectedMuscleKeys.includes(filter.key)
          ),
    [isAllMusclesSelected, selectedMuscleKeys]
  );
  const filteredExercises = exercises.filter((exercise) => {
    const exerciseName = exercise.exercise_name ?? "";
    const nickname = exercise.nickname ?? "";
    const matchesSearch =
      normalizedSearchQuery === "" ||
      exerciseName.toLocaleLowerCase().includes(normalizedSearchQuery) ||
      nickname.toLocaleLowerCase().includes(normalizedSearchQuery);
    const groupKeys = Array.isArray(exercise.group_keys)
      ? exercise.group_keys
      : [];
    const matchesGroup =
      selectedGroupKey === "all" || groupKeys.includes(selectedGroupKey);
    const regionKeySet = getExerciseRegionKeySet(exercise);
    // SPM-6: this used to require every chosen muscle to be in the same
    // exercise. It reads well with two and is useless with more - chest, traps,
    // abs and lower back together matched nothing at all, because no exercise
    // trains all four. What people mean by picking four muscles is "show me
    // exercises for these", so any of them counts.
    const matchesMuscle =
      isAllMusclesSelected ||
      selectedMuscleFilters.some((filter) =>
        filter.regionKeys.some((regionKey) => regionKeySet.has(regionKey))
      );
    const matchesType =
      exerciseTypeFilter === "all" ||
      (exerciseTypeFilter === "custom" && Boolean(exercise.is_custom)) ||
      (exerciseTypeFilter === "builtin" && !exercise.is_custom);

    const lowerCasedName = exerciseName.toLocaleLowerCase();
    const matchesFavourite =
      !showFavouritesOnly || favouriteNames.has(lowerCasedName);
    const matchesRecent = !showRecentOnly || recentNames.has(lowerCasedName);

    return (
      matchesSearch &&
      matchesGroup &&
      matchesMuscle &&
      matchesType &&
      matchesFavourite &&
      matchesRecent
    );
  });

  // The figure lights up the muscles of every chosen group, whether the group
  // was chosen in the sheet or by tapping one of its muscles here.
  const highlightedRegionKeys = useMemo(() => {
    if (isAllMusclesSelected) {
      return EMPTY_REGION_KEYS;
    }

    return [
      ...new Set(
        selectedMuscleFilters.flatMap((filter) => filter.regionKeys)
      ),
    ];
  }, [isAllMusclesSelected, selectedMuscleFilters]);

  const muscleFilterLabels = isAllMusclesSelected
    ? []
    : selectedMuscleFilters.map((filter) => muscleGroupLabel(filter.key, t));

  /**
   * Turns the group a muscle belongs to on or off, from the figure.
   *
   * The same key the filter sheet sets, so tapping traps here shows Traps
   * selected there. Every muscle on the figure belongs to a group, but the
   * lookup can still miss if the map gains a region the groups do not know,
   * and then the tap does nothing rather than filtering to nothing.
   */
  const toggleRegionKey = useCallback((regionKey) => {
    const filterKey = MUSCLE_FILTER_KEY_BY_REGION_KEY.get(regionKey);

    if (!filterKey) {
      return;
    }

    setSelectedMuscleKeys((currentKeys) =>
      toggleExerciseMuscleFilterKey(currentKeys, filterKey)
    );
  }, []);

  const isFavouriteExercise = (exercise) =>
    favouriteNames.has((exercise.exercise_name ?? "").toLocaleLowerCase());

  // `toggleFavourite` is redefined on every render, and handing the memoised
  // row a new callback each time would undo the memo. The ref keeps the row's
  // prop stable while still calling the current version.
  const toggleFavouriteRef = useRef(null);
  const handleToggleFavourite = useCallback(
    (exercise) => toggleFavouriteRef.current?.(exercise),
    []
  );
  const rowColors = useMemo(
    () => ({
      cardBorder,
      titleColor,
      primaryColor,
      secondaryColor,
      activeFilterText,
      quietText,
      starColor: theme.planned,
    }),
    [
      cardBorder,
      titleColor,
      primaryColor,
      secondaryColor,
      activeFilterText,
      quietText,
      theme.planned,
    ]
  );

  // Starred first, and otherwise in the order the catalog came back in.
  filteredExercises.sort(
    (left, right) =>
      (isFavouriteExercise(left) ? 0 : 1) - (isFavouriteExercise(right) ? 0 : 1)
  );
  const isWorkoutPicker = mode === "workout-picker";
  const isSelectionBusy = Boolean(selectingExerciseName);
  const addedNameSet = useMemo(
    () => new Set(addedExerciseNames),
    [addedExerciseNames]
  );
  const activeFilterCount =
    (selectedGroupKey === "all" ? 0 : 1) +
    (isAllMusclesSelected ? 0 : selectedMuscleKeys.length) +
    (exerciseTypeFilter === "all" ? 0 : 1) +
    (showFavouritesOnly ? 1 : 0) +
    (showRecentOnly ? 1 : 0);

  const activeFilterChips = [];

  if (selectedGroupKey !== "all") {
    activeFilterChips.push({
      key: `group-${selectedGroupKey}`,
      label: (() => {
        const labelKey = GROUP_FILTERS.find(
          (filter) => filter.key === selectedGroupKey
        )?.labelKey;

        return labelKey ? t(labelKey) : selectedGroupKey;
      })(),
      onRemove: () => setSelectedGroupKey("all"),
    });
  }

  // No chips for muscles. The figure shows which are chosen and a second tap
  // clears them, so a row of chips saying the same thing only cost space.

  if (exerciseTypeFilter !== "all") {
    activeFilterChips.push({
      key: `type-${exerciseTypeFilter}`,
      label:
        exerciseTypeFilter === "custom"
          ? t("exercises.types.custom")
          : t("exercises.types.builtin"),
      onRemove: () => setExerciseTypeFilter("all"),
    });
  }

  if (showFavouritesOnly) {
    activeFilterChips.push({
      key: "favourites",
      label: t("exercises.library.favourites"),
      onRemove: () => setShowFavouritesOnly(false),
    });
  }

  if (showRecentOnly) {
    activeFilterChips.push({
      key: "recent",
      label: t("exercises.library.lastFourWorkouts"),
      onRemove: () => setShowRecentOnly(false),
    });
  }

  const clearAllFilters = () => {
    setSelectedGroupKey("all");
    setSelectedMuscleKeys(["all"]);
    setExerciseTypeFilter("all");
    setShowFavouritesOnly(false);
    setShowRecentOnly(false);
  };

  const visibleCount = filteredExercises.length;
  const loadExerciseStorage = async () => {
    try {
      setIsLoadingExercises(true);

      const [rows, favourites, recent] = await Promise.all([
        weightliftingService.getExerciseLibraryEntries(db),
        weightliftingService.getFavouriteExerciseNames(db),
        weightliftingService.getRecentlyUsedExerciseNames(db, {
          excludeWorkoutId: workoutPicker?.workoutId ?? null,
        }),
      ]);

      set_exercises(rows);
      setFavouriteNames(favourites);
      setRecentNames(recent);
    } catch (error) {
      console.error("Error loading exercise storage", error);
    } finally {
      setIsLoadingExercises(false);
    }
  };

  /**
   * Stars or un-stars an exercise.
   *
   * The star flips before the write finishes, because the write also queues a
   * cloud sync and waiting on that would make the tap feel broken. If the write
   * fails the star goes back, so the screen never shows something it did not
   * manage to store.
   */
  const toggleFavourite = async (exercise) => {
    const exerciseName = exercise.exercise_name ?? "";
    const key = exerciseName.toLocaleLowerCase();

    if (!key) {
      return;
    }

    const wasFavourite = favouriteNames.has(key);
    const applyFavourite = (shouldBeFavourite) => {
      setFavouriteNames((currentNames) => {
        const nextNames = new Set(currentNames);

        if (shouldBeFavourite) {
          nextNames.add(key);
        } else {
          nextNames.delete(key);
        }

        return nextNames;
      });
    };

    applyFavourite(!wasFavourite);

    try {
      await weightliftingService.setExerciseFavourite(db, {
        exerciseName,
        isFavourite: !wasFavourite,
      });
    } catch (error) {
      console.error("Could not change the exercise favourite", error);
      applyFavourite(wasFavourite);
    }
  };

  toggleFavouriteRef.current = toggleFavourite;

  const handleRowPress = useCallback(
    (exercise) => {
      if (isWorkoutPicker) {
        onSelectExercise?.(exercise);
        return;
      }

      setSelectedExercise(exercise);
    },
    [isWorkoutPicker, onSelectExercise]
  );

  const lastCatalogIndex = filteredExercises.length - 1;
  const renderCatalogRow = useCallback(
    ({ item, index }) => (
      <CatalogExerciseRow
        exercise={item}
        isLast={index === lastCatalogIndex}
        isSelecting={selectingExerciseName === item.exercise_name}
        isAdded={addedNameSet.has(item.exercise_name)}
        isFavourite={favouriteNames.has(
          (item.exercise_name ?? "").toLocaleLowerCase()
        )}
        isSelectionBusy={isSelectionBusy}
        isWorkoutPicker={isWorkoutPicker}
        colors={rowColors}
        onPress={handleRowPress}
        onToggleFavourite={handleToggleFavourite}
      />
    ),
    [
      lastCatalogIndex,
      selectingExerciseName,
      addedNameSet,
      favouriteNames,
      isSelectionBusy,
      isWorkoutPicker,
      rowColors,
      handleRowPress,
      handleToggleFavourite,
    ]
  );

  useEffect(() => {
    loadExerciseStorage();
  }, [refreshKey]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedGroupKey("all");
    setSelectedMuscleKeys(["all"]);
    setExerciseTypeFilter("all");
    setShowFavouritesOnly(false);
    setShowRecentOnly(false);
  };

  const handleMuscleFilterPress = (filterKey) => {
    setSelectedMuscleKeys((currentKeys) =>
      toggleExerciseMuscleFilterKey(currentKeys, filterKey)
    );
  };

  if (isWorkoutPicker) {
    const workoutName = getWorkoutPickerName(workoutPicker);
    const workoutTargetLabel = workoutName || t("exercises.workoutFallback");
    const selectedPrimaryMuscleLabels = selectedExercise
      ? getExerciseMuscleLabels(selectedExercise, "primary")
      : [];
    const selectedSecondaryMuscleLabels = selectedExercise
      ? getExerciseMuscleLabels(selectedExercise, "secondary")
      : [];

    return (
      <>
      <View style={styles.pickerShell}>
        <View style={styles.pickerSearchRow}>
          <View
            style={[
              styles.pickerSearchBox,
              {
                backgroundColor: inputSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <Search width={17} height={17} color={quietText} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("exercises.searchPlaceholder")}
              placeholderTextColor={quietText}
              style={[styles.pickerSearchInput, { color: titleColor }]}
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel={t("exercises.library.openFiltersA11y")}
            onPress={() => setIsFilterSheetVisible(true)}
            style={[
              styles.pickerFilterButton,
              {
                backgroundColor: inputSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <Filter width={18} height={18} color={theme.text} />
            {activeFilterCount > 0 ? (
              <View
                style={[
                  styles.pickerFilterBadge,
                  { backgroundColor: primaryColor },
                ]}
              >
                <ThemedText
                  style={styles.pickerFilterBadgeText}
                  setColor={theme.textInverted}
                >
                  {activeFilterCount}
                </ThemedText>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <ScrollView
        keyboardShouldPersistTaps="handled"
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pickerChipScroll}
          contentContainerStyle={styles.pickerChipContent}
        >
          {/* Ahead of the muscle groups, because it is the one chip that
              narrows the list to what this user actually reaches for. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showFavouritesOnly }}
            accessibilityLabel={t("exercises.library.favouritesOnlyA11y")}
            onPress={() => setShowFavouritesOnly((current) => !current)}
            style={[
              styles.pickerFocusChip,
              styles.favouriteChip,
              {
                backgroundColor: showFavouritesOnly
                  ? withAlpha(theme.planned, 0.16)
                  : cardSurface,
                borderColor: showFavouritesOnly ? theme.planned : cardBorder,
              },
            ]}
          >
            <Star
              width={13}
              height={13}
              color={showFavouritesOnly ? theme.planned : quietText}
              filled={showFavouritesOnly}
              roundness={1.4}
            />
            <ThemedText
              style={[
                styles.pickerFocusChipText,
                showFavouritesOnly && styles.pickerFocusChipTextActive,
              ]}
              setColor={showFavouritesOnly ? theme.planned : theme.text}
            >
              {t("exercises.library.favourites")}
            </ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showRecentOnly }}
            accessibilityLabel={t("exercises.library.recentOnlyA11y")}
            onPress={() => setShowRecentOnly((current) => !current)}
            style={[
              styles.pickerFocusChip,
              styles.favouriteChip,
              {
                backgroundColor: showRecentOnly
                  ? withAlpha(theme.secondary, 0.16)
                  : cardSurface,
                borderColor: showRecentOnly ? secondaryColor : cardBorder,
              },
            ]}
          >
            <ReplayHistory
              width={13}
              height={13}
              color={showRecentOnly ? secondaryColor : quietText}
            />
            <ThemedText
              style={[
                styles.pickerFocusChipText,
                showRecentOnly && styles.pickerFocusChipTextActive,
              ]}
              setColor={showRecentOnly ? secondaryColor : theme.text}
            >
              {t("exercises.library.recent")}
            </ThemedText>
          </Pressable>

          {GROUP_FILTERS.map((filter) => {
            const isSelected = selectedGroupKey === filter.key;

            return (
              <Pressable
                key={filter.key}
                onPress={() => setSelectedGroupKey(filter.key)}
                style={[
                  styles.pickerFocusChip,
                  {
                    backgroundColor: isSelected
                      ? withAlpha(theme.primary, 0.14)
                      : cardSurface,
                    borderColor: isSelected ? primaryColor : cardBorder,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.pickerFocusChipText,
                    isSelected && styles.pickerFocusChipTextActive,
                  ]}
                  setColor={isSelected ? primaryColor : theme.text}
                >
                  {t(filter.labelKey)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.pickerSectionHeader}>
          <ThemedText
            style={styles.pickerSectionEyebrow}
            setColor={theme.text}
          >
            <ThemedText
              style={styles.pickerSectionCount}
              setColor={primaryTextColor}
            >
              {visibleCount}
            </ThemedText>
            {` ${t("exercises.library.countSuffix", { count: visibleCount })}`}
          </ThemedText>

          <View style={styles.pickerLegend}>
            <View style={styles.pickerLegendItem}>
              <View
                style={[
                  styles.pickerLegendDot,
                  { backgroundColor: primaryBadgeText },
                ]}
              />
              <ThemedText style={styles.pickerLegendText} setColor={quietText}>
                {t("exercises.primary")}
              </ThemedText>
            </View>
            <View style={styles.pickerLegendItem}>
              <View
                style={[
                  styles.pickerLegendDot,
                  { backgroundColor: secondaryBadgeText },
                ]}
              />
              <ThemedText style={styles.pickerLegendText} setColor={quietText}>
                {t("exercises.secondary")}
              </ThemedText>
            </View>
          </View>
        </View>

        {/*
          The list scrolls, rather than the screen around it: 89 rows each
          holding a body-map image and an SVG overlay were all mounted at
          once, and every keystroke in the search field rebuilt the lot.
        */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(exercise) => exercise.exercise_name}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          initialNumToRender={VISIBLE_EXERCISE_COUNT}
          windowSize={5}
          style={[
            styles.pickerExerciseList,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
          ListEmptyComponent={
            isLoadingExercises && exercises.length === 0 ? (
              <View style={styles.pickerEmptyState}>
                <ActivityIndicator color={primaryTextColor} />
                <ThemedText style={styles.emptyBody} setColor={quietText}>
                  {t("exercises.loading")}
                </ThemedText>
              </View>
            ) : exercises.length === 0 ? (
              <View style={styles.pickerEmptyState}>
                <ThemedTitle type="h3" style={styles.emptyTitle}>
                  {t("exercises.library.emptyTitle")}
                </ThemedTitle>
                <ThemedText style={styles.emptyBody} setColor={quietText}>
                  {t("exercises.library.emptyBody")}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.pickerEmptyState}>
                <ThemedTitle type="h3" style={styles.emptyTitle}>
                  {t("exercises.library.noMatchesTitle")}
                </ThemedTitle>
                <ThemedText style={styles.emptyBody} setColor={quietText}>
                  {t("exercises.library.noMatchesBody")}
                </ThemedText>
              </View>
            )
          }
          renderItem={({ item: exercise, index }) => {
              const isCurrentSelection =
                selectingExerciseName === exercise.exercise_name;
              const isLast = index === filteredExercises.length - 1;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    addedNameSet.has(exercise.exercise_name)
                      ? "exercises.library.addAnotherToWorkoutA11y"
                      : "exercises.library.addToWorkoutA11y",
                    { name: exercise.exercise_name }
                  )}
                  disabled={isSelectionBusy}
                  onPress={() => onSelectExercise?.(exercise)}
                  style={[
                    styles.pickerExerciseRow,
                    isCurrentSelection && {
                      backgroundColor: withAlpha(theme.secondary, 0.07),
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("exercises.library.showMusclesA11y", {
                      name: exercise.exercise_name,
                    })}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      setSelectedExercise(exercise);
                    }}
                    style={[
                      styles.pickerPreviewTile,
                      {
                        backgroundColor: inputSurface,
                        borderColor: isCurrentSelection
                          ? withAlpha(theme.secondary, 0.35)
                          : cardBorder,
                      },
                    ]}
                  >
                    <BodyMapPreview
                      bodyView={exercise.body_map_view}
                      crop={exercise.body_map_section}
                      primaryRegionKeys={exercise.primary_body_map_region_keys}
                      secondaryRegionKeys={
                        exercise.secondary_body_map_region_keys
                      }
                      style={styles.pickerPreviewBodyMap}
                    />
                  </Pressable>

                  <View style={styles.pickerExerciseBody}>
                    <View style={styles.pickerExerciseTitleRow}>
                      <ThemedText
                        style={styles.pickerExerciseName}
                        setColor={titleColor}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {exercise.exercise_name}
                      </ThemedText>

                      {exercise.is_custom ? (
                        <View
                          style={[
                            styles.pickerCustomBadge,
                            { backgroundColor: withAlpha(theme.primary, 0.14) },
                          ]}
                        >
                          <ThemedText
                            style={styles.pickerCustomBadgeText}
                            setColor={primaryTextColor}
                          >
                            {t("exercises.library.customBadge")}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>

                    {/* The sheet stays open now, so this has to survive the
                        moment the add finishes - otherwise a row that has
                        already gone in looks the same as one that has not. */}
                    {isCurrentSelection ||
                    addedNameSet.has(exercise.exercise_name) ? (
                      <ThemedText
                        style={styles.pickerAddedText}
                        setColor={secondaryColor}
                        numberOfLines={1}
                      >
                        {t("exercises.library.addedTo", {
                          name: workoutTargetLabel,
                        })}
                      </ThemedText>
                    ) : (
                      // The muscles are on the row's own figure. Naming them
                      // beside it said the same thing twice, in the space the
                      // exercise name needed.
                      null
                    )}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isFavouriteExercise(exercise) }}
                    accessibilityLabel={
                      isFavouriteExercise(exercise)
                        ? t("exercises.library.removeFavouriteA11y", {
                            name: exercise.exercise_name,
                          })
                        : t("exercises.library.addFavouriteA11y", {
                            name: exercise.exercise_name,
                          })
                    }
                    onPress={(event) => {
                      event.stopPropagation?.();
                      toggleFavourite(exercise);
                    }}
                    style={styles.favouriteToggle}
                  >
                    <Star
                      width={19}
                      height={19}
                      color={
                        isFavouriteExercise(exercise) ? theme.planned : quietText
                      }
                      filled={isFavouriteExercise(exercise)}
                      roundness={1.6}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.86}
                    accessibilityRole="button"
                    accessibilityLabel={t("exercises.library.addToWorkoutA11y", {
                      name: exercise.exercise_name,
                    })}
                    disabled={isSelectionBusy}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      onSelectExercise?.(exercise);
                    }}
                    style={[
                      styles.pickerAddButton,
                      {
                        backgroundColor: isCurrentSelection
                          ? secondaryColor
                          : withAlpha(theme.primary, 0.14),
                      },
                    ]}
                  >
                    {isCurrentSelection ? (
                      isSelectionBusy ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.inkOnSecondary ?? theme.textInverted}
                        />
                      ) : (
                        <Checkmark
                          width={17}
                          height={17}
                          color={theme.inkOnSecondary ?? theme.textInverted}
                          thickness={2.1}
                        />
                      )
                    ) : (
                      <Plus
                        width={17}
                        height={17}
                        color={primaryTextColor}
                        thickness={2.1}
                      />
                    )}
                  </TouchableOpacity>

                  {!isLast ? (
                    <View
                      style={[
                        styles.pickerExerciseDivider,
                        { backgroundColor: cardBorder },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
          }}
        />

        {onAddCustomExercise ? (
          <View
            style={[
              styles.pickerFooter,
              {
                backgroundColor: theme.navBackground,
                borderTopColor: cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={onAddCustomExercise}
              style={[
                styles.pickerCustomButton,
                {
                  borderColor: cardBorder,
                },
              ]}
            >
              <Plus width={17} height={17} color={theme.text} thickness={2.1} />
              <ThemedText
                style={styles.pickerCustomButtonText}
                setColor={theme.text}
              >
                {t("exercises.library.createCustom")}
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <ThemedModal
        visible={Boolean(selectedExercise)}
        onClose={() => setSelectedExercise(null)}
        title={selectedExercise?.exercise_name}
        style={styles.exerciseBodyMapModal}
        contentStyle={styles.exerciseBodyMapModalBody}
        showCloseButton
      >
        {selectedExercise ? (
          <>
            <ExerciseMuscleBadges
              primaryBadgeSurface={primaryBadgeSurface}
              primaryBadgeText={primaryBadgeText}
              primaryCount={selectedExercise.primary_muscle_count ?? 0}
              secondaryBadgeSurface={secondaryBadgeSurface}
              secondaryBadgeText={secondaryBadgeText}
              secondaryCount={selectedExercise.secondary_muscle_count ?? 0}
              style={styles.exerciseBodyMapModalBadges}
            />

            <View style={styles.exerciseBodyMapModalFigures}>
              <View style={styles.exerciseBodyMapModalFigure}>
                <ThemedText
                  style={styles.exerciseBodyMapModalFigureLabel}
                  setColor={quietText}
                >
                  {t("exercises.front")}
                </ThemedText>
                <BodyMapPreview
                  bodyView="front"
                  primaryRegionKeys={
                    selectedExercise.primary_front_body_map_region_keys
                  }
                  secondaryRegionKeys={
                    selectedExercise.secondary_front_body_map_region_keys
                  }
                  style={[
                    styles.exerciseBodyMapModalPreview,
                    { height: bodyMapFigureHeight },
                  ]}
                />
              </View>

              <View style={styles.exerciseBodyMapModalFigure}>
                <ThemedText
                  style={styles.exerciseBodyMapModalFigureLabel}
                  setColor={quietText}
                >
                  {t("exercises.back")}
                </ThemedText>
                <BodyMapPreview
                  bodyView="back"
                  primaryRegionKeys={
                    selectedExercise.primary_back_body_map_region_keys
                  }
                  secondaryRegionKeys={
                    selectedExercise.secondary_back_body_map_region_keys
                  }
                  style={[
                    styles.exerciseBodyMapModalPreview,
                    { height: bodyMapFigureHeight },
                  ]}
                />
              </View>
            </View>

            <View
              style={[
                styles.pickerModalMusclesCard,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ThemedText
                style={styles.pickerModalMusclesTitle}
                setColor={quietText}
              >
                {t("exercises.library.musclesInvolved")}
              </ThemedText>

              <View style={styles.pickerModalMuscleRole}>
                <View style={styles.pickerModalMuscleRoleHeader}>
                  <View
                    style={[
                      styles.pickerLegendDot,
                      { backgroundColor: primaryBadgeText },
                    ]}
                  />
                  <ThemedText
                    style={styles.pickerModalMuscleRoleTitle}
                    setColor={primaryBadgeText}
                  >
                    {t("exercises.primary")}
                  </ThemedText>
                </View>
                <View style={styles.pickerModalMuscleChips}>
                  {selectedPrimaryMuscleLabels.length > 0 ? (
                    selectedPrimaryMuscleLabels.map((label) => (
                      <View
                        key={`primary-${label}`}
                        style={[
                          styles.pickerModalMuscleChip,
                          { backgroundColor: primaryBadgeSurface },
                        ]}
                      >
                        <ThemedText
                          style={styles.pickerModalMuscleChipText}
                          setColor={primaryBadgeText}
                        >
                          {muscleGroupLabel(label, t)}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText
                      style={styles.pickerModalMuscleEmptyText}
                      setColor={quietText}
                    >
                      {t("exercises.library.noPrimaryMuscles")}
                    </ThemedText>
                  )}
                </View>
              </View>

              <View style={styles.pickerModalMuscleRole}>
                <View style={styles.pickerModalMuscleRoleHeader}>
                  <View
                    style={[
                      styles.pickerLegendDot,
                      { backgroundColor: secondaryBadgeText },
                    ]}
                  />
                  <ThemedText
                    style={styles.pickerModalMuscleRoleTitle}
                    setColor={secondaryBadgeText}
                  >
                    {t("exercises.secondary")}
                  </ThemedText>
                </View>
                <View style={styles.pickerModalMuscleChips}>
                  {selectedSecondaryMuscleLabels.length > 0 ? (
                    selectedSecondaryMuscleLabels.map((label) => (
                      <View
                        key={`secondary-${label}`}
                        style={[
                          styles.pickerModalMuscleChip,
                          { backgroundColor: secondaryBadgeSurface },
                        ]}
                      >
                        <ThemedText
                          style={styles.pickerModalMuscleChipText}
                          setColor={secondaryBadgeText}
                        >
                          {muscleGroupLabel(label, t)}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText
                      style={styles.pickerModalMuscleEmptyText}
                      setColor={quietText}
                    >
                      {t("exercises.library.noSecondaryMuscles")}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={t("exercises.library.addToWorkoutA11y", {
                name: selectedExercise.exercise_name,
              })}
              disabled={isSelectionBusy}
              onPress={() => onSelectExercise?.(selectedExercise)}
              style={[
                styles.pickerModalAddButton,
                {
                  backgroundColor: isSelectionBusy
                    ? secondaryColor
                    : primaryColor,
                  opacity: isSelectionBusy ? 0.78 : 1,
                },
              ]}
            >
              {selectingExerciseName === selectedExercise.exercise_name ? (
                <ActivityIndicator
                  size="small"
                  color={theme.textInverted}
                />
              ) : (
                <Plus
                  width={18}
                  height={18}
                  color={theme.textInverted}
                  thickness={2.2}
                />
              )}
              <ThemedText
                style={styles.pickerModalAddButtonText}
                setColor={theme.textInverted}
              >
                {selectingExerciseName === selectedExercise.exercise_name
                  ? t("exercises.library.adding")
                  : t("exercises.addTo", { name: workoutTargetLabel })}
              </ThemedText>
            </TouchableOpacity>
          </>
        ) : null}
      </ThemedModal>
      <ExerciseFilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        selectedGroupKey={selectedGroupKey}
        onChangeGroupKey={setSelectedGroupKey}
        selectedMuscleKeys={selectedMuscleKeys}
        onToggleMuscleKey={handleMuscleFilterPress}
        exerciseTypeFilter={exerciseTypeFilter}
        onChangeExerciseTypeFilter={setExerciseTypeFilter}
        resultCount={filteredExercises.length}
        onReset={resetFilters}
      />
      </>
    );
  }

  return (
    <>
      <ThemedCard
        style={[
          styles.card,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: secondaryBadgeSurface }]}>
          <Library width={22} height={22} color={primaryTextColor} />
        </View>

        <View style={styles.headerCopy}>
          <ThemedText size={11} style={styles.eyebrow} setColor={primaryTextColor}>
            {isWorkoutPicker
              ? t("exercises.library.eyebrowWorkout")
              : t("exercises.library.eyebrowTrain")}
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={[styles.title, { color: titleColor }]}
          >
            {isWorkoutPicker
              ? t("exercises.addExercise")
              : t("exercises.library.title")}
          </ThemedTitle>
          {isWorkoutPicker ? (
            <ThemedText style={styles.description} setColor={quietText}>
              {t("exercises.library.workoutExercise")}
            </ThemedText>
          ) : null}
        </View>

      </View>

      <View
        style={[
          styles.divider,
          { backgroundColor: theme.border ?? cardBorder },
        ]}
      />

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: inputSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <Search width={18} height={18} color={quietText} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("exercises.searchPlaceholder")}
            placeholderTextColor={quietText}
            style={[styles.searchInput, { color: titleColor }]}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityState={{ selected: showFavouritesOnly }}
          accessibilityLabel={t("exercises.library.favouritesOnlyA11y")}
          onPress={() => setShowFavouritesOnly((current) => !current)}
          style={[
            styles.filterButton,
            {
              backgroundColor: showFavouritesOnly
                ? withAlpha(theme.planned, 0.16)
                : inputSurface,
              borderColor: showFavouritesOnly ? theme.planned : cardBorder,
            },
          ]}
        >
          <Star
            width={20}
            height={20}
            color={showFavouritesOnly ? theme.planned : quietText}
            filled={showFavouritesOnly}
            roundness={1.6}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityLabel={
            activeFilterCount > 0
              ? t("exercises.library.openFiltersActiveA11y", {
                  count: activeFilterCount,
                })
              : t("exercises.library.openFiltersA11y")
          }
          onPress={() => setIsFilterSheetVisible(true)}
          style={[
            styles.filterButton,
            {
              backgroundColor: inputSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <Filter width={20} height={20} color={quietText} />
          {activeFilterCount > 0 ? (
            <View
              style={[
                styles.pickerFilterBadge,
                { backgroundColor: primaryColor },
              ]}
            >
              <ThemedText
                style={styles.pickerFilterBadgeText}
                setColor={theme.textInverted}
              >
                {activeFilterCount}
              </ThemedText>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {activeFilterChips.length > 0 ? (
        <View style={styles.activeFilterRow}>
          {activeFilterChips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel={t("exercises.library.removeFilterA11y", {
                label: chip.label,
              })}
              onPress={chip.onRemove}
              style={[
                styles.activeFilterChip,
                {
                  backgroundColor: withAlpha(theme.primary, 0.14),
                  borderColor: withAlpha(primaryColor, 0.45),
                },
              ]}
            >
              <ThemedText
                style={styles.activeFilterChipText}
                setColor={primaryTextColor}
              >
                {chip.label}
              </ThemedText>
              <Cross width={11} height={11} color={primaryTextColor} />
            </TouchableOpacity>
          ))}

          {activeFilterChips.length > 1 ? (
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              onPress={clearAllFilters}
              style={styles.activeFilterClearAll}
            >
              <ThemedText
                style={styles.activeFilterClearAllText}
                setColor={quietText}
              >
                {t("exercises.library.clearAll")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* The map replaces the two paragraphs that used to explain primary and
          secondary here. It says the same thing by colouring the muscles, and
          it does something as well: tapping one filters the list below. */}
      <View style={styles.catalogMap}>
        <View style={styles.catalogMapBodies}>
          {["front", "back"].map((side) => (
            <ExerciseMapBody
              key={side}
              side={side}
              width={catalogMapWidth}
              crop="full"
              surface="surface"
              primary={EMPTY_REGION_KEYS}
              secondary={EMPTY_REGION_KEYS}
              selected={highlightedRegionKeys}
              mode="muscles"
              onSelect={toggleRegionKey}
            />
          ))}
        </View>

        <ThemedText style={styles.catalogMapHint} setColor={quietText}>
          {highlightedRegionKeys.length === 0
            ? t("exercises.library.mapHint")
            : t("exercises.library.mapShowing", {
                muscles:
                  muscleFilterLabels.length === 1
                    ? muscleFilterLabels[0]
                    : t("exercises.library.mapOr", {
                        list: muscleFilterLabels.slice(0, -1).join(", "),
                        last: muscleFilterLabels.at(-1),
                      }),
              })}
        </ThemedText>
      </View>

      {/* Between the map and the list, where it counts what the map just did. */}
      <View style={styles.catalogSectionHeader}>
        <ThemedText style={styles.catalogSectionLabel} setColor={theme.text}>
          <ThemedText
            style={styles.catalogSectionCount}
            setColor={primaryTextColor}
          >
            {visibleCount}
          </ThemedText>
          {` ${t("exercises.library.countSuffix", { count: visibleCount })}`}
        </ThemedText>
      </View>

      {isLoadingExercises && exercises.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={primaryTextColor} />
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            {t("exercises.loading")}
          </ThemedText>
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedTitle type="h3" style={styles.emptyTitle}>
            {t("exercises.library.emptyTitle")}
          </ThemedTitle>
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            {t("exercises.library.emptyBody")}
          </ThemedText>
        </View>
      ) : filteredExercises.length === 0 ? (
        // BUG-16: this used to be a viewport-height box with its text centred
        // in it, so a filter that matched nothing looked like a blank screen -
        // the message sat below the fold. The way out was a Reset button
        // inside the filter sheet, which is not visible from the list.
        <View style={styles.emptyState}>
          <ThemedTitle type="h3" style={styles.emptyTitle}>
            {t("exercises.library.noMatchesTitle")}
          </ThemedTitle>
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            {activeFilterCount > 0
              ? t("exercises.library.noMatchEveryFilter")
              : t("exercises.library.tryAnotherSearch")}
          </ThemedText>

          {activeFilterCount > 0 ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("exercises.library.clearAllFiltersA11y")}
              activeOpacity={0.85}
              onPress={resetFilters}
              style={[styles.emptyResetButton, { borderColor: cardBorder }]}
            >
              <ThemedText
                style={styles.emptyResetText}
                setColor={primaryTextColor}
              >
                {t("exercises.library.clearFilters", { count: activeFilterCount })}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        // BUG-14: the warning "VirtualizedLists should never be nested inside
        // plain ScrollViews" is about a list that was handed unlimited height
        // and so cannot virtualize. That is not this list - `styles.listScroll`
        // fixes its height, so it has a real viewport and owns its scrolling.
        // The parent ScrollView has to stay: making it a list froze this one on
        // its first ten rows, verified on a device.
        //
        // These two are React Native's own escape hatch for exactly that case,
        // and `Modal` pairs them the same way. The warning fires when an
        // enclosing ScrollView's context is present and the list's own context
        // is null, so the ScrollView provider is the half that silences it -
        // the resetter alone makes it more likely, not less.
        <VirtualizedListContextResetter>
        <ScrollView.Context.Provider value={null}>
        <FlatList
          // Was a ScrollView with a plain `.map()`, on the reasoning that a
          // fixed-height window inside a scrolling page could not own its own
          // scrolling. It can: `styles.listScroll` already fixes the height,
          // so a FlatList sits in the same card and needs no layout change.
          //
          // The reason it matters: every row mounts a body figure - an image
          // plus an SVG overlay - and `.map()` built all 89 of them in one
          // commit. Measured on a Galaxy A34 (dev build), removing a selected
          // muscle took 521 ms, against 77 ms for selecting one. Both redraw
          // the same two large figures; the difference was the list growing
          // from 16 rows back to 89.
          //
          // No `getItemLayout`: the rows measured 174-177 px at density 450,
          // so the height is not the clean constant `EXERCISE_ROW_HEIGHT`
          // suggests, and a wrong value there drifts the scroll position.
          data={filteredExercises}
          keyExtractor={catalogKeyExtractor}
          renderItem={renderCatalogRow}
          initialNumToRender={VISIBLE_EXERCISE_COUNT}
          maxToRenderPerBatch={VISIBLE_EXERCISE_COUNT}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        />
        </ScrollView.Context.Provider>
        </VirtualizedListContextResetter>
      )}
      </ThemedCard>

      <ThemedModal
        visible={Boolean(selectedExercise)}
        onClose={() => setSelectedExercise(null)}
        title={selectedExercise?.exercise_name}
        style={styles.exerciseBodyMapModal}
        contentStyle={styles.exerciseBodyMapModalBody}
        showCloseButton
      >
        {selectedExercise ? (
          <>
            <ExerciseMuscleBadges
              primaryBadgeSurface={primaryBadgeSurface}
              primaryBadgeText={primaryBadgeText}
              primaryCount={selectedExercise.primary_muscle_count ?? 0}
              secondaryBadgeSurface={secondaryBadgeSurface}
              secondaryBadgeText={secondaryBadgeText}
              secondaryCount={selectedExercise.secondary_muscle_count ?? 0}
              style={styles.exerciseBodyMapModalBadges}
            />

            <View style={styles.exerciseBodyMapModalFigures}>
              <View style={styles.exerciseBodyMapModalFigure}>
                <ThemedText
                  style={styles.exerciseBodyMapModalFigureLabel}
                  setColor={quietText}
                >
                  {t("exercises.front")}
                </ThemedText>
                <BodyMapPreview
                  bodyView="front"
                  primaryRegionKeys={
                    selectedExercise.primary_front_body_map_region_keys
                  }
                  secondaryRegionKeys={
                    selectedExercise.secondary_front_body_map_region_keys
                  }
                  style={[
                    styles.exerciseBodyMapModalPreview,
                    { height: bodyMapFigureHeight },
                  ]}
                />
              </View>

              <View style={styles.exerciseBodyMapModalFigure}>
                <ThemedText
                  style={styles.exerciseBodyMapModalFigureLabel}
                  setColor={quietText}
                >
                  {t("exercises.back")}
                </ThemedText>
                <BodyMapPreview
                  bodyView="back"
                  primaryRegionKeys={
                    selectedExercise.primary_back_body_map_region_keys
                  }
                  secondaryRegionKeys={
                    selectedExercise.secondary_back_body_map_region_keys
                  }
                  style={[
                    styles.exerciseBodyMapModalPreview,
                    { height: bodyMapFigureHeight },
                  ]}
                />
              </View>
            </View>
          </>
        ) : null}
      </ThemedModal>
      <ExerciseFilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        selectedGroupKey={selectedGroupKey}
        onChangeGroupKey={setSelectedGroupKey}
        selectedMuscleKeys={selectedMuscleKeys}
        onToggleMuscleKey={handleMuscleFilterPress}
        exerciseTypeFilter={exerciseTypeFilter}
        onChangeExerciseTypeFilter={setExerciseTypeFilter}
        resultCount={filteredExercises.length}
        onReset={resetFilters}
      />
    </>
  );
};

export default ExerciseLibraryList;
