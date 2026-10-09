import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { formatNumber, useTranslation } from "@localization";

import styles from "./CustomExerciseDetailPageStyle";
import DetailOwnerRow from "./Components/DetailOwnerRow";
import DetailSkeleton from "./Components/DetailSkeleton";
import DetailStats from "./Components/DetailStats";
import DetailTopBar from "./Components/DetailTopBar";
import ExerciseVideoHero, { heroHasVideo, heroHeightFor } from "./Components/ExerciseVideoHero";
import ReportExerciseSheet from "./Components/ReportExerciseSheet";
import WeightDistribution from "./Components/WeightDistribution";
import { exerciseService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import { useAnimationsEnabled } from "@resources/Components/animationHooks";
import { showToast } from "@resources/Components/Toast/Toast";
import Bookmark from "@resources/Icons/UI-icons/Bookmark";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import Flag from "@resources/Icons/UI-icons/Flag";
import Library from "@resources/Icons/UI-icons/Library";
import Pencil from "@resources/Icons/UI-icons/Pencil";
import Plus from "@resources/Icons/UI-icons/Plus";
import {
  ThemedBottomSheet,
  ThemedStateBlock,
  ThemedText,
  ThemedView,
} from "@resources/ThemedComponents";
import { normalizeSteps, primaryMuscleKey } from "@utils/customExercises";

// The bars start to grow once their top is this far up into the screen.
const REVEAL_OFFSET = 40;

// The service marks what never reached the server with kind "offline". A raw
// fetch failure, should one slip through, says so in the Supabase client's
// own words.
const OFFLINE_MESSAGE = /network request failed|failed to fetch|networkerror|network error|load failed/i;

function hasId(value) {
  return value !== null && value !== undefined && value !== "";
}

function isOfflineError(error) {
  return error?.kind === "offline" || OFFLINE_MESSAGE.test(String(error?.message ?? ""));
}

// The services throw messages that are already translated and fit to show.
function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// A refresh signs the clip again, and a new address would start it over from
// the beginning. While it is the same clip, the one already playing stays.
function keepPlayingVideo(current, next) {
  if (
    current?.id === next.id &&
    current?.videoUrl &&
    next.hasVideo &&
    current.videoDurationMs === next.videoDurationMs
  ) {
    return { ...next, videoUrl: current.videoUrl, posterUrl: current.posterUrl ?? next.posterUrl };
  }

  return next;
}

/**
 * One exercise somebody has made and shared (screen 1b): the clip that shows
 * it, who made it, what the numbers say about how it is done, and a copy of
 * it for your own exercises - or, when it is yours, the way to edit it.
 *
 * "Add to my exercises" takes you back where you came from with a toast
 * rather than to a new screen. The copy is the name, muscles, equipment,
 * weight mode, description and steps; never the owner's sets or the clip.
 *
 * Opened with `exerciseId`, the cloud id, from the library, Explore's row, or
 * your own exercise.
 */
export default function CustomExerciseDetailPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  // In focus and in the foreground: when the clip may play at all.
  const { visible: isScreenVisible } = useAnimationsEnabled();
  const exerciseId = route.params?.exerciseId ?? null;
  // danger measures 4.0:1 on the light page; the darker red holds 7.
  const errorColor = colorScheme === "light" ? theme.dangerDark : theme.danger;

  const [status, setStatus] = useState("loading"); // loading | ready | unavailable | error
  const [exercise, setExercise] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  // { tone: "info" | "error", text } under the buttons.
  const [addNotice, setAddNotice] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [heroOutOfView, setHeroOutOfView] = useState(false);
  const [distributionRevealed, setDistributionRevealed] = useState(false);

  const mountedRef = useRef(true);
  // State lags a render behind a quick second tap; these do not.
  const isAddingRef = useRef(false);
  const isSavingRef = useRef(false);
  const hasBlurredRef = useRef(false);
  // What was picked in the menu, run once the sheet has gone: iOS drops a
  // sheet presented while another is still up.
  const pendingMenuActionRef = useRef(null);
  const scrollYRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const distributionYRef = useRef(null);
  const distributionRevealedRef = useRef(false);
  const heroOutOfViewRef = useRef(false);
  // Read by the scroll handler, which is made once.
  const heroHeightRef = useRef(0);
  const topInsetRef = useRef(0);

  heroHeightRef.current = heroHeightFor(exercise);
  topInsetRef.current = insets.top;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // A new copy of the page starts from its top.
    scrollYRef.current = 0;
    distributionYRef.current = null;
    distributionRevealedRef.current = false;
    heroOutOfViewRef.current = false;
    setDistributionRevealed(false);
    setHeroOutOfView(false);
    setAddNotice(null);
    setSaveError("");

    if (!hasId(exerciseId)) {
      setExercise(null);
      setStatus("unavailable");
      return undefined;
    }

    setStatus("loading");
    setLoadError(null);

    Promise.resolve()
      .then(() => exerciseService.getPublicCustomExercise(exerciseId))
      .then((detail) => {
        if (cancelled) {
          return;
        }

        // null is gone, hidden, no longer shared, or blocked - and those read
        // the same on purpose.
        setExercise(detail ?? null);
        setStatus(detail ? "ready" : "unavailable");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.warn("Could not load the shared exercise:", error);
        setExercise(null);
        setLoadError(error ?? null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseId, reloadKey]);

  const refreshQuietly = useCallback(async () => {
    if (!hasId(exerciseId)) {
      return;
    }

    try {
      const detail = await exerciseService.getPublicCustomExercise(exerciseId);

      if (!mountedRef.current) {
        return;
      }

      if (!detail) {
        setExercise(null);
        setStatus("unavailable");
        return;
      }

      setExercise((current) => keepPlayingVideo(current, detail));
      setStatus("ready");
    } catch (error) {
      // What is on screen stays; the next visit tries again.
      console.warn("Could not refresh the shared exercise:", error);
    }
  }, [exerciseId]);

  // Back from your own exercise's editor, or from the owner's profile - where
  // they may have been blocked - what it says, and whether it can be seen at
  // all, may have changed. Not on the first focus: the load above is that.
  useFocusEffect(
    useCallback(() => {
      if (hasBlurredRef.current) {
        refreshQuietly();
      }

      return () => {
        hasBlurredRef.current = true;
      };
    }, [refreshQuietly])
  );

  const leave = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("CustomExercisesPage");
    }
  }, [navigation]);

  /* ----------------------------------------------------------- scrolling -- */

  const revealDistributionIfSeen = useCallback(() => {
    if (
      distributionRevealedRef.current ||
      distributionYRef.current === null ||
      viewportHeightRef.current <= 0
    ) {
      return;
    }

    if (scrollYRef.current + viewportHeightRef.current >= distributionYRef.current + REVEAL_OFFSET) {
      distributionRevealedRef.current = true;
      setDistributionRevealed(true);
    }
  }, []);

  // Once the hero has gone up under the status bar: the clip pauses, the
  // status bar takes the theme's colours again and gets a backdrop.
  const handleScroll = useCallback(
    (event) => {
      const y = event.nativeEvent.contentOffset.y;
      const outOfView = y > heroHeightRef.current - topInsetRef.current;

      scrollYRef.current = y;

      if (outOfView !== heroOutOfViewRef.current) {
        heroOutOfViewRef.current = outOfView;
        setHeroOutOfView(outOfView);
      }

      revealDistributionIfSeen();
    },
    [revealDistributionIfSeen]
  );

  const handleScrollLayout = useCallback(
    (event) => {
      viewportHeightRef.current = event.nativeEvent.layout.height;
      revealDistributionIfSeen();
    },
    [revealDistributionIfSeen]
  );

  const handleDistributionLayout = useCallback(
    (event) => {
      distributionYRef.current = event.nativeEvent.layout.y;
      revealDistributionIfSeen();
    },
    [revealDistributionIfSeen]
  );

  /* ------------------------------------------------------------- actions -- */

  const addToMyExercises = async () => {
    if (!exercise || isAddingRef.current) {
      return;
    }

    const { id, name } = exercise;

    isAddingRef.current = true;
    setIsAdding(true);
    setAddNotice(null);

    try {
      const result = await exerciseService.adoptExercise(db, id);

      if (!mountedRef.current) {
        return;
      }

      switch (result?.status) {
        case "added":
          setExercise((current) => (current ? { ...current, isAdded: true } : current));
          // Back where you came from; the toast says it worked, over there.
          leave();
          showToast(t("customExerciseDetail.added", { name: result.exerciseName || name }), {
            tone: "success",
          });
          break;
        case "already_added":
          setExercise((current) => (current ? { ...current, isAdded: true } : current));
          break;
        case "name_taken":
          setAddNotice({ tone: "info", text: t("customExerciseDetail.nameTaken", { name }) });
          break;
        case "own":
          setExercise((current) => (current ? { ...current, isMine: true } : current));
          break;
        default:
          setAddNotice({ tone: "error", text: t("customExerciseDetail.addFailed") });
      }
    } catch (error) {
      console.warn("Could not add the exercise:", error);

      if (mountedRef.current) {
        setAddNotice({ tone: "error", text: messageOf(error, t("customExerciseDetail.addFailed")) });
      }
    } finally {
      isAddingRef.current = false;

      if (mountedRef.current) {
        setIsAdding(false);
      }
    }
  };

  // Optimistic: the button changes at once and changes back if the cloud says no.
  const toggleSaved = async () => {
    if (!exercise || isSavingRef.current) {
      return;
    }

    const { id } = exercise;
    const nextSaved = !exercise.isSaved;

    isSavingRef.current = true;
    setSaveError("");
    setExercise((current) => (current ? { ...current, isSaved: nextSaved } : current));

    try {
      const result = await exerciseService.setExerciseSaved(id, nextSaved);

      if (mountedRef.current && typeof result?.saved === "boolean" && result.saved !== nextSaved) {
        setExercise((current) => (current ? { ...current, isSaved: result.saved } : current));
      }
    } catch (error) {
      console.warn("Could not update the saved list:", error);

      if (mountedRef.current) {
        setExercise((current) => (current ? { ...current, isSaved: !nextSaved } : current));
        setSaveError(messageOf(error, t("customExerciseDetail.saveFailed")));
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  const openMyExercise = () => {
    if (exercise?.name) {
      navigation.navigate("MyExercisePage", { exerciseName: exercise.name });
    }
  };

  const openProfile = () => {
    const userId = exercise?.owner?.id;

    if (userId) {
      navigation.navigate("PublicProfilePage", { userId });
    }
  };

  const chooseFromMenu = (action) => {
    pendingMenuActionRef.current = action;
    setIsMenuOpen(false);
  };

  const runChosenMenuAction = () => {
    const action = pendingMenuActionRef.current;

    pendingMenuActionRef.current = null;

    if (action === "report") {
      setIsReportOpen(true);
    } else if (action === "edit") {
      openMyExercise();
    }
  };

  /* ------------------------------------------------------------- drawing -- */

  const renderPrimaryButton = () => {
    if (exercise.isMine) {
      const label = t("customExerciseDetail.actions.edit");

      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label}
          activeOpacity={0.85}
          onPress={openMyExercise}
          style={[styles.primaryButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
        >
          <Pencil width={17} height={17} color={theme.textInverted} thickness={2} />
          <ThemedText
            style={styles.buttonText}
            setColor={theme.textInverted}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {label}
          </ThemedText>
        </TouchableOpacity>
      );
    }

    // Already in your exercises: a state, not an action.
    if (exercise.isAdded) {
      const label = t("customExerciseDetail.actions.added");

      return (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: true }}
          activeOpacity={1}
          disabled
          style={[
            styles.primaryButton,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <Checkmark width={15} height={15} color={theme.title} thickness={2.6} />
          <ThemedText style={styles.buttonText} setColor={theme.title} numberOfLines={1}>
            {label}
          </ThemedText>
        </TouchableOpacity>
      );
    }

    const label = isAdding
      ? t("customExerciseDetail.actions.adding")
      : t("customExerciseDetail.actions.add");

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isAdding, busy: isAdding }}
        activeOpacity={0.85}
        disabled={isAdding}
        onPress={addToMyExercises}
        style={[styles.primaryButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
      >
        {isAdding ? (
          <ActivityIndicator size="small" color={theme.textInverted} />
        ) : (
          <Plus width={18} height={18} color={theme.textInverted} thickness={2.2} />
        )}
        <ThemedText
          style={styles.buttonText}
          setColor={theme.textInverted}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderExercise = () => {
    const stats = exercise.stats ?? null;
    const steps = normalizeSteps(exercise.steps);
    const hasBuckets = Array.isArray(stats?.buckets) && stats.buckets.length > 0;
    const isMine = Boolean(exercise.isMine);
    const saveLabel = exercise.isSaved
      ? t("customExerciseDetail.actions.saved")
      : t("customExerciseDetail.actions.save");

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onLayout={handleScrollLayout}
      >
        <ExerciseVideoHero
          key={`hero-${exercise.id}`}
          name={exercise.name}
          hasVideo={exercise.hasVideo}
          videoUrl={exercise.videoUrl}
          posterUrl={exercise.posterUrl}
          muscleKey={primaryMuscleKey(exercise.muscles)}
          equipment={exercise.equipment}
          weightMode={exercise.weightMode}
          active={isScreenVisible && !heroOutOfView}
          onBack={leave}
          onMenu={() => setIsMenuOpen(true)}
        />

        <DetailOwnerRow
          owner={exercise.owner}
          isMine={isMine}
          createdAt={exercise.createdAt ?? exercise.sharedAt}
          ownerGymName={exercise.ownerGymName}
          onOpenProfile={openProfile}
          style={styles.ownerRow}
        />

        {exercise.description ? (
          <ThemedText style={styles.description} setColor={theme.mutedStrong}>
            {exercise.description}
          </ThemedText>
        ) : null}

        <DetailStats
          stats={stats}
          users={exercise.users}
          viewerHasGym={Boolean(exercise.viewerHasGym)}
          style={styles.stats}
        />

        {/* The owner's own steps, at most five. None, no section. */}
        {steps.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.eyebrow} setColor={theme.quietText} accessibilityRole="header">
              {t("customExerciseDetail.steps.title")}
            </ThemedText>
            <View style={styles.steps}>
              {steps.map((step, index) => (
                <View
                  key={`${index}-${step}`}
                  accessible
                  accessibilityLabel={t("customExerciseDetail.steps.step", {
                    number: index + 1,
                    text: step,
                  })}
                  style={styles.step}
                >
                  <ThemedText style={styles.stepNumber} setColor={theme.primaryText}>
                    {formatNumber(index + 1)}
                  </ThemedText>
                  <ThemedText style={styles.stepText} setColor={theme.mutedStrong}>
                    {step}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Under DISTRIBUTION_MIN_SETS logged sets the server sends no
            buckets, and the section is left out. */}
        {hasBuckets ? (
          <View style={styles.section} onLayout={handleDistributionLayout}>
            <WeightDistribution
              key={`distribution-${exercise.id}`}
              buckets={stats.buckets}
              weightMode={exercise.weightMode}
              typicalWeightKg={stats.typicalWeightKg}
              typicalReps={stats.typicalReps}
              setCount={stats.setCount}
              revealed={distributionRevealed}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          {renderPrimaryButton()}

          {/* Save puts it on a list without copying it. Not on your own. */}
          {!isMine ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={saveLabel}
              accessibilityState={{ selected: Boolean(exercise.isSaved) }}
              activeOpacity={0.85}
              onPress={toggleSaved}
              style={[
                styles.saveButton,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <Bookmark
                width={17}
                height={17}
                filled={Boolean(exercise.isSaved)}
                color={exercise.isSaved ? theme.primaryText : theme.title}
                thickness={1.9}
              />
              <ThemedText style={styles.buttonText} setColor={theme.title} numberOfLines={1}>
                {saveLabel}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>

        {addNotice ? (
          <ThemedText
            style={styles.notice}
            setColor={addNotice.tone === "error" ? errorColor : theme.mutedStrong}
            accessibilityLiveRegion="polite"
          >
            {addNotice.text}
          </ThemedText>
        ) : null}

        {saveError ? (
          <ThemedText style={styles.notice} setColor={errorColor} accessibilityLiveRegion="polite">
            {saveError}
          </ThemedText>
        ) : null}

        <ThemedText style={styles.footnote} setColor={theme.quietText}>
          {isMine ? t("customExerciseDetail.footnoteMine") : t("customExerciseDetail.footnote")}
        </ThemedText>
      </ScrollView>
    );
  };

  const renderState = () => {
    const isError = status === "error";
    const offline = isError && isOfflineError(loadError);

    return (
      <View style={[styles.stateScreen, { paddingTop: insets.top + 8 }]}>
        <DetailTopBar surface="page" onBack={leave} style={styles.stateTopBar} />

        {isError ? (
          <ThemedStateBlock
            variant="error"
            fill
            style={styles.stateBlock}
            title={
              offline ? t("customExerciseDetail.offline.title") : t("customExerciseDetail.error.title")
            }
            message={
              offline
                ? t("customExerciseDetail.offline.body")
                : messageOf(loadError, t("customExerciseDetail.error.body"))
            }
            actionLabel={t("common.retry")}
            onAction={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          // Removed, hidden after reports, no longer shared, or a block either
          // way: all of them read the same, calmly, with the way back.
          <ThemedStateBlock
            variant="empty"
            fill
            style={styles.stateBlock}
            icon={
              <View style={[styles.stateIcon, { backgroundColor: theme.chipBackground }]}>
                <Library width={22} height={22} color={theme.quietText} thickness={1.6} />
              </View>
            }
            title={t("customExerciseDetail.unavailable.title")}
            message={t("customExerciseDetail.unavailable.body")}
            actionLabel={t("common.goBack")}
            onAction={leave}
          />
        )}
      </View>
    );
  };

  const isReady = status === "ready" && Boolean(exercise);
  const withVideo = isReady && heroHasVideo(exercise);
  // Light over the clip, which is dark in both themes; the theme's own
  // everywhere else - on the block without a clip, and once the clip has
  // scrolled away.
  const statusBarStyle =
    withVideo && !heroOutOfView ? "light" : colorScheme === "dark" ? "light" : "dark";

  return (
    <ThemedView safe={["left", "right"]} style={styles.container}>
      {isReady ? renderExercise() : status === "loading" ? <DetailSkeleton onBack={leave} /> : renderState()}

      {isReady && heroOutOfView ? (
        <View
          pointerEvents="none"
          style={[styles.statusBarBackdrop, { height: insets.top, backgroundColor: theme.background }]}
        />
      ) : null}

      <ThemedBottomSheet
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onDismiss={runChosenMenuAction}
      >
        <View style={[styles.menuTitle, { borderBottomColor: theme.hairline }]}>
          <ThemedText style={styles.menuTitleText} setColor={theme.title} numberOfLines={1}>
            {exercise?.name ?? ""}
          </ThemedText>
        </View>

        <View style={styles.menuBody}>
          {exercise?.isMine ? (
            <TouchableOpacity
              style={styles.menuOption}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t("common.edit")}
              onPress={() => chooseFromMenu("edit")}
            >
              <Pencil width={20} height={20} color={theme.iconColor} />
              <ThemedText style={styles.menuOptionText} setColor={theme.title} numberOfLines={1}>
                {t("common.edit")}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.menuOption}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t("customExerciseDetail.menu.report")}
              onPress={() => chooseFromMenu("report")}
            >
              <Flag width={22} height={22} color={theme.iconColor} />
              <ThemedText style={styles.menuOptionText} setColor={theme.title} numberOfLines={1}>
                {t("customExerciseDetail.menu.report")}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ThemedBottomSheet>

      {exercise && !exercise.isMine ? (
        <ReportExerciseSheet
          visible={isReportOpen}
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          onClose={() => setIsReportOpen(false)}
        />
      ) : null}

      <StatusBar style={statusBarStyle} />
    </ThemedView>
  );
}
