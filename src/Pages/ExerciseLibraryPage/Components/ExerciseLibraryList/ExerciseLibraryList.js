import {
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useState, useEffect } from "react";

import styles from "./ExerciseLibraryListStyle";
import { weightliftingService as weightliftingRepository } from "../../../../Services";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import BodyMapPreview from "../../../../Resources/Components/BodyMapPreview/BodyMapPreview";
import Filter from "../../../../Resources/Icons/UI-icons/Filter";
import Library from "../../../../Resources/Icons/UI-icons/Library";
import Search from "../../../../Resources/Icons/UI-icons/Search";
import {
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

const MUSCLE_FILTERS = [
  { key: "all", label: "All muscles", regionKeys: [] },
  { key: "chest", label: "Chest", regionKeys: ["pecs"] },
  {
    key: "shoulders",
    label: "Shoulders",
    regionKeys: ["front_delts", "side_delts", "rear_delts"],
  },
  { key: "lats", label: "Lats", regionKeys: ["lats"] },
  { key: "traps", label: "Traps", regionKeys: ["upper_traps"] },
  { key: "biceps", label: "Biceps", regionKeys: ["biceps"] },
  { key: "triceps", label: "Triceps", regionKeys: ["triceps"] },
  { key: "forearms", label: "Forearms", regionKeys: ["forearms"] },
  { key: "abs", label: "Abs", regionKeys: ["abs"] },
  { key: "obliques", label: "Obliques", regionKeys: ["obliques"] },
  { key: "glutes", label: "Glutes", regionKeys: ["glutes"] },
  { key: "quads", label: "Quads", regionKeys: ["quads"] },
  { key: "hamstrings", label: "Hamstrings", regionKeys: ["hamstrings"] },
  { key: "calves", label: "Calves", regionKeys: ["calves"] },
  { key: "adductors", label: "Adductors", regionKeys: ["adductors"] },
  { key: "lower-back", label: "Lower back", regionKeys: ["lower_back"] },
];

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
  selectingExerciseName = null,
}) => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [exercises, set_exercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupKey, setSelectedGroupKey] = useState("all");
  const [selectedMuscleKeys, setSelectedMuscleKeys] = useState(["all"]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface =
    theme.cardBackground ?? theme.navBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const inputSurface = theme.background ?? cardSurface;
  const activeFilterText = theme.cardBackground ?? theme.textInverted ?? "#1b1918";
  const badgeSurface =
    theme.uiBackground ??
    (colorScheme === "dark"
      ? "rgba(47, 43, 61, 0.8)"
      : "rgba(214, 213, 225, 0.8)");
  const primaryBadgeSurface = "rgba(96, 218, 172, 0.2)";
  const secondaryBadgeSurface = "rgba(247, 116, 46, 0.18)";
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

    return matchesSearch && matchesGroup && matchesMuscle;
  });
  const isWorkoutPicker = mode === "workout-picker";
  const isSelectionBusy = Boolean(selectingExerciseName);
  const loadExerciseStorage = async () => {
    try {
      const rows = await weightliftingRepository.getExerciseLibraryEntries(db);
      set_exercises(rows);
    } catch (error) {
      console.error("Error loading exercise storage", error);
    }
  };

  useEffect(() => {
    loadExerciseStorage();
  }, [refreshKey]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedGroupKey("all");
    setSelectedMuscleKeys(["all"]);
  };

  const handleMuscleFilterPress = (filterKey) => {
    if (filterKey === "all") {
      setSelectedMuscleKeys(["all"]);
      return;
    }

    setSelectedMuscleKeys((currentKeys) => {
      const activeKeys = currentKeys.filter((key) => key !== "all");
      const nextKeys = activeKeys.includes(filterKey)
        ? activeKeys.filter((key) => key !== filterKey)
        : [...activeKeys, filterKey];

      return nextKeys.length > 0 ? nextKeys : ["all"];
    });
  };

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
          <Library width={22} height={22} color={primaryColor} />
        </View>

        <View style={styles.headerCopy}>
          <ThemedText size={11} style={styles.eyebrow} setColor={primaryColor}>
            {isWorkoutPicker ? "Add Exercise" : "Exercise Library"}
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={[styles.title, { color: titleColor }]}
          >
            {isWorkoutPicker ? "Choose Exercise" : "Catalog"}
          </ThemedTitle>
          <ThemedText style={styles.description} setColor={quietText}>
            {isWorkoutPicker
              ? "Workout exercise"
              : "Synced from the shared cloud database whenever the app opens."}
          </ThemedText>
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
            <ThemedText style={styles.countBadgeNumber} setColor={primaryColor}>
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
          onPress={resetFilters}
          style={[
            styles.filterButton,
            {
              backgroundColor: inputSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <Filter width={20} height={20} color={quietText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, styles.trainingFilterScroll]}
        contentContainerStyle={styles.filterContent}
      >
        {GROUP_FILTERS.map((filter) => {
          const isSelected = selectedGroupKey === filter.key;

          return (
            <Pressable
              key={filter.key}
              onPress={() => setSelectedGroupKey(filter.key)}
              style={[
                styles.groupFilter,
                {
                  backgroundColor: isSelected ? primaryColor : badgeSurface,
                  borderColor: isSelected ? primaryColor : cardBorder,
                },
              ]}
            >
              <ThemedText
                style={styles.groupFilterText}
                setColor={isSelected ? activeFilterText : quietText}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, styles.muscleFilterScroll]}
        contentContainerStyle={styles.filterContent}
      >
        {MUSCLE_FILTERS.map((filter) => {
          const isSelected = selectedMuscleKeys.includes(filter.key);

          return (
            <Pressable
              key={filter.key}
              onPress={() => handleMuscleFilterPress(filter.key)}
              style={[
                styles.groupFilter,
                {
                  backgroundColor: isSelected ? secondaryColor : badgeSurface,
                  borderColor: isSelected ? secondaryColor : cardBorder,
                },
              ]}
            >
              <ThemedText
                style={styles.groupFilterText}
                setColor={isSelected ? activeFilterText : quietText}
              >
                {filter.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.tableHeader}>
        <View style={styles.tableHeaderPreview} />
        <ThemedText style={styles.tableHeaderExercise} setColor={quietText}>
          Exercise
        </ThemedText>
      </View>

      {exercises.length === 0 ? (
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
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {filteredExercises.map((exercise, index) => {
            const primaryCount = exercise.primary_muscle_count ?? 0;
            const secondaryCount = exercise.secondary_muscle_count ?? 0;

            return (
              <Pressable
                key={exercise.exercise_name}
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
                  <ThemedText
                    style={styles.exerciseName}
                    setColor={titleColor}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {exercise.exercise_name}
                  </ThemedText>

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
          })}
        </ScrollView>
      )}
      </ThemedCard>

      <ThemedModal
        visible={Boolean(selectedExercise)}
        onClose={() => setSelectedExercise(null)}
        title={selectedExercise?.exercise_name}
        style={styles.exerciseBodyMapModal}
        contentStyle={styles.exerciseBodyMapModalBody}
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
                  style={styles.exerciseBodyMapModalPreview}
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
                  style={styles.exerciseBodyMapModalPreview}
                />
              </View>
            </View>
          </>
        ) : null}
      </ThemedModal>
    </>
  );
};

export default ExerciseLibraryList;
