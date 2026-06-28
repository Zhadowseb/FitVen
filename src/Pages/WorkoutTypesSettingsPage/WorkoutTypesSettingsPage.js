import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";

import styles from "./WorkoutTypesSettingsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import ResistanceIcon from "../../Resources/Icons/WorkoutLabels/Resistance";
import RunIcon from "../../Resources/Icons/WorkoutLabels/Run";
import Library from "../../Resources/Icons/UI-icons/Library";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { useAuth } from "../../Contexts/AuthContext";
import { socialService } from "../../Services";
import {
  calculateAgeFromBirthDate,
  dateToIsoDate,
  isoDateToLocalDate,
  normalizeLocalDateString,
} from "../../Utils/dateUtils";
import {
  MAX_MAX_HEART_RATE,
  MIN_MAX_HEART_RATE,
  normalizeMaxHeartRate,
} from "../../Utils/heartRateUtils";
import {
  ThemedButton,
  ThemedCard,
  ThemedDateWheelPicker,
  ThemedHeader,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const WORKOUT_TYPES = [
  {
    id: "strength-training",
    title: "Strength Training",
    category: "STRENGTH",
    metrics: "SETS  /  REPS  /  WEIGHT",
    Icon: ResistanceIcon,
  },
  {
    id: "run",
    title: "Run",
    category: "CARDIO",
    metrics: "DISTANCE  /  PACE  /  TIME",
    Icon: RunIcon,
  },
];

export default function WorkoutTypesSettingsPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [birthDate, setBirthDate] = useState("");
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [isLoadingBirthDate, setIsLoadingBirthDate] = useState(true);
  const [isSavingBirthDate, setIsSavingBirthDate] = useState(false);
  const [birthDateError, setBirthDateError] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState(null);
  const [maxHeartRateSource, setMaxHeartRateSource] = useState("calculated");
  const [manualMaxHeartRate, setManualMaxHeartRate] = useState(null);
  const [maxHeartRateInput, setMaxHeartRateInput] = useState("");
  const [maxHeartRateModalVisible, setMaxHeartRateModalVisible] =
    useState(false);
  const [isSavingMaxHeartRate, setIsSavingMaxHeartRate] = useState(false);
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const iconSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const recordColor = theme.record ?? "rgb(3, 111, 252)";
  const birthDateDisplay = normalizeLocalDateString(birthDate);
  const calculatedAge = calculateAgeFromBirthDate(birthDate);
  const normalizedMaxHeartRateInput = normalizeMaxHeartRate(maxHeartRateInput);
  const maxHeartRateInputError =
    maxHeartRateInput.trim() && normalizedMaxHeartRateInput === null
      ? `Use a whole number from ${MIN_MAX_HEART_RATE} to ${MAX_MAX_HEART_RATE}.`
      : "";
  const maxHeartRateSourceColor =
    maxHeartRateSource === "measured"
      ? recordColor
      : maxHeartRateSource === "manual"
        ? primaryColor
        : secondaryColor;

  const applyRunProfileSettings = useCallback((profile) => {
    setBirthDate(profile.birthDate ?? "");
    setManualMaxHeartRate(profile.manualMaxHeartRate ?? null);
    setMaxHeartRate(profile.maxHeartRate ?? null);
    setMaxHeartRateSource(profile.maxHeartRateSource ?? "calculated");
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadBirthDate = async () => {
        if (!user?.id) {
          setBirthDate("");
          setBirthDateError("Sign in to manage Run settings.");
          setIsLoadingBirthDate(false);
          return;
        }

        setIsLoadingBirthDate(true);
        setBirthDateError("");

        try {
          const profile = await socialService.getOwnRunProfileSettings(user);

          if (!isCancelled) {
            applyRunProfileSettings(profile);
          }
        } catch (error) {
          if (!isCancelled) {
            setBirthDateError(
              error instanceof Error
                ? error.message
                : "Could not load Run settings."
            );
          }
        } finally {
          if (!isCancelled) {
            setIsLoadingBirthDate(false);
          }
        }
      };

      void loadBirthDate();

      return () => {
        isCancelled = true;
      };
    }, [applyRunProfileSettings, user])
  );

  const getBirthDatePickerValue = () => {
    const selectedBirthDate = isoDateToLocalDate(birthDate);

    if (selectedBirthDate) {
      return selectedBirthDate;
    }

    const defaultBirthDate = new Date();
    defaultBirthDate.setFullYear(defaultBirthDate.getFullYear() - 18);
    return defaultBirthDate;
  };

  const saveBirthDate = async (selectedDate) => {
    const nextBirthDate = dateToIsoDate(selectedDate);

    if (!nextBirthDate || isSavingBirthDate) {
      return;
    }

    setIsSavingBirthDate(true);
    setBirthDateError("");

    try {
      const updatedBirthDate = await socialService.updateOwnBirthDate({
        user,
        birthDate: nextBirthDate,
      });

      applyRunProfileSettings(updatedBirthDate);
      setBirthDatePickerVisible(false);
    } catch (error) {
      setBirthDateError(
        error instanceof Error ? error.message : "Could not save birth date."
      );
    } finally {
      setIsSavingBirthDate(false);
    }
  };

  const openMaxHeartRateModal = () => {
    setMaxHeartRateInput(
      manualMaxHeartRate === null ? "" : String(manualMaxHeartRate)
    );
    setBirthDateError("");
    setMaxHeartRateModalVisible(true);
  };

  const saveManualMaxHeartRate = async (value = maxHeartRateInput) => {
    if (isSavingMaxHeartRate) {
      return;
    }

    const normalizedValue = normalizeMaxHeartRate(value);

    if (value !== "" && normalizedValue === null) {
      return;
    }

    setIsSavingMaxHeartRate(true);
    setBirthDateError("");

    try {
      const profile = await socialService.updateOwnManualMaxHeartRate({
        user,
        maxHeartRate: value === "" ? null : normalizedValue,
      });

      applyRunProfileSettings(profile);
      setMaxHeartRateModalVisible(false);
    } catch (error) {
      setBirthDateError(
        error instanceof Error
          ? error.message
          : "Could not save max heart rate."
      );
    } finally {
      setIsSavingMaxHeartRate(false);
    }
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
            Workout Types
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <View>
            <ThemedText style={styles.sectionEyebrow} setColor={primaryColor}>
              AVAILABLE
            </ThemedText>
            <ThemedText style={styles.sectionTitle} setColor={titleColor}>
              Workout types
            </ThemedText>
          </View>
          <ThemedText style={styles.sectionCount} setColor={quietText}>
            {WORKOUT_TYPES.length} TYPES
          </ThemedText>
        </View>

        <View style={styles.typeList}>
          {WORKOUT_TYPES.map((workoutType) => {
            const accentColor =
              workoutType.id === "run" ? secondaryColor : primaryColor;
            const WorkoutTypeIcon = workoutType.Icon;

            return (
              <ThemedCard
                key={workoutType.id}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: cardSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.typeHeader}>
                  <View
                    style={[
                      styles.typeIconFrame,
                      {
                        backgroundColor: iconSurface,
                        borderColor: accentColor,
                      },
                    ]}
                  >
                    {workoutType.id === "run" ? (
                      <WorkoutTypeIcon
                        width={25}
                        height={25}
                        primaryColor={accentColor}
                      />
                    ) : (
                      <WorkoutTypeIcon
                        width={25}
                        height={25}
                        color={accentColor}
                      />
                    )}
                  </View>

                  <View style={styles.typeCopy}>
                    <ThemedText
                      style={styles.typeCategory}
                      setColor={accentColor}
                    >
                      {workoutType.category}
                    </ThemedText>
                    <ThemedText style={styles.typeTitle} setColor={titleColor}>
                      {workoutType.title}
                    </ThemedText>
                    <ThemedText style={styles.typeMetrics} setColor={quietText}>
                      {workoutType.metrics}
                    </ThemedText>
                  </View>

                  <View style={styles.availableStatus}>
                    <Feather name="check-circle" size={17} color={accentColor} />
                    <ThemedText
                      style={styles.availableStatusText}
                      setColor={quietText}
                    >
                      AVAILABLE
                    </ThemedText>
                  </View>
                </View>

                {workoutType.id === "strength-training" ? (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    onPress={() =>
                      Alert.alert(
                        "Exercises",
                        "Settings for this section will be added here."
                      )
                    }
                    style={[
                      styles.typeSettingRow,
                      { borderTopColor: cardBorder },
                    ]}
                  >
                    <View style={styles.typeSettingCopy}>
                      <Library width={20} height={20} color={titleColor} />
                      <ThemedText
                        style={styles.typeSettingTitle}
                        setColor={titleColor}
                      >
                        Exercises
                      </ThemedText>
                    </View>
                    <TailArrowUpRight
                      width={17}
                      height={17}
                      stroke={titleColor}
                      color={titleColor}
                    />
                  </TouchableOpacity>
                ) : null}

                {workoutType.id === "run" ? (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      disabled={isLoadingBirthDate || isSavingBirthDate}
                      onPress={() => setBirthDatePickerVisible(true)}
                      style={[
                        styles.typeSettingRow,
                        {
                          borderTopColor: cardBorder,
                          opacity: isLoadingBirthDate ? 0.55 : 1,
                        },
                      ]}
                    >
                      <View style={styles.typeSettingCopy}>
                        <Feather name="calendar" size={20} color={titleColor} />
                        <View>
                          <ThemedText
                            style={styles.typeSettingTitle}
                            setColor={titleColor}
                          >
                            Birth date
                          </ThemedText>
                          <ThemedText
                            style={styles.typeSettingMeta}
                            setColor={quietText}
                          >
                            {birthDateDisplay
                              ? `${birthDateDisplay}  /  Age ${calculatedAge}`
                              : "Set birth date"}
                          </ThemedText>
                        </View>
                      </View>
                      {isLoadingBirthDate || isSavingBirthDate ? (
                        <ActivityIndicator size="small" color={secondaryColor} />
                      ) : (
                        <TailArrowUpRight
                          width={17}
                          height={17}
                          stroke={titleColor}
                          color={titleColor}
                        />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.78}
                      disabled={isLoadingBirthDate || isSavingMaxHeartRate}
                      onPress={openMaxHeartRateModal}
                      style={[
                        styles.typeSettingRow,
                        {
                          borderTopColor: cardBorder,
                          opacity: isLoadingBirthDate ? 0.55 : 1,
                        },
                      ]}
                    >
                      <View style={styles.typeSettingCopy}>
                        <Feather name="heart" size={20} color={titleColor} />
                        <View>
                          <ThemedText
                            style={styles.typeSettingTitle}
                            setColor={titleColor}
                          >
                            Max heart rate
                          </ThemedText>
                          <ThemedText
                            style={styles.typeSettingMeta}
                            setColor={quietText}
                          >
                            {maxHeartRate === null
                              ? "Set birth date or enter manually"
                              : `${maxHeartRate} bpm`}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.maxHeartRateRight}>
                        <View
                          style={[
                            styles.maxHeartRateBadge,
                            { borderColor: maxHeartRateSourceColor },
                          ]}
                        >
                          <ThemedText
                            style={styles.maxHeartRateBadgeText}
                            setColor={maxHeartRateSourceColor}
                          >
                            {maxHeartRateSource}
                          </ThemedText>
                        </View>
                        <TailArrowUpRight
                          width={16}
                          height={16}
                          stroke={titleColor}
                          color={titleColor}
                        />
                      </View>
                    </TouchableOpacity>
                  </>
                ) : null}
              </ThemedCard>
            );
          })}
        </View>

        {birthDateError ? (
          <ThemedText style={styles.feedbackText} setColor={theme.danger}>
            {birthDateError}
          </ThemedText>
        ) : null}
      </ScrollView>

      <ThemedDateWheelPicker
        visible={birthDatePickerVisible}
        value={getBirthDatePickerValue()}
        minYear={1900}
        title="Run birth date"
        isConfirming={isSavingBirthDate}
        onClose={() => {
          if (!isSavingBirthDate) {
            setBirthDatePickerVisible(false);
          }
        }}
        onConfirm={saveBirthDate}
      />

      <ThemedModal
        visible={maxHeartRateModalVisible}
        title="Max heart rate"
        dismissOnBackdropPress={!isSavingMaxHeartRate}
        onClose={() => {
          if (!isSavingMaxHeartRate) {
            setMaxHeartRateModalVisible(false);
          }
        }}
      >
        <ThemedText style={styles.modalBody} setColor={quietText}>
          Enter a manual max heart rate. A measured value will always take
          priority.
        </ThemedText>
        <ThemedTextInput
          value={maxHeartRateInput}
          onChangeText={(value) =>
            setMaxHeartRateInput(value.replace(/[^0-9]/g, "").slice(0, 3))
          }
          placeholder={
            maxHeartRate === null
              ? "Max bpm"
              : `Current ${maxHeartRate} bpm`
          }
          keyboardType="number-pad"
          editable={!isSavingMaxHeartRate}
          error={maxHeartRateInputError || undefined}
          inputStyle={{
            backgroundColor: iconSurface,
            color: titleColor,
          }}
          placeholderTextColor={quietText}
        />

        {manualMaxHeartRate !== null ? (
          <TouchableOpacity
            activeOpacity={0.72}
            disabled={isSavingMaxHeartRate}
            onPress={() => saveManualMaxHeartRate("")}
            style={styles.clearManualButton}
          >
            <ThemedText
              style={styles.clearManualButtonText}
              setColor={secondaryColor}
            >
              Clear manual value
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        <View style={styles.modalActions}>
          <ThemedButton
            title="Cancel"
            variant="secondary"
            disabled={isSavingMaxHeartRate}
            onPress={() => setMaxHeartRateModalVisible(false)}
            style={styles.modalAction}
          />
          <ThemedButton
            title={isSavingMaxHeartRate ? "Saving..." : "Save"}
            disabled={
              isSavingMaxHeartRate ||
              !maxHeartRateInput.trim() ||
              Boolean(maxHeartRateInputError)
            }
            onPress={() => saveManualMaxHeartRate()}
            style={styles.modalAction}
          />
        </View>
      </ThemedModal>
    </ThemedView>
  );
}
