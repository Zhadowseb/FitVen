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
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { useState, useEffect } from "react";

import styles, {
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
import {
  EXERCISE_MUSCLE_GROUPS,
  EXERCISE_MUSCLE_FILTERS,
  toggleExerciseMuscleFilterKey,
} from "../../../../Utils/exerciseMuscleGroups";
import {
  ThemedButton,
  ThemedCard,
  ThemedModal,
  ThemedText,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";

const GROUP_FILTERS = [
  { key: "all", label: "All" },
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "legs", label: "Legs" },
  { key: "core", label: "Core" },
  { key: "mobility", label: "Mobility" },
];

const MUSCLE_FILTERS = EXERCISE_MUSCLE_FILTERS;


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
          {formatMuscleBadgeLabel(primaryCount, "PRIMARY")}
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
            {formatMuscleBadgeLabel(secondaryCount, "SECONDARY")}
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
  workoutPicker = null,
}) => {
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
  const { height: windowHeight } = useWindowDimensions();
  // The body map is 503x1294, so width-driven sizing makes it far too tall for
  // the modal. Drive it by height and let aspectRatio give the width.
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
  const badgeSurface =
    theme.uiBackground ??
    (colorScheme === "dark"
      ? "rgba(47, 43, 61, 0.8)"
      : "rgba(214, 213, 225, 0.8)");
  const primaryBadgeSurface = withAlpha(theme.secondary, 0.2);
  const secondaryBadgeSurface = withAlpha(theme.primary, 0.18);
  const primaryBadgeText = secondaryColor;
  const secondaryBadgeText = primaryColor;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const isAllMusclesSelected = selectedMuscleKeys.includes("all");
  const selectedMuscleFilters = isAllMusclesSelected
    ? [MUSCLE_FILTERS[0]]
    : MUSCLE_FILTERS.filter((filter) =>
        selectedMuscleKeys.includes(filter.key)
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
    const matchesMuscle =
      isAllMusclesSelected ||
      selectedMuscleFilters.some((filter) =>
        filter.regionKeys.some((regionKey) => regionKeySet.has(regionKey))
      );
    const matchesType =
      exerciseTypeFilter === "all" ||
      (exerciseTypeFilter === "custom" && Boolean(exercise.is_custom)) ||
      (exerciseTypeFilter === "builtin" && !exercise.is_custom);

    return matchesSearch && matchesGroup && matchesMuscle && matchesType;
  });
  const isWorkoutPicker = mode === "workout-picker";
  const isSelectionBusy = Boolean(selectingExerciseName);
  const activeFilterCount =
    (selectedGroupKey === "all" ? 0 : 1) +
    (isAllMusclesSelected ? 0 : selectedMuscleKeys.length) +
    (exerciseTypeFilter === "all" ? 0 : 1);

  const clearMuscleKey = (muscleKey) => {
    setSelectedMuscleKeys((currentKeys) => {
      const nextKeys = currentKeys.filter((key) => key !== muscleKey);

      return nextKeys.length === 0 ? ["all"] : nextKeys;
    });
  };

  const activeFilterChips = [];

  if (selectedGroupKey !== "all") {
    activeFilterChips.push({
      key: `group-${selectedGroupKey}`,
      label:
        GROUP_FILTERS.find((filter) => filter.key === selectedGroupKey)?.label ??
        selectedGroupKey,
      onRemove: () => setSelectedGroupKey("all"),
    });
  }

  if (!isAllMusclesSelected) {
    for (const muscleKey of selectedMuscleKeys) {
      activeFilterChips.push({
        key: `muscle-${muscleKey}`,
        label:
          MUSCLE_FILTERS.find((filter) => filter.key === muscleKey)?.label ??
          muscleKey,
        onRemove: () => clearMuscleKey(muscleKey),
      });
    }
  }

  if (exerciseTypeFilter !== "all") {
    activeFilterChips.push({
      key: `type-${exerciseTypeFilter}`,
      label: exerciseTypeFilter === "custom" ? "Custom" : "Built-in",
      onRemove: () => setExerciseTypeFilter("all"),
    });
  }

  const clearAllFilters = () => {
    setSelectedGroupKey("all");
    setSelectedMuscleKeys(["all"]);
    setExerciseTypeFilter("all");
  };

  const visibleCount = filteredExercises.length;
  const loadExerciseStorage = async () => {
    try {
      setIsLoadingExercises(true);
      const rows = await weightliftingService.getExerciseLibraryEntries(db);
      set_exercises(rows);
    } catch (error) {
      console.error("Error loading exercise storage", error);
    } finally {
      setIsLoadingExercises(false);
    }
  };

  useEffect(() => {
    loadExerciseStorage();
  }, [refreshKey]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedGroupKey("all");
    setSelectedMuscleKeys(["all"]);
    setExerciseTypeFilter("all");
  };

  const handleMuscleFilterPress = (filterKey) => {
    setSelectedMuscleKeys((currentKeys) =>
      toggleExerciseMuscleFilterKey(currentKeys, filterKey)
    );
  };

  if (isWorkoutPicker) {
    const workoutName = getWorkoutPickerName(workoutPicker);
    const workoutTargetLabel = workoutName || "workout";
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
              placeholder="Search exercises..."
              placeholderTextColor={quietText}
              style={[styles.pickerSearchInput, { color: titleColor }]}
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="Open exercise filters"
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
                  {filter.label}
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
            {visibleCount === 1 ? " exercise" : " exercises"}
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
                Primary
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
                Secondary
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
                  Loading exercises...
                </ThemedText>
              </View>
            ) : exercises.length === 0 ? (
              <View style={styles.pickerEmptyState}>
                <ThemedTitle type="h3" style={styles.emptyTitle}>
                  No exercises yet
                </ThemedTitle>
                <ThemedText style={styles.emptyBody} setColor={quietText}>
                  No exercise names were found in the shared cloud library yet.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.pickerEmptyState}>
                <ThemedTitle type="h3" style={styles.emptyTitle}>
                  No matches
                </ThemedTitle>
                <ThemedText style={styles.emptyBody} setColor={quietText}>
                  Try another search or reset the active filter.
                </ThemedText>
              </View>
            )
          }
          renderItem={({ item: exercise, index }) => {
              const isCurrentSelection =
                selectingExerciseName === exercise.exercise_name;
              const isLast = index === filteredExercises.length - 1;
              const primaryMuscleSummary = getExerciseMuscleSummary(
                exercise,
                "primary"
              );
              const secondaryMuscleSummary = getExerciseMuscleSummary(
                exercise,
                "secondary"
              );

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${exercise.exercise_name} to workout`}
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
                    accessibilityLabel={`Show ${exercise.exercise_name} muscles`}
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
                            Custom
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>

                    {isCurrentSelection ? (
                      <ThemedText
                        style={styles.pickerAddedText}
                        setColor={secondaryColor}
                        numberOfLines={1}
                      >
                        Added to {workoutTargetLabel}
                      </ThemedText>
                    ) : (
                      <View style={styles.pickerMuscleLine}>
                        {primaryMuscleSummary ? (
                          <View style={styles.pickerMuscleChunk}>
                            <View
                              style={[
                                styles.pickerMuscleDot,
                                { backgroundColor: primaryBadgeText },
                              ]}
                            />
                            <ThemedText
                              style={styles.pickerMuscleText}
                              setColor={theme.text}
                              numberOfLines={1}
                            >
                              {primaryMuscleSummary}
                            </ThemedText>
                          </View>
                        ) : null}

                        {secondaryMuscleSummary ? (
                          <View style={styles.pickerMuscleChunk}>
                            <View
                              style={[
                                styles.pickerMuscleDot,
                                { backgroundColor: secondaryBadgeText },
                              ]}
                            />
                            <ThemedText
                              style={styles.pickerMuscleText}
                              setColor={quietText}
                              numberOfLines={1}
                            >
                              {secondaryMuscleSummary}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.86}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${exercise.exercise_name} to workout`}
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
                Create custom exercise
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
                  Front
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
                  Back
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
                Muscle groups involved
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
                    Primary
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
                          {label}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText
                      style={styles.pickerModalMuscleEmptyText}
                      setColor={quietText}
                    >
                      No primary muscle groups listed
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
                    Secondary
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
                          {label}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText
                      style={styles.pickerModalMuscleEmptyText}
                      setColor={quietText}
                    >
                      No secondary muscle groups listed
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={`Add ${selectedExercise.exercise_name} to workout`}
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
                  ? "Adding..."
                  : `Add to ${workoutTargetLabel}`}
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
            {isWorkoutPicker ? "Workout" : "Train"}
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={[styles.title, { color: titleColor }]}
          >
            {isWorkoutPicker ? "Add exercise" : "Exercise library"}
          </ThemedTitle>
          {isWorkoutPicker ? (
            <ThemedText style={styles.description} setColor={quietText}>
              Workout exercise
            </ThemedText>
          ) : null}
        </View>

        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: badgeSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.countBadgeText} setColor={titleColor}>
            <ThemedText style={styles.countBadgeNumber} setColor={primaryTextColor}>
              {filteredExercises.length}
            </ThemedText>{" "}
            exercises
          </ThemedText>
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
            placeholder="Search exercises..."
            placeholderTextColor={quietText}
            style={[styles.searchInput, { color: titleColor }]}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
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
              accessibilityLabel={`Remove filter ${chip.label}`}
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
                Clear all
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.catalogSectionHeader}>
        <ThemedText style={styles.catalogSectionLabel} setColor={theme.text}>
          <ThemedText
            style={styles.catalogSectionCount}
            setColor={primaryTextColor}
          >
            {visibleCount}
          </ThemedText>
          {visibleCount === 1 ? " exercise" : " exercises"}
        </ThemedText>
      </View>

      <View style={styles.muscleRoleLegend}>
        <View
          style={[
            styles.muscleRoleLegendItem,
            { borderLeftColor: primaryBadgeText },
          ]}
        >
          <ThemedText
            style={styles.muscleRoleLegendLabel}
            setColor={primaryBadgeText}
          >
            Primary
          </ThemedText>
          <ThemedText style={styles.muscleRoleLegendText} setColor={quietText}>
            Main working muscles, expected to fatigue or fail first.
          </ThemedText>
        </View>
        <View
          style={[
            styles.muscleRoleLegendItem,
            { borderLeftColor: secondaryBadgeText },
          ]}
        >
          <ThemedText
            style={styles.muscleRoleLegendLabel}
            setColor={secondaryBadgeText}
          >
            Secondary
          </ThemedText>
          <ThemedText style={styles.muscleRoleLegendText} setColor={quietText}>
            Support muscles used during the exercise, but not intended to be
            the limiting point.
          </ThemedText>
        </View>
      </View>

      {onAddCustomExercise ? (
        <View style={styles.customExerciseAction}>
          <ThemedButton
            title="Add custom exercise"
            fullWidth
            onPress={onAddCustomExercise}
          />
        </View>
      ) : null}

      <View style={styles.tableHeader}>
        <View style={styles.tableHeaderPreview} />
        <ThemedText style={styles.tableHeaderExercise} setColor={quietText}>
          Exercise
        </ThemedText>
      </View>

      {isLoadingExercises && exercises.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={primaryTextColor} />
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            Loading exercises...
          </ThemedText>
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedTitle type="h3" style={styles.emptyTitle}>
            No exercises yet
          </ThemedTitle>
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            No exercise names were found in the shared cloud library yet.
          </ThemedText>
        </View>
      ) : filteredExercises.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedTitle type="h3" style={styles.emptyTitle}>
            No matches
          </ThemedTitle>
          <ThemedText style={styles.emptyBody} setColor={quietText}>
            Try another search or reset the active filter.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(exercise) => exercise.exercise_name}
          keyboardShouldPersistTaps="handled"
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          initialNumToRender={VISIBLE_EXERCISE_COUNT}
          windowSize={5}
          renderItem={({ item: exercise, index }) => {
            const primaryCount = exercise.primary_muscle_count ?? 0;
            const secondaryCount = exercise.secondary_muscle_count ?? 0;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isWorkoutPicker
                    ? `Add ${exercise.exercise_name} to workout`
                    : `Show ${exercise.exercise_name} muscles`
                }
                disabled={isSelectionBusy}
                onPress={() => {
                  if (isWorkoutPicker) {
                    onSelectExercise?.(exercise);
                    return;
                  }

                  setSelectedExercise(exercise);
                }}
                style={[
                  styles.exerciseRow,
                  index === filteredExercises.length - 1 &&
                    styles.exerciseRowLast,
                  selectingExerciseName === exercise.exercise_name &&
                    styles.exerciseRowSelected,
                  { borderColor: cardBorder },
                ]}
              >
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
                      setColor={titleColor}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {exercise.exercise_name}
                    </ThemedText>

                    {exercise.is_custom || exercise.official ? (
                      <View
                        style={[
                          styles.exerciseStatusBadge,
                          {
                            backgroundColor: exercise.is_custom
                              ? primaryColor
                              : secondaryColor,
                          },
                        ]}
                      >
                        <ThemedText
                          style={styles.exerciseStatusBadgeText}
                          setColor={activeFilterText}
                        >
                          {exercise.is_custom ? "Custom" : "Official"}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>

                  <ExerciseMuscleBadges
                    primaryBadgeSurface={primaryBadgeSurface}
                    primaryBadgeText={primaryBadgeText}
                    primaryCount={primaryCount}
                    secondaryBadgeSurface={secondaryBadgeSurface}
                    secondaryBadgeText={secondaryBadgeText}
                    secondaryCount={secondaryCount}
                  />
                </View>
              </Pressable>
            );
          }}
        />
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
                  Front
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
                  Back
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
