import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View, TouchableOpacity, useColorScheme } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Colors } from "../../Resources/GlobalStyling/colors";

import styles from "./WorkoutPageStyle";
import {
  ThemedBottomSheet,
  ThemedButton,
  ThemedConfirmModal,
  ThemedHeader,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import ThreeDots from "../../Resources/Icons/UI-icons/ThreeDots";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import Copy from "../../Resources/Icons/UI-icons/Copy";
import Reload from "../../Resources/Icons/UI-icons/Reload";
import Name from "../../Resources/Icons/UI-icons/Name";
import Social from "../../Resources/Icons/UI-icons/Social";
import WorkoutCopyTargetModal from "../../Resources/Components/WorkoutCopyTargetModal";
import { programService, workoutService } from "../../Services";
import { formatDate } from "../../Utils/dateUtils";
import { STARTED_FROM } from "@utils/startedFrom";
import { useTranslation } from "@localization";

import Run from "./WorkoutTypes/Run/Run";
import Walk from "./WorkoutTypes/Walk/Walk";
import Resistance from "./WorkoutTypes/Resistance/Resistance";

const WorkoutPage = ({ route }) => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();

  const {
    workout_id,
    workout_label: initialWorkoutLabel,
    workout_type: initialWorkoutType,
    day: initialDay,
    date: initialDate,
    program_id: initialProgramId,
  } = route.params;

  const [optionsBottomsheetVisible, setOptionsBottomsheetVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [nextWorkoutLabel, setNextWorkoutLabel] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [newDate, setNewDate] = useState(new Date());
  const labelInputRef = useRef(null);
  const [deleteWorkoutConfirmVisible, setDeleteWorkoutConfirmVisible] =
    useState(false);
  const [restartConfirmVisible, setRestartConfirmVisible] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [restartRequestKey, setRestartRequestKey] = useState(0);
  const [isRepostingWorkoutPost, setIsRepostingWorkoutPost] = useState(false);
  const [isCopyingWorkout, setIsCopyingWorkout] = useState(false);
  const [pendingCopyTarget, setPendingCopyTarget] = useState(null);
  const [runHeaderTitle, setRunHeaderTitle] = useState(null);

  useEffect(() => {
    setRunHeaderTitle(null);
  }, [workout_id]);

  const loadMetadata = useCallback(async () => {
    try {
      const nextMetadata = await workoutService.getWorkoutPageMetadata(
        db,
        workout_id
      );
      setMetadata(nextMetadata);
      return nextMetadata;
    } catch (error) {
      console.error("Failed to load workout metadata:", error);
      return null;
    }
  }, [db, workout_id]);

  useFocusEffect(
    useCallback(() => {
      void loadMetadata();
    }, [loadMetadata])
  );

  const workoutType =
    metadata?.workout_type ?? initialWorkoutType ?? initialWorkoutLabel ?? null;
  const workoutLabel =
    metadata?.workout_label ?? initialWorkoutLabel ?? workoutType ?? t("workout.page.fallbackTitle");
  const workoutInstanceLabel = metadata?.workout_instance_label ?? null;
  const workoutDay = metadata?.day ?? initialDay ?? "";
  const workoutDate = metadata?.date ?? initialDate ?? "";
  const programId = metadata?.program_id ?? initialProgramId;
  // BUG-20: the home screen writes this same pairing as "FRIDAY · 11.09.2026".
  const workoutSubtitle = [workoutDay, workoutDate]
    .filter(Boolean)
    .join(" · ");
  const headerEyebrowColor = theme.quietText ?? theme.iconColor;
  const [autoNamedLabel, setAutoNamedLabel] = useState(null);
  const previousWorkoutLabelRef = useRef(workoutLabel);

  useEffect(() => {
    const previousLabel = previousWorkoutLabelRef.current;
    previousWorkoutLabelRef.current = workoutLabel;

    // Only the rename the app did itself: the title was the workout type, and
    // is now something else. A rename through Change name is the user's own.
    if (
      previousLabel === workoutLabel ||
      previousLabel !== workoutType ||
      !workoutLabel ||
      workoutLabel === workoutType
    ) {
      return;
    }

    setAutoNamedLabel(workoutLabel);
    const timeoutId = setTimeout(() => setAutoNamedLabel(null), 6000);

    return () => clearTimeout(timeoutId);
  }, [workoutLabel, workoutType]);
  const isRunWorkout = workoutType === "Run";
  const isWalkWorkout = workoutType === "Walk";
  const isStrengthWorkout =
    workoutType === "Resistance" ||
    workoutType === "Upperbody" ||
    workoutType === "Legs" ||
    workoutType === "StrengthTraining";
  const supportsTimerRestart =
    isRunWorkout || isWalkWorkout || isStrengthWorkout;
  const canRepostWorkoutSummary = workoutType === "Resistance";

  const openLabelModal = () => {
    setNextWorkoutLabel(workoutInstanceLabel ?? "");
    setOptionsBottomsheetVisible(false);
    setLabelModalVisible(true);
  };

  const saveWorkoutLabel = async () => {
    if (isSavingLabel) {
      return;
    }

    const normalizedLabel = nextWorkoutLabel.trim();
    const nextLabel = normalizedLabel.length > 0 ? normalizedLabel : null;

    try {
      setIsSavingLabel(true);
      await workoutService.updateWorkoutLabel(db, {
        workoutId: workout_id,
        label: nextLabel,
      });

      const nextMetadata = await workoutService.getWorkoutPageMetadata(
        db,
        workout_id
      );
      setMetadata(nextMetadata);
      setLabelModalVisible(false);
    } catch (error) {
      console.error("Failed to update workout label:", error);
    } finally {
      setIsSavingLabel(false);
    }
  };

  const deleteWorkout = async () => {
    try {
      await programService.deleteWorkout(db, workout_id);
      setOptionsBottomsheetVisible(false);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to delete workout:", error);
    }
  };

  const confirmDeleteWorkout = () => {
    setDeleteWorkoutConfirmVisible(true);
  };

  const confirmRestartWorkout = () => {
    setRestartConfirmVisible(true);
  };

  const closeCopyTargetModal = () => {
    if (isCopyingWorkout) {
      return;
    }

    setPendingCopyTarget(null);
  };

  const copyWorkoutToProgramTarget = async (target, selectedDate) => {
    if (!target?.day_id || isCopyingWorkout) {
      return;
    }

    setIsCopyingWorkout(true);
    try {
      // A copy made from the workout's own page is none of the four
      // the overview names, so it is counted as other.
      const copiedWorkoutId = await programService.copyWorkoutToProgramDay(db, {
        workoutId: workout_id,
        dayId: target.day_id,
        date: target.date ?? selectedDate,
        startedFrom: STARTED_FROM.OTHER,
      });

      if (!copiedWorkoutId) {
        console.warn("No day found for date");
      }

      setPendingCopyTarget(null);
    } catch (error) {
      console.error("Copy workout failed:", error);
      Alert.alert(t("workout.page.copyFailedTitle"), t("workout.page.tryAgain"));
    } finally {
      setIsCopyingWorkout(false);
    }
  };

  const copyWorkoutToCalendarOnly = async (selectedDate) => {
    if (isCopyingWorkout) {
      return;
    }

    setIsCopyingWorkout(true);
    try {
      await programService.copyWorkoutToStandaloneDate(db, {
        workoutId: workout_id,
        date: selectedDate,
        startedFrom: STARTED_FROM.OTHER,
      });
      setPendingCopyTarget(null);
    } catch (error) {
      console.error("Copy standalone workout failed:", error);
      Alert.alert(t("workout.page.copyFailedTitle"), t("workout.page.tryAgain"));
    } finally {
      setIsCopyingWorkout(false);
    }
  };

  const copyWorkoutToDate = async (selectedDate) => {
    try {
      const programTargets = await programService.getWorkoutCopyProgramTargets(db, {
        date: selectedDate,
      });

      if (programTargets.length === 0) {
        await copyWorkoutToCalendarOnly(selectedDate);
        return;
      }

      if (programId) {
        const preferredProgramTarget =
          programTargets.find(
            (target) => Number(target.program_id) === Number(programId)
          ) ?? programTargets[0];

        await copyWorkoutToProgramTarget(preferredProgramTarget, selectedDate);
        return;
      }

      setPendingCopyTarget({
        date: selectedDate,
        dateLabel: formatDate(selectedDate),
        programTargets,
      });
    } catch (error) {
      console.error("Copy workout target lookup failed:", error);
      Alert.alert(t("workout.page.copyFailedTitle"), t("workout.page.tryAgain"));
    }
  };

  const repostWorkoutSummary = async () => {
    if (isRepostingWorkoutPost) {
      return;
    }

    setOptionsBottomsheetVisible(false);
    setIsRepostingWorkoutPost(true);

    try {
      await workoutService.repostWorkoutSummaryPost(db, {
        workoutId: workout_id,
      });
      Alert.alert(t("workout.page.repostedTitle"), t("workout.page.repostedMessage"));
    } catch (error) {
      Alert.alert(
        t("workout.page.repostFailedTitle"),
        error instanceof Error
          ? error.message
          : t("workout.page.repostFailedMessage")
      );
    } finally {
      setIsRepostingWorkoutPost(false);
    }
  };

  const overlays = (
    <>
      <ThemedConfirmModal
        visible={deleteWorkoutConfirmVisible}
        title={t("workout.page.deleteTitle")}
        message={t("workout.page.deleteMessage")}
        confirmLabel={t("workout.page.deleteConfirm")}
        tone="danger"
        onConfirm={() => {
          setDeleteWorkoutConfirmVisible(false);
          void deleteWorkout();
        }}
        onClose={() => setDeleteWorkoutConfirmVisible(false)}
      />

      <ThemedConfirmModal
        visible={restartConfirmVisible}
        title={t("workout.page.restartTitle")}
        message={t("workout.page.restartMessage")}
        confirmLabel={t("workout.page.restartConfirm")}
        tone="danger"
        onConfirm={() => {
          setRestartConfirmVisible(false);
          setOptionsBottomsheetVisible(false);
          setRestartRequestKey(Date.now());
        }}
        onClose={() => setRestartConfirmVisible(false)}
      />

  <ThemedBottomSheet
    visible={optionsBottomsheetVisible}
    onClose={() => setOptionsBottomsheetVisible(false)}
  >
    <View style={[styles.bottomsheetTitle, { borderBottomColor: theme.hairline }]}>
      <ThemedText>{workoutLabel}</ThemedText>
      <ThemedText>{workoutSubtitle}</ThemedText>
    </View>

    <View style={styles.bottomsheetBody}>
      <TouchableOpacity
        style={[styles.option, { paddingTop: 0 }]}
        onPress={openLabelModal}
      >
        <Name width={24} height={24} color={theme.iconColor} />
        <ThemedText style={styles.optionText}>{t("workout.page.options.changeName")}</ThemedText>
      </TouchableOpacity>

      {supportsTimerRestart && (
        <TouchableOpacity
          style={styles.option}
          onPress={confirmRestartWorkout}
        >
          <Reload width={24} height={24} />
          <ThemedText style={styles.optionText}>{t("workout.page.options.restart")}</ThemedText>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.option,
          !canRepostWorkoutSummary || isRepostingWorkoutPost
            ? { opacity: 0.45 }
            : null,
        ]}
        onPress={repostWorkoutSummary}
        disabled={!canRepostWorkoutSummary || isRepostingWorkoutPost}
      >
        <Social width={24} height={24} color={theme.iconColor} />
        <ThemedText style={styles.optionText}>
          {isRepostingWorkoutPost
            ? t("workout.page.options.reposting")
            : t("workout.page.options.repost")}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          { paddingTop: supportsTimerRestart ? 20 : 0 },
        ]}
        onPress={() => {
          setOptionsBottomsheetVisible(false);
          setDatePickerVisible(true);
        }}
      >
        <Copy width={24} height={24} />
        <ThemedText style={styles.optionText}>
          {t("workout.page.options.copyToDay")}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.option}
        onPress={confirmDeleteWorkout}
      >
        <Delete width={24} height={24} />
        <ThemedText style={styles.optionText}>{t("workout.page.options.delete")}</ThemedText>
      </TouchableOpacity>
    </View>
  </ThemedBottomSheet>

  {datePickerVisible && (
    <DateTimePicker
      value={newDate}
      mode="date"
      display="default"
      onChange={async (event, selectedDate) => {
        setDatePickerVisible(false);

        if (event.type !== "set" || !selectedDate) {
          return;
        }

        setNewDate(selectedDate);
        await copyWorkoutToDate(selectedDate);
      }}
    />
  )}

  <WorkoutCopyTargetModal
    visible={Boolean(pendingCopyTarget)}
    onClose={closeCopyTargetModal}
    dateLabel={pendingCopyTarget?.dateLabel}
    programTargets={pendingCopyTarget?.programTargets ?? []}
    isSubmitting={isCopyingWorkout}
    onConfirmProgramTarget={(target) =>
      copyWorkoutToProgramTarget(target, pendingCopyTarget?.date)
    }
    onConfirmSingleWorkout={() =>
      copyWorkoutToCalendarOnly(pendingCopyTarget?.date)
    }
  />

  <ThemedModal
    visible={labelModalVisible}
    title={t("workout.page.nameModal.title")}
    onClose={() => setLabelModalVisible(false)}
    onShow={() => labelInputRef.current?.focus()}
  >
    <ThemedTextInput
      value={nextWorkoutLabel}
      onChangeText={setNextWorkoutLabel}
      placeholder={t("workout.page.nameModal.placeholder")}
      innerRef={labelInputRef}
      maxLength={40}
      returnKeyType="done"
      onSubmitEditing={saveWorkoutLabel}
    />

    <View style={styles.modalActions}>
      <ThemedButton
        title={t("common.cancel")}
        variant="danger"
        onPress={() => setLabelModalVisible(false)}
        style={styles.modalAction}
      />
      <ThemedButton
        title={isSavingLabel ? t("workout.page.nameModal.saving") : t("common.save")}
        onPress={saveWorkoutLabel}
        disabled={isSavingLabel}
        style={styles.modalAction}
      />
    </View>
  </ThemedModal>
    </>
  );

  // Strength workouts paint their own top area, status bar included, so the
  // page must not reserve the top inset or draw the shared header.
  if (isStrengthWorkout) {
    return (
      <ThemedView safe={["left", "right"]}>
        <Resistance
          workout_id={workout_id}
          date={workoutDate}
          workoutLabel={workoutLabel}
          autoNamedLabel={autoNamedLabel}
          workoutInstanceLabel={workoutInstanceLabel}
          restartRequestKey={restartRequestKey}
          onWorkoutMetadataChange={loadMetadata}
          onOpenOptions={() => setOptionsBottomsheetVisible(true)}
        />

        {overlays}
      </ThemedView>
    );
  }

  return (
    <ThemedView safe={["top", "left", "right"]}>
      <ThemedHeader
        right={
          <TouchableOpacity
            onPress={() => {
              setOptionsBottomsheetVisible(true);
            }}
          >
            <ThreeDots width={20} height={20} />
          </TouchableOpacity>
        }
      >
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[
              styles.pageHeaderTitleEyebrow,
              { color: headerEyebrowColor },
            ]}
          >
            {t("workout.page.fallbackTitle")}
          </ThemedText>

          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {isRunWorkout && runHeaderTitle
              ? runHeaderTitle
              : workoutLabel}
          </ThemedTitle>

          {!!workoutSubtitle && (
            <ThemedText
              size={10}
              style={[
                styles.pageHeaderTitleMeta,
                isRunWorkout && [
                  styles.pageHeaderTitleMetaPill,
                  { backgroundColor: theme.cardBackground ?? theme.uiBackground },
                ],
                { color: headerEyebrowColor },
              ]}
            >
              {workoutSubtitle}
            </ThemedText>
          )}
        </View>
      </ThemedHeader>

      {isRunWorkout && (
        <Run
          workout_id={workout_id}
          restartRequestKey={restartRequestKey}
          onHeaderTitleChange={setRunHeaderTitle}
        />
      )}

      {isWalkWorkout && (
        <Walk
          workout_id={workout_id}
          restartRequestKey={restartRequestKey}
        />
      )}

      {isStrengthWorkout && (
        <Resistance
          workout_id={workout_id}
          date={workoutDate}
          workoutInstanceLabel={workoutInstanceLabel}
          restartRequestKey={restartRequestKey}
          onWorkoutMetadataChange={loadMetadata}
        />
      )}

      {overlays}
    </ThemedView>
  );
};

export default WorkoutPage;
