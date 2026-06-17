import { useEffect, useState } from "react";
import { Alert, View, TouchableOpacity, useColorScheme } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { Colors } from "../../Resources/GlobalStyling/colors";

import styles from "./WorkoutPageStyle";
import {
  ThemedBottomSheet,
  ThemedButton,
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
import { programService, workoutService } from "../../Services";
import { formatDate } from "../../Utils/dateUtils";

import Run from "./WorkoutTypes/Run/Run";
import Resistance from "./WorkoutTypes/Resistance/Resistance";

function getProgramCopyLocation(target) {
  const locationParts = [
    target?.mesocycle_number ? `Block ${target.mesocycle_number}` : null,
    target?.microcycle_number ? `Week ${target.microcycle_number}` : null,
    [target?.weekday, target?.date].filter(Boolean).join(" "),
  ].filter(Boolean);

  return locationParts.length
    ? `Add to ${locationParts.join(" - ")}`
    : "Add to this program day";
}

const WorkoutPage = ({ route }) => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const fieldSurface = theme.fields ?? theme.cardBackground ?? theme.background;

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
  const [metadata, setMetadata] = useState(null);
  const [restartRequestKey, setRestartRequestKey] = useState(0);
  const [isRepostingWorkoutPost, setIsRepostingWorkoutPost] = useState(false);
  const [isCopyingWorkout, setIsCopyingWorkout] = useState(false);
  const [pendingCopyTarget, setPendingCopyTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadMetadata = async () => {
      try {
        const nextMetadata = await workoutService.getWorkoutPageMetadata(db, workout_id);

        if (!cancelled) {
          setMetadata(nextMetadata);
        }
      } catch (error) {
        console.error("Failed to load workout metadata:", error);
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [db, workout_id]);

  const workoutType =
    metadata?.workout_type ?? initialWorkoutType ?? initialWorkoutLabel ?? null;
  const workoutLabel =
    metadata?.workout_label ?? initialWorkoutLabel ?? workoutType ?? "Workout";
  const workoutInstanceLabel = metadata?.workout_instance_label ?? null;
  const workoutDay = metadata?.day ?? initialDay ?? "";
  const workoutDate = metadata?.date ?? initialDate ?? "";
  const programId = metadata?.program_id ?? initialProgramId;
  const workoutSubtitle = [workoutDay, workoutDate].filter(Boolean).join(" - ");
  const headerEyebrowColor = theme.quietText ?? theme.iconColor;
  const isRunWorkout = workoutType === "Run";
  const isStrengthWorkout =
    workoutType === "Resistance" ||
    workoutType === "Upperbody" ||
    workoutType === "Legs" ||
    workoutType === "StrengthTraining";
  const supportsTimerRestart = isRunWorkout || isStrengthWorkout;
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
      const copiedWorkoutId = await programService.copyWorkoutToProgramDay(db, {
        workoutId: workout_id,
        dayId: target.day_id,
        date: target.date ?? selectedDate,
      });

      if (!copiedWorkoutId) {
        console.warn("No day found for date");
      }

      setPendingCopyTarget(null);
    } catch (error) {
      console.error("Copy workout failed:", error);
      Alert.alert("Could not copy workout", "Please try again.");
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
      });
      setPendingCopyTarget(null);
    } catch (error) {
      console.error("Copy standalone workout failed:", error);
      Alert.alert("Could not copy workout", "Please try again.");
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
      Alert.alert("Could not copy workout", "Please try again.");
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
      Alert.alert("Summary reposted", "The workout summary has been regenerated.");
    } catch (error) {
      Alert.alert(
        "Could not repost summary",
        error instanceof Error
          ? error.message
          : "The workout summary could not be regenerated."
      );
    } finally {
      setIsRepostingWorkoutPost(false);
    }
  };

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
            Workout
          </ThemedText>

          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {workoutLabel}
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
        <Run workout_id={workout_id} restartRequestKey={restartRequestKey} />
      )}

      {isStrengthWorkout && (
        <Resistance
          workout_id={workout_id}
          date={workoutDate}
          workoutInstanceLabel={workoutInstanceLabel}
          restartRequestKey={restartRequestKey}
        />
      )}

      <ThemedBottomSheet
        visible={optionsBottomsheetVisible}
        onClose={() => setOptionsBottomsheetVisible(false)}
      >
        <View style={styles.bottomsheetTitle}>
          <ThemedText>{workoutLabel}</ThemedText>
          <ThemedText>{workoutSubtitle}</ThemedText>
        </View>

        <View style={styles.bottomsheetBody}>
          <TouchableOpacity
            style={[styles.option, { paddingTop: 0 }]}
            onPress={openLabelModal}
          >
            <Name width={24} height={24} color={theme.iconColor} />
            <ThemedText style={styles.optionText}>Change name</ThemedText>
          </TouchableOpacity>

          {supportsTimerRestart && (
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                setOptionsBottomsheetVisible(false);
                setRestartRequestKey(Date.now());
              }}
            >
              <Reload width={24} height={24} />
              <ThemedText style={styles.optionText}>Restart Workout</ThemedText>
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
              {isRepostingWorkoutPost ? "Reposting summary..." : "Repost summary"}
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
              Copy workout to a different day
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={async () => {
              await deleteWorkout();
            }}
          >
            <Delete width={24} height={24} />
            <ThemedText style={styles.optionText}>Delete Workout</ThemedText>
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

      <ThemedModal
        visible={Boolean(pendingCopyTarget)}
        title="Copy to program?"
        onClose={closeCopyTargetModal}
      >
        <ThemedText style={styles.copyTargetDescription}>
          {pendingCopyTarget?.dateLabel
            ? `There is a program on ${pendingCopyTarget.dateLabel}. Add this workout to the program or keep it as a single workout?`
            : "There is a program on this date. Add this workout to the program or keep it as a single workout?"}
        </ThemedText>

        <View style={styles.copyTargetList}>
          {(pendingCopyTarget?.programTargets ?? []).map((target) => (
            <TouchableOpacity
              key={`${target.program_id}-${target.day_id}`}
              activeOpacity={0.82}
              disabled={isCopyingWorkout}
              onPress={() =>
                copyWorkoutToProgramTarget(target, pendingCopyTarget.date)
              }
              style={[
                styles.copyTargetOption,
                {
                  backgroundColor: fieldSurface,
                  borderColor: theme.cardBorder ?? theme.iconColor,
                  opacity: isCopyingWorkout ? 0.62 : 1,
                },
              ]}
            >
              <ThemedText
                style={styles.copyTargetTitle}
                setColor={theme.title ?? theme.text}
              >
                {getProgramCopyLocation(target)}
              </ThemedText>
              <ThemedText
                style={styles.copyTargetMeta}
                setColor={theme.quietText ?? theme.iconColor}
              >
                {target.program_name ?? "Program"}
              </ThemedText>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            activeOpacity={0.82}
            disabled={isCopyingWorkout}
            onPress={() => copyWorkoutToCalendarOnly(pendingCopyTarget.date)}
            style={[
              styles.copyTargetOption,
              {
                backgroundColor: fieldSurface,
                borderColor: theme.cardBorder ?? theme.iconColor,
                opacity: isCopyingWorkout ? 0.62 : 1,
              },
            ]}
          >
            <ThemedText
              style={styles.copyTargetTitle}
              setColor={theme.title ?? theme.text}
            >
              Single workout
            </ThemedText>
            <ThemedText
              style={styles.copyTargetMeta}
              setColor={theme.quietText ?? theme.iconColor}
            >
              Keep it standing on its own in Workout Calendar.
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedModal>

      <ThemedModal
        visible={labelModalVisible}
        title="Workout name"
        onClose={() => setLabelModalVisible(false)}
      >
        <ThemedTextInput
          value={nextWorkoutLabel}
          onChangeText={setNextWorkoutLabel}
          placeholder="Workout label"
          autoFocus
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={saveWorkoutLabel}
        />

        <View style={styles.modalActions}>
          <ThemedButton
            title="Cancel"
            variant="danger"
            onPress={() => setLabelModalVisible(false)}
            style={styles.modalAction}
          />
          <ThemedButton
            title={isSavingLabel ? "Saving..." : "Save"}
            onPress={saveWorkoutLabel}
            disabled={isSavingLabel}
            style={styles.modalAction}
          />
        </View>
      </ThemedModal>
    </ThemedView>
  );
};

export default WorkoutPage;
