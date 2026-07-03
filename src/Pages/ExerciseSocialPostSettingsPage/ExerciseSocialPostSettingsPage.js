import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./ExerciseSocialPostSettingsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Library from "../../Resources/Icons/UI-icons/Library";
import Search from "../../Resources/Icons/UI-icons/Search";
import {
  ThemedCard,
  ThemedHeader,
  ThemedSwitch,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { socialPostService, weightliftingService } from "../../Services";

function getExerciseCloudId(exercise) {
  const numericValue = Number(exercise?.cloud_exercise_id);

  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.trunc(numericValue)
    : null;
}

export default function ExerciseSocialPostSettingsPage() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingExerciseId, setSavingExerciseId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const panelSurface = theme.uiBackground ?? theme.background;
  const primaryColor = theme.primary ?? "#f7742e";
  const dangerColor = theme.danger ?? "#da1212";
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const hiddenCount = hiddenExerciseIds.size;

  const filteredExercises = useMemo(() => {
    if (!normalizedSearchQuery) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const exerciseName = String(exercise?.exercise_name ?? "");
      const nickname = String(exercise?.nickname ?? "");

      return (
        exerciseName.toLocaleLowerCase().includes(normalizedSearchQuery) ||
        nickname.toLocaleLowerCase().includes(normalizedSearchQuery)
      );
    });
  }, [exercises, normalizedSearchQuery]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadSettings = async () => {
        if (!user?.id) {
          setExercises([]);
          setHiddenExerciseIds(new Set());
          setLoading(false);
          setErrorMessage("Sign in to update exercise settings.");
          return;
        }

        try {
          setLoading(true);
          setErrorMessage("");
          const [exerciseRows, hiddenIds] = await Promise.all([
            weightliftingService.getExerciseLibraryEntries(db),
            socialPostService.getHiddenWorkoutSummaryExerciseIds({ user }),
          ]);

          if (!isCancelled) {
            setExercises(exerciseRows);
            setHiddenExerciseIds(new Set(hiddenIds));
          }
        } catch (error) {
          if (!isCancelled) {
            setExercises([]);
            setHiddenExerciseIds(new Set());
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Could not load exercise settings."
            );
          }
        } finally {
          if (!isCancelled) {
            setLoading(false);
          }
        }
      };

      loadSettings();

      return () => {
        isCancelled = true;
      };
    }, [db, user])
  );

  const toggleExerciseVisibility = useCallback(
    async (exercise, nextVisible) => {
      const exerciseId = getExerciseCloudId(exercise);

      if (!user?.id || exerciseId === null || savingExerciseId) {
        return;
      }

      const previousHiddenExerciseIds = new Set(hiddenExerciseIds);
      const nextHiddenExerciseIds = new Set(hiddenExerciseIds);
      const shouldHide = !nextVisible;

      if (shouldHide) {
        nextHiddenExerciseIds.add(exerciseId);
      } else {
        nextHiddenExerciseIds.delete(exerciseId);
      }

      setHiddenExerciseIds(nextHiddenExerciseIds);
      setSavingExerciseId(exerciseId);
      setErrorMessage("");

      try {
        await socialPostService.setWorkoutSummaryExerciseHidden({
          user,
          exerciseId,
          hidden: shouldHide,
        });
      } catch (error) {
        setHiddenExerciseIds(previousHiddenExerciseIds);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not save exercise setting."
        );
      } finally {
        setSavingExerciseId(null);
      }
    },
    [hiddenExerciseIds, savingExerciseId, user]
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <ThemedCard
        style={[
          styles.heroCard,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        <View style={styles.heroRow}>
          <View
            style={[
              styles.heroIcon,
              {
                backgroundColor: panelSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <Library width={25} height={25} color={primaryColor} />
          </View>

          <View style={styles.heroCopy}>
            <ThemedTitle type="h3" style={styles.cardTitle}>
              Social post exercises
            </ThemedTitle>
            <ThemedText style={styles.cardBody} setColor={quietText}>
              Choose which exercises can appear in top sets and PR badges on
              future workout summary posts.
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: panelSurface,
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
            autoCorrect={false}
            style={[styles.searchInput, { color: titleColor }]}
          />
        </View>

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryText} setColor={quietText}>
            {exercises.length} exercises
          </ThemedText>
          <ThemedText style={styles.summaryText} setColor={quietText}>
            {hiddenCount} hidden
          </ThemedText>
        </View>
      </ThemedCard>

      {errorMessage ? (
        <ThemedText style={styles.errorText} setColor={dangerColor}>
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );

  const renderExerciseRow = ({ item, index }) => {
    const exerciseId = getExerciseCloudId(item);
    const canToggle = exerciseId !== null && !savingExerciseId;
    const isHidden = exerciseId !== null && hiddenExerciseIds.has(exerciseId);
    const isSaving = savingExerciseId === exerciseId;
    const rowBorder =
      colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(32, 30, 43, 0.12)";

    return (
      <View
        style={[
          styles.exerciseRow,
          index === filteredExercises.length - 1 && styles.exerciseRowLast,
          { borderBottomColor: rowBorder },
        ]}
      >
        <View style={styles.exerciseCopy}>
          <ThemedText style={styles.exerciseName} setColor={titleColor}>
            {item.exercise_name}
          </ThemedText>
          <ThemedText style={styles.exerciseStatus} setColor={quietText}>
            {exerciseId === null
              ? "Sync pending"
              : isHidden
                ? "Hidden from social posts"
                : "Shown in social posts"}
          </ThemedText>
        </View>

        <View style={styles.switchWrap}>
          {isSaving ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <ThemedSwitch
              value={!isHidden}
              disabled={!canToggle}
              onValueChange={(nextVisible) =>
                toggleExerciseVisibility(item, nextVisible)
              }
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            Settings
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Exercises
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={primaryColor} />
          <ThemedText style={styles.loadingText} setColor={quietText}>
            Loading exercises...
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) =>
            `${getExerciseCloudId(item) ?? item.exercise_name}`
          }
          renderItem={renderExerciseRow}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ThemedTitle type="h3" style={styles.emptyTitle}>
                No exercises found
              </ThemedTitle>
              <ThemedText style={styles.emptyBody} setColor={quietText}>
                Try another search or sync the exercise catalog.
              </ThemedText>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </ThemedView>
  );
}
