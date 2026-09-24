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
import { useTranslation } from "@localization";

import styles from "./ExerciseSocialPostSettingsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Library from "../../Resources/Icons/UI-icons/Library";
import Search from "../../Resources/Icons/UI-icons/Search";
import {
  ThemedCard,
  ThemedHeader,
  ThemedStateBlock,
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
  const { t } = useTranslation();
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
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const dangerColor = theme.danger;
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
          setErrorMessage(t("exercises.socialSettings.signIn"));
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
                : t("exercises.socialSettings.loadFailed")
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
    }, [db, t, user])
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
            : t("exercises.socialSettings.saveFailed")
        );
      } finally {
        setSavingExerciseId(null);
      }
    },
    [hiddenExerciseIds, savingExerciseId, t, user]
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <ThemedText style={styles.scopeNote} setColor={quietText}>
        {t("exercises.socialSettings.scopeNote")}
      </ThemedText>

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
            <Library width={25} height={25} color={primaryTextColor} />
          </View>

          <View style={styles.heroCopy}>
            <ThemedTitle type="h3" style={styles.cardTitle}>
              {t("exercises.socialSettings.cardTitle")}
            </ThemedTitle>
            <ThemedText style={styles.cardBody} setColor={quietText}>
              {t("exercises.socialSettings.cardBody")}
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
            placeholder={t("exercises.searchPlaceholder")}
            placeholderTextColor={quietText}
            autoCorrect={false}
            style={[styles.searchInput, { color: titleColor }]}
          />
        </View>

        <View style={styles.summaryRow}>
          <ThemedText style={styles.summaryText} setColor={quietText}>
            {t("exercises.socialSettings.exerciseCount", { count: exercises.length })}
          </ThemedText>
          <ThemedText style={styles.summaryText} setColor={quietText}>
            {t("exercises.socialSettings.hiddenCount", { count: hiddenCount })}
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
              ? t("exercises.socialSettings.syncPending")
              : isHidden
                ? t("exercises.socialSettings.hidden")
                : t("exercises.socialSettings.shown")}
          </ThemedText>
        </View>

        <View style={styles.switchWrap}>
          {isSaving ? (
            <ActivityIndicator size="small" color={primaryTextColor} />
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
            size={12}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            {t("exercises.socialSettings.eyebrow")}
          </ThemedText>
          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {t("exercises.socialSettings.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {loading ? (
        <ThemedStateBlock fill variant="loading" message={t("exercises.loading")} />
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) =>
            `${getExerciseCloudId(item) ?? item.exercise_name}`
          }
          renderItem={renderExerciseRow}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <ThemedStateBlock
              variant="empty"
              title={t("exercises.socialSettings.emptyTitle")}
              message={t("exercises.socialSettings.emptyBody")}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </ThemedView>
  );
}
