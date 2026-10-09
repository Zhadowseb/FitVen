import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, TouchableOpacity, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSQLiteContext } from "expo-sqlite";
import {
  useFocusEffect,
  useNavigation,
  usePreventRemove,
  useRoute,
} from "@react-navigation/native";

import styles from "./MyExercisePageStyle";
import MuscleSummary from "./Components/MuscleSummary";
import ShareCard from "./Components/ShareCard";
import ShareConfirmModal from "./Components/ShareConfirmModal";
import StepsEditor from "./Components/StepsEditor";
import VideoCard from "./Components/VideoCard";
import VideoSourceSheet from "./Components/VideoSourceSheet";
import pickExerciseVideo, { VIDEO_MAX_SECONDS } from "./pickExerciseVideo";
import {
  draftFromExercise,
  draftHasChanges,
  newDraftStep,
  sameSavedValues,
  savedValuesFromDraft,
  savedValuesFromExercise,
} from "./myExerciseDraft";
import { useTranslation } from "@localization";
import { exerciseService } from "@services";
import { showToast } from "@resources/Components/Toast/Toast";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import Dumbbell from "@resources/Icons/UI-icons/Dumbbell";
import {
  ThemedButton,
  ThemedConfirmModal,
  ThemedKeyboardProtection,
  ThemedSegmentedControl,
  ThemedStateBlock,
  ThemedText,
  ThemedTextInput,
  ThemedView,
} from "@resources/ThemedComponents";
import {
  DESCRIPTION_MAX_LENGTH,
  EQUIPMENT_KEYS,
  MAX_STEPS,
  WEIGHT_MODES,
  equipmentLabelKey,
  normalizeDescription,
  weightModeLabelKey,
} from "@utils/customExercises";

// iOS reports a dialog's dismissal once it has left the screen, and the screen
// is left after that. If the report never comes, this is how long to wait.
const DISMISS_FALLBACK_MS = 700;

// Clears the KeyboardToolbar App.js puts over every keyboard (42) with room
// to spare, so the field being typed in is never under either.
const KEYBOARD_BOTTOM_OFFSET = 64;

function messageOf(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// The description is one line: a pasted line break becomes a space.
function oneLine(text) {
  return String(text ?? "").replace(/\s*\n\s*/g, " ");
}

function SectionHeader({ label, meta = null, theme }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionLabel} setColor={theme.quietText} accessibilityRole="header">
        {label}
      </ThemedText>
      {meta ? (
        <ThemedText style={styles.sectionMeta} setColor={theme.quietText}>
          {meta}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Your own custom exercise, opened from your exercise library: the muscles it
 * works, whether others can find it under Explore, its video, and what it is
 * and how it is done. The name is what every workout links it by, so it is
 * shown, never edited.
 *
 * Editing is local and works offline - the service saves it on the phone and
 * uploads it later. Sharing and the video talk to the cloud, one thing at a
 * time, and say so inline when they cannot.
 *
 * Route param: `exerciseName`.
 */
export default function MyExercisePage() {
  const navigation = useNavigation();
  const route = useRoute();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  // `danger` is 4.4:1 as text on white; the darker red holds 4.5 there.
  const dangerInk = isLight ? theme.dangerDark : theme.danger;
  const { t } = useTranslation();
  const exerciseName =
    typeof route.params?.exerciseName === "string" ? route.params.exerciseName : "";

  const [exercise, setExercise] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | error
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(() => draftFromExercise(null));
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // The value a share change in flight is setting; null when none is.
  const [sharePending, setSharePending] = useState(null);
  const [shareError, setShareError] = useState("");
  const [isShareConfirmOpen, setIsShareConfirmOpen] = useState(false);
  const [videoBusy, setVideoBusy] = useState(null); // "upload" | "remove" | null
  const [videoError, setVideoError] = useState("");
  const [isVideoSheetOpen, setIsVideoSheetOpen] = useState(false);
  const [isRemoveVideoOpen, setIsRemoveVideoOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const isMountedRef = useRef(true);
  // What is saved, for the callbacks that compare against it after an await.
  const exerciseRef = useRef(null);
  const busyRef = useRef(false);
  const stepInputRefs = useRef(new Map());
  const focusStepIdRef = useRef(null);
  const videoSourceRef = useRef(null);
  const leaveActionRef = useRef(null);
  const leaveOnDismissRef = useRef(false);
  const leaveTimerRef = useRef(null);

  const isReady = status === "ready" && exercise !== null;
  const isCopy =
    exercise?.sourceExerciseId !== null && exercise?.sourceExerciseId !== undefined;
  const hasChanges = exercise ? draftHasChanges(draft, exercise) : false;
  // One cloud call at a time, and no save while one runs: each hands back the
  // whole exercise, and an older answer landing last would undo a newer one.
  const isBusy = isSaving || sharePending !== null || videoBusy !== null;
  const isSaveDisabled = !hasChanges || isBusy;

  busyRef.current = isBusy;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimeout(leaveTimerRef.current);
    };
  }, []);

  /**
   * Puts an exercise the service handed back on screen. The form follows it
   * only where it is safe to: a new exercise, or saved values that changed
   * under a form nobody has touched. Otherwise the typing stays.
   */
  const adoptExercise = useCallback((next) => {
    if (!next) {
      return;
    }

    const previous = exerciseRef.current;

    exerciseRef.current = next;
    setExercise(next);
    setDraft((current) => {
      if (!previous || previous.name !== next.name) {
        return draftFromExercise(next);
      }

      if (sameSavedValues(savedValuesFromExercise(previous), savedValuesFromExercise(next))) {
        return current;
      }

      return draftHasChanges(current, previous) ? current : draftFromExercise(next);
    });
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!exerciseName) {
        setStatus("missing");
        return;
      }

      if (!silent) {
        setStatus("loading");
        setLoadError("");
      }

      try {
        const next = await exerciseService.getMyCustomExercise(db, exerciseName);

        if (!isMountedRef.current) {
          return;
        }

        if (!next) {
          exerciseRef.current = null;
          setExercise(null);
          setStatus("missing");
          return;
        }

        adoptExercise(next);
        setStatus("ready");
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        // A refresh in the background that fails keeps what is on screen.
        if (silent && exerciseRef.current) {
          return;
        }

        setLoadError(messageOf(error, t("myExercise.loadFailed")));
        setStatus("error");
      }
    },
    [adoptExercise, db, exerciseName, t]
  );

  // Read again on the way back from its public page, quietly - the poster's
  // link is signed for an hour, and the count of users moves. Not while a
  // call is out: it hands the exercise back itself.
  useFocusEffect(
    useCallback(() => {
      if (!busyRef.current) {
        load({ silent: exerciseRef.current !== null });
      }
    }, [load])
  );

  // A step that was just added gets the keyboard, once its field exists.
  useEffect(() => {
    const liveIds = new Set(draft.steps.map((step) => step.id));

    for (const id of stepInputRefs.current.keys()) {
      if (!liveIds.has(id)) {
        stepInputRefs.current.delete(id);
      }
    }

    const id = focusStepIdRef.current;
    const input = id ? stepInputRefs.current.get(id)?.current : null;

    if (input) {
      focusStepIdRef.current = null;
      input.focus();
    }
  }, [draft.steps]);

  const getStepInputRef = useCallback((id) => {
    let ref = stepInputRefs.current.get(id);

    if (!ref) {
      ref = { current: null };
      stepInputRefs.current.set(id, ref);
    }

    return ref;
  }, []);

  /* ------------------------------------------------------------ leaving -- */

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("ExerciseCatalogPage");
    }
  };

  // Every way out - the back button, the gesture, Android's back, a tab - goes
  // through here while something is unsaved. A save in flight is let go: it
  // finishes on its own.
  usePreventRemove(isReady && hasChanges && !isSaving, ({ data }) => {
    Keyboard.dismiss();
    leaveActionRef.current = data.action;
    setIsDiscardOpen(true);
  });

  const leave = () => {
    clearTimeout(leaveTimerRef.current);
    leaveOnDismissRef.current = false;

    const action = leaveActionRef.current;

    leaveActionRef.current = null;

    // Marked by the navigator as already asked about, so it goes through.
    if (action) {
      navigation.dispatch(action);
    }
  };

  const handleDiscard = () => {
    setIsDiscardOpen(false);

    // On iOS the dialog is a modal of its own; the screen is left once it has
    // gone, so UIKit is not asked to take both away at once.
    if (Platform.OS === "ios") {
      leaveOnDismissRef.current = true;
      leaveTimerRef.current = setTimeout(leave, DISMISS_FALLBACK_MS);
      return;
    }

    leave();
  };

  const handleDiscardDismissed = () => {
    if (leaveOnDismissRef.current) {
      leave();
    }
  };

  const handleKeepEditing = () => {
    leaveActionRef.current = null;
    setIsDiscardOpen(false);
  };

  /* -------------------------------------------------------------- editing -- */

  const updateDraft = (patch) => {
    setSaveError("");
    setDraft((current) => ({ ...current, ...patch }));
  };

  const changeStep = (id, text) => {
    setSaveError("");
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === id ? { ...step, text } : step)),
    }));
  };

  const addStep = () => {
    if (draft.steps.length >= MAX_STEPS) {
      return;
    }

    const step = newDraftStep();

    focusStepIdRef.current = step.id;
    setDraft((current) =>
      current.steps.length >= MAX_STEPS
        ? current
        : { ...current, steps: [...current.steps, step] }
    );
  };

  const removeStep = (id) => {
    setSaveError("");
    setDraft((current) => ({
      ...current,
      steps: current.steps.filter((step) => step.id !== id),
    }));
  };

  const focusStepAfter = (id) => {
    const index = draft.steps.findIndex((step) => step.id === id);
    const next = index >= 0 ? draft.steps[index + 1] : null;

    if (next) {
      stepInputRefs.current.get(next.id)?.current?.focus();
    }
  };

  const handleSave = async () => {
    if (!isReady || isSaveDisabled) {
      return;
    }

    Keyboard.dismiss();

    const values = savedValuesFromDraft(draft);

    setIsSaving(true);
    setSaveError("");

    try {
      const updated = await exerciseService.updateMyCustomExercise(db, exerciseName, values);

      // Said even when the page was left while it ran: it is saved.
      showToast(t("myExercise.saved"), { tone: "success" });

      if (!isMountedRef.current) {
        return;
      }

      if (!updated) {
        load({ silent: true });
        return;
      }

      exerciseRef.current = updated;
      setExercise(updated);
      // The form takes the saved shape - blank steps gone - unless somebody
      // typed on while the save ran.
      setDraft((current) =>
        sameSavedValues(savedValuesFromDraft(current), values)
          ? draftFromExercise(updated)
          : current
      );
    } catch (error) {
      if (isMountedRef.current) {
        setSaveError(messageOf(error, t("myExercise.saveFailed")));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  /* -------------------------------------------------------------- sharing -- */

  const applyShare = async (next) => {
    setSharePending(next);
    setShareError("");

    try {
      const updated = await exerciseService.setExercisePublic(db, exerciseName, next);

      if (!isMountedRef.current) {
        return;
      }

      if (updated) {
        adoptExercise(updated);
      } else {
        load({ silent: true });
      }
    } catch (error) {
      // The switch goes back by itself: it shows the saved value again.
      if (isMountedRef.current) {
        setShareError(
          messageOf(
            error,
            next ? t("myExercise.share.failed") : t("myExercise.share.stopFailed")
          )
        );
      }
    } finally {
      if (isMountedRef.current) {
        setSharePending(null);
      }
    }
  };

  // On asks first - it puts the exercise in front of strangers. Off does not:
  // the card says what it does before the switch is touched.
  const handleShareToggle = (next) => {
    if (!isReady || isCopy || isBusy) {
      return;
    }

    setShareError("");

    if (next) {
      Keyboard.dismiss();
      setIsShareConfirmOpen(true);
      return;
    }

    applyShare(false);
  };

  const confirmShare = () => {
    setIsShareConfirmOpen(false);
    applyShare(true);
  };

  /* ---------------------------------------------------------------- video -- */

  const runVideoCall = async (kind, call, fallbackMessage) => {
    setVideoBusy(kind);
    setVideoError("");

    try {
      const updated = await call();

      if (!isMountedRef.current) {
        return;
      }

      if (updated) {
        adoptExercise(updated);
      } else {
        load({ silent: true });
      }
    } catch (error) {
      if (isMountedRef.current) {
        setVideoError(messageOf(error, fallbackMessage));
      }
    } finally {
      if (isMountedRef.current) {
        setVideoBusy(null);
      }
    }
  };

  const openVideoSheet = () => {
    if (!isReady || isBusy) {
      return;
    }

    Keyboard.dismiss();
    setVideoError("");
    setIsVideoSheetOpen(true);
  };

  const chooseVideoSource = (source) => {
    videoSourceRef.current = source;
    setIsVideoSheetOpen(false);
  };

  const closeVideoSheet = () => {
    videoSourceRef.current = null;
    setIsVideoSheetOpen(false);
  };

  const uploadVideoFrom = async (source) => {
    let clip = null;

    try {
      clip = await pickExerciseVideo({ fromCamera: source === "camera" });
    } catch (error) {
      if (isMountedRef.current) {
        setVideoError(messageOf(error, t("myExercise.video.pickerFailed")));
      }
      return;
    }

    if (!clip || !isMountedRef.current || busyRef.current) {
      return;
    }

    await runVideoCall(
      "upload",
      () => exerciseService.uploadExerciseVideo(db, exerciseName, clip),
      t("myExercise.video.uploadFailed")
    );
  };

  // The picker is a modal of its own, and iOS drops one presented while the
  // sheet is still leaving - so it opens once the sheet has gone.
  const handleVideoSheetDismissed = () => {
    const source = videoSourceRef.current;

    videoSourceRef.current = null;

    if (source) {
      uploadVideoFrom(source);
    }
  };

  const askRemoveVideo = () => {
    if (!isReady || isBusy) {
      return;
    }

    setVideoError("");
    setIsRemoveVideoOpen(true);
  };

  const confirmRemoveVideo = () => {
    setIsRemoveVideoOpen(false);
    runVideoCall(
      "remove",
      () => exerciseService.removeExerciseVideo(db, exerciseName),
      t("myExercise.video.removeFailed")
    );
  };

  /* --------------------------------------------------------------- render -- */

  const title = exercise?.name || exerciseName;
  const isPublic = !isCopy && Boolean(exercise?.isPublic);
  const missingVideo = !exercise?.hasVideo;
  const missingDescription = !normalizeDescription(exercise?.description);
  // Shared, or about to be, without what makes people pick an exercise up.
  let nudge = null;

  if (missingVideo && missingDescription) {
    nudge = t("myExercise.share.nudge.both");
  } else if (missingVideo) {
    nudge = t("myExercise.share.nudge.video");
  } else if (missingDescription) {
    nudge = t("myExercise.share.nudge.description");
  }

  const weightModeOptions = WEIGHT_MODES.map((mode) => ({
    value: mode,
    label: t(weightModeLabelKey(mode)),
  }));
  let weightModeExplanation = t("myExercise.weightMode.total");

  if (draft.weightMode === "per_side") {
    weightModeExplanation = t("myExercise.weightMode.perSide");
  } else if (draft.weightMode === "bodyweight") {
    weightModeExplanation = t("myExercise.weightMode.bodyweight");
  }

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        activeOpacity={0.75}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        onPress={goBack}
        style={[
          styles.back,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        <ArrowLeft width={18} height={18} color={theme.title} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
          {t("myExercise.eyebrow")}
        </ThemedText>
        {title ? (
          <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
            {title}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  let body = null;

  if (status === "loading") {
    body = <ThemedStateBlock variant="loading" />;
  } else if (status === "error") {
    body = (
      <View
        style={[
          styles.stateCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        <ThemedStateBlock
          variant="error"
          title={t("myExercise.loadFailedTitle")}
          message={loadError}
          actionLabel={t("common.retry")}
          onAction={() => load()}
        />
      </View>
    );
  } else if (!isReady) {
    body = (
      <View
        style={[
          styles.stateCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        <ThemedStateBlock
          variant="empty"
          icon={
            <View
              style={[
                styles.stateIcon,
                { backgroundColor: withAlpha(theme.primary, isLight ? 0.12 : 0.14) },
              ]}
            >
              <Dumbbell width={22} height={22} color={theme.primaryText} />
            </View>
          }
          title={t("myExercise.notFound.title")}
          message={t("myExercise.notFound.body")}
          actionLabel={t("myExercise.notFound.back")}
          onAction={goBack}
        />
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.section}>
          <SectionHeader label={t("myExercise.muscles.section")} theme={theme} />
          <MuscleSummary muscles={exercise.muscles} />
        </View>

        <View style={styles.section}>
          <SectionHeader label={t("myExercise.share.section")} theme={theme} />
          <ShareCard
            isPublic={sharePending ?? isPublic}
            isAsking={isShareConfirmOpen}
            pending={sharePending}
            isCopy={isCopy}
            disabled={isBusy}
            users={exercise.users}
            nudge={nudge}
            error={shareError}
            onToggle={handleShareToggle}
            onSeeAsOthers={
              exercise.cloudId
                ? () =>
                    navigation.navigate("CustomExerciseDetailPage", {
                      exerciseId: exercise.cloudId,
                    })
                : undefined
            }
            onSeeOriginal={
              isCopy
                ? () =>
                    navigation.navigate("CustomExerciseDetailPage", {
                      exerciseId: exercise.sourceExerciseId,
                    })
                : undefined
            }
          />
        </View>

        {/* A copy is never shared, so nobody else would ever see its video. */}
        {!isCopy ? (
          <View style={styles.section}>
            <SectionHeader label={t("myExercise.video.section")} theme={theme} />
            <VideoCard
              hasVideo={Boolean(exercise.hasVideo)}
              durationMs={exercise.videoDurationMs}
              posterUrl={exercise.posterUrl}
              isPublic={isPublic}
              maxSeconds={VIDEO_MAX_SECONDS}
              busy={videoBusy}
              disabled={isBusy && videoBusy === null}
              error={videoError}
              onAdd={openVideoSheet}
              onChange={openVideoSheet}
              onRemove={askRemoveVideo}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            label={t("myExercise.description.label")}
            meta={`${draft.description.length}/${DESCRIPTION_MAX_LENGTH}`}
            theme={theme}
          />
          <ThemedTextInput
            value={draft.description}
            onChangeText={(text) => updateDraft({ description: oneLine(text) })}
            placeholder={t("myExercise.description.placeholder")}
            accessibilityLabel={t("myExercise.description.label")}
            maxLength={DESCRIPTION_MAX_LENGTH}
            multiline
            autoCapitalize="sentences"
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onFocus={() => setIsDescriptionFocused(true)}
            onBlur={() => setIsDescriptionFocused(false)}
            inputStyle={[
              styles.textArea,
              {
                backgroundColor: theme.cardBackground,
                borderColor: isDescriptionFocused ? theme.primary : theme.border,
                borderWidth: isDescriptionFocused ? 1.5 : 1,
                color: theme.title,
              },
            ]}
          />
          {!isCopy ? (
            <ThemedText style={styles.helper} setColor={theme.quietText}>
              {t("myExercise.description.helper")}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader
            label={t("myExercise.steps.label")}
            meta={draft.steps.length > 0 ? `${draft.steps.length}/${MAX_STEPS}` : null}
            theme={theme}
          />
          <StepsEditor
            steps={draft.steps}
            getInputRef={getStepInputRef}
            onChangeStep={changeStep}
            onAddStep={addStep}
            onRemoveStep={removeStep}
            onSubmitStep={focusStepAfter}
          />
          {draft.steps.length === 0 ? (
            <ThemedText style={styles.helper} setColor={theme.quietText}>
              {t("myExercise.steps.helper")}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader label={t("myExercise.equipment.label")} theme={theme} />
          <View style={styles.chips}>
            {EQUIPMENT_KEYS.map((key) => {
              const isSelected = draft.equipment === key;
              const label = t(equipmentLabelKey(key));

              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected }}
                  accessibilityHint={
                    isSelected ? t("myExercise.equipment.clearHint") : undefined
                  }
                  activeOpacity={0.82}
                  hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                  onPress={() => updateDraft({ equipment: isSelected ? null : key })}
                  style={[
                    styles.chip,
                    isSelected
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.cardBackground, borderColor: theme.border },
                  ]}
                >
                  <ThemedText
                    style={styles.chipText}
                    setColor={isSelected ? theme.textInverted : theme.mutedStrong}
                  >
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <ThemedText style={styles.helper} setColor={theme.quietText}>
            {t("myExercise.equipment.helper")}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <SectionHeader label={t("myExercise.weightMode.label")} theme={theme} />
          <ThemedSegmentedControl
            options={weightModeOptions}
            value={draft.weightMode}
            onChange={(mode) => updateDraft({ weightMode: mode })}
            style={styles.segmented}
          />
          <ThemedText style={styles.helper} setColor={theme.quietText}>
            {weightModeExplanation}
          </ThemedText>
        </View>
      </>
    );
  }

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedKeyboardProtection
        scroll
        bottomOffset={KEYBOARD_BOTTOM_OFFSET}
        contentContainerStyle={styles.scrollContent}
        scrollViewProps={{ showsVerticalScrollIndicator: false }}
      >
        {header}
        {body}
      </ThemedKeyboardProtection>

      {isReady ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: theme.background, borderTopColor: theme.hairline },
          ]}
        >
          {saveError ? (
            <ThemedText
              style={styles.footerError}
              setColor={dangerInk}
              accessibilityLiveRegion="polite"
            >
              {saveError}
            </ThemedText>
          ) : null}
          <ThemedButton
            title={isSaving ? t("myExercise.saving") : t("myExercise.save")}
            onPress={handleSave}
            disabled={isSaveDisabled}
            accessibilityLabel={t("myExercise.save")}
            accessibilityState={{ disabled: isSaveDisabled, busy: isSaving }}
            fullWidth
          />
        </View>
      ) : null}

      <ShareConfirmModal
        visible={isShareConfirmOpen}
        nudge={nudge}
        onConfirm={confirmShare}
        onClose={() => setIsShareConfirmOpen(false)}
      />

      <VideoSourceSheet
        visible={isVideoSheetOpen}
        isReplacing={Boolean(exercise?.hasVideo)}
        maxSeconds={VIDEO_MAX_SECONDS}
        onChoose={chooseVideoSource}
        onClose={closeVideoSheet}
        onDismiss={handleVideoSheetDismissed}
      />

      <ThemedConfirmModal
        visible={isRemoveVideoOpen}
        title={t("myExercise.video.removeConfirm.title")}
        message={t("myExercise.video.removeConfirm.body")}
        confirmLabel={t("myExercise.video.removeConfirm.confirm")}
        cancelLabel={t("myExercise.video.removeConfirm.cancel")}
        tone="danger"
        onConfirm={confirmRemoveVideo}
        onClose={() => setIsRemoveVideoOpen(false)}
      />

      <ThemedConfirmModal
        visible={isDiscardOpen}
        title={t("myExercise.discard.title")}
        message={t("myExercise.discard.body")}
        confirmLabel={t("myExercise.discard.confirm")}
        cancelLabel={t("myExercise.discard.cancel")}
        tone="danger"
        onConfirm={handleDiscard}
        onClose={handleKeepEditing}
        onDismiss={handleDiscardDismissed}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
