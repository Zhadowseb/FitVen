import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { useTranslation } from "@localization";

import styles from "./WorkoutTypesSettingsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import ResistanceIcon from "../../Resources/Icons/WorkoutLabels/Resistance";
import RunIcon from "../../Resources/Icons/WorkoutLabels/Run";
import Library from "../../Resources/Icons/UI-icons/Library";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { useAuth } from "../../Contexts/AuthContext";
import { useExerciseViewSettings } from "../../Contexts/ExerciseViewSettingsContext";
import { filterReleasedWorkoutTypes } from "../../Utils/workoutTypeAvailability";
import { socialService } from "../../Services";
import CollapsedSetSummary, {
  ClassicSetSummary,
} from "../WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/CollapsedSetSummary";
import {
  calculateAgeFromBirthDate,
  dateToIsoDate,
  isoDateToLocalDate,
  normalizeLocalDateString,
} from "../../Utils/dateUtils";
import {
  MAX_MAX_HEART_RATE,
  MAX_HEART_RATE_SOURCE_AUTO,
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
    textKey: "settings.workoutTypes.types.strength",
    Icon: ResistanceIcon,
  },
  {
    id: "run",
    textKey: "settings.workoutTypes.types.run",
    Icon: RunIcon,
  },
];

// Only the types that have actually shipped. Run is still in the list above,
// because this screen is where its settings will live again the day it does.
const RELEASED_WORKOUT_TYPES = filterReleasedWorkoutTypes(
  WORKOUT_TYPES,
  (workoutType) => workoutType.id
);

const EXERCISE_VIEW_OPTIONS = [
  { value: "cells", titleKey: "settings.workoutTypes.views.cells" },
  { value: "compact", titleKey: "settings.workoutTypes.views.compact" },
  { value: "progressOnly", titleKey: "settings.workoutTypes.views.progressOnly" },
];

const EXERCISE_CARD_LAYOUT_OPTIONS = [
  { value: "compact", titleKey: "settings.workoutTypes.cardLayouts.compact" },
  { value: "classic", titleKey: "settings.workoutTypes.cardLayouts.classic" },
];

// The max heart rate sources the badge and the options can name.
const MAX_HEART_RATE_SOURCE_KEYS = ["auto", "manual", "calculated", "measured"];

// One sample for every preview on this screen, so an option shows what it will
// actually look like rather than a sentence describing it.
const PREVIEW_SETS = [
  { sets_id: "preview-1", weight: 45, reps: 10, done: 1 },
  { sets_id: "preview-2", weight: 45, reps: 8, done: 1 },
  { sets_id: "preview-3", weight: 47.5, reps: 6, failed: 1 },
  { sets_id: "preview-4", weight: 50, reps: 4 },
];

// "Progress only" renders nothing on purpose - the empty frame is its preview.
// Compact only puts sets on one line while there are three or fewer, so its
// sample is trimmed to three; with four it would be indistinguishable from
// Standard and the preview would be telling the user something untrue.
function LayoutOptionPreview({ cardLayout, view, theme }) {
  if (cardLayout === "classic") {
    return <ClassicSetSummary theme={theme} sets={PREVIEW_SETS} />;
  }

  return (
    <CollapsedSetSummary
      view={view}
      theme={theme}
      sets={view === "compact" ? PREVIEW_SETS.slice(0, 3) : PREVIEW_SETS}
    />
  );
}

export default function WorkoutTypesSettingsPage() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const {
    collapsedExerciseView,
    setCollapsedExerciseView,
    collapsedExerciseCardLayout,
    setCollapsedExerciseCardLayout,
  } = useExerciseViewSettings();
  const [birthDate, setBirthDate] = useState("");
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [isLoadingBirthDate, setIsLoadingBirthDate] = useState(true);
  const [isSavingBirthDate, setIsSavingBirthDate] = useState(false);
  const [birthDateError, setBirthDateError] = useState("");
  const [maxHeartRate, setMaxHeartRate] = useState(null);
  const [maxHeartRateSource, setMaxHeartRateSource] = useState(null);
  const [preferredMaxHeartRateSource, setPreferredMaxHeartRateSource] =
    useState(MAX_HEART_RATE_SOURCE_AUTO);
  const [manualMaxHeartRate, setManualMaxHeartRate] = useState(null);
  const [measuredMaxHeartRate, setMeasuredMaxHeartRate] = useState(null);
  const [maxHeartRateInput, setMaxHeartRateInput] = useState("");
  const [maxHeartRateModalVisible, setMaxHeartRateModalVisible] =
    useState(false);
  const [isSavingMaxHeartRate, setIsSavingMaxHeartRate] = useState(false);
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const iconSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const recordColor = theme.record;
  const birthDateDisplay = normalizeLocalDateString(birthDate);
  const calculatedAge = calculateAgeFromBirthDate(birthDate);
  const normalizedMaxHeartRateInput = normalizeMaxHeartRate(maxHeartRateInput);
  const maxHeartRateInputError =
    maxHeartRateInput.trim() && normalizedMaxHeartRateInput === null
      ? t("settings.workoutTypes.wholeNumberError", {
          min: MIN_MAX_HEART_RATE,
          max: MAX_MAX_HEART_RATE,
        })
      : "";
  const maxHeartRateSourceColor =
    maxHeartRateSource === "measured"
      ? recordColor
      : maxHeartRateSource === "manual"
        ? primaryColor
        : secondaryColor;
  // Shown when a manual value is in play - the chosen source uses it, or there
  // is none yet and Manual cannot be chosen until one exists.
  const showManualMaxHeartRateField =
    manualMaxHeartRate === null ||
    preferredMaxHeartRateSource === "manual" ||
    preferredMaxHeartRateSource === MAX_HEART_RATE_SOURCE_AUTO;

  const maxHeartRateSourceOptions = [
    {
      id: MAX_HEART_RATE_SOURCE_AUTO,
      title: t("settings.workoutTypes.sources.auto.title"),
      detail: t("settings.workoutTypes.sources.auto.detail"),
      available: true,
    },
    {
      id: "manual",
      title: t("settings.workoutTypes.sources.manual.title"),
      detail:
        manualMaxHeartRate === null
          ? t("settings.workoutTypes.sources.manual.missing")
          : t("settings.workoutTypes.bpm", { value: manualMaxHeartRate }),
      available: manualMaxHeartRate !== null,
    },
    {
      id: "calculated",
      title: t("settings.workoutTypes.sources.calculated.title"),
      detail:
        calculatedAge === null
          ? t("settings.workoutTypes.sources.calculated.missing")
          : t("settings.workoutTypes.sources.calculated.fromAge", {
              value: 220 - calculatedAge,
            }),
      available: calculatedAge !== null,
    },
    {
      id: "measured",
      title: t("settings.workoutTypes.sources.measured.title"),
      detail:
        measuredMaxHeartRate === null
          ? t("settings.workoutTypes.sources.measured.missing")
          : t("settings.workoutTypes.bpm", { value: measuredMaxHeartRate }),
      available: measuredMaxHeartRate !== null,
    },
  ];

  const applyRunProfileSettings = useCallback((profile) => {
    setBirthDate(profile.birthDate ?? "");
    setManualMaxHeartRate(profile.manualMaxHeartRate ?? null);
    setMeasuredMaxHeartRate(profile.measuredMaxHeartRate ?? null);
    setMaxHeartRate(profile.maxHeartRate ?? null);
    setMaxHeartRateSource(profile.maxHeartRateSource ?? null);
    setPreferredMaxHeartRateSource(
      profile.preferredMaxHeartRateSource ?? MAX_HEART_RATE_SOURCE_AUTO
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadBirthDate = async () => {
        if (!user?.id) {
          setBirthDate("");
          setBirthDateError(t("settings.workoutTypes.errors.signIn"));
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
                : t("settings.workoutTypes.errors.load")
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
    }, [applyRunProfileSettings, t, user])
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
        error instanceof Error
          ? error.message
          : t("settings.workoutTypes.errors.saveBirthDate")
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
          : t("settings.workoutTypes.errors.saveMaxHeartRate")
      );
    } finally {
      setIsSavingMaxHeartRate(false);
    }
  };

  const saveMaxHeartRateSource = async (preferredSource) => {
    if (
      isSavingMaxHeartRate ||
      preferredSource === preferredMaxHeartRateSource
    ) {
      return;
    }

    setIsSavingMaxHeartRate(true);
    setBirthDateError("");

    try {
      const profile = await socialService.updateOwnMaxHeartRateSource({
        user,
        preferredSource,
      });

      applyRunProfileSettings(profile);
    } catch (error) {
      setBirthDateError(
        error instanceof Error
          ? error.message
          : t("settings.workoutTypes.errors.saveSource")
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
            size={12}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            {t("settings.eyebrow")}
          </ThemedText>
          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {t("settings.workoutTypes.title")}
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
            <ThemedText style={styles.sectionEyebrow} setColor={primaryTextColor}>
              {t("settings.workoutTypes.availableEyebrow")}
            </ThemedText>
            <ThemedText style={styles.sectionTitle} setColor={titleColor}>
              {t("settings.workoutTypes.sectionTitle")}
            </ThemedText>
          </View>
          <ThemedText style={styles.sectionCount} setColor={quietText}>
            {t("settings.workoutTypes.typesCount", {
              count: RELEASED_WORKOUT_TYPES.length,
            })}
          </ThemedText>
        </View>

        <View style={styles.typeList}>
          {RELEASED_WORKOUT_TYPES.map((workoutType) => {
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
                      {t(`${workoutType.textKey}.category`)}
                    </ThemedText>
                    <ThemedText
                      style={styles.typeTitle}
                      setColor={titleColor}
                    >
                      {t(`${workoutType.textKey}.title`)}
                    </ThemedText>
                    <ThemedText style={styles.typeMetrics} setColor={quietText}>
                      {t(`${workoutType.textKey}.metrics`)}
                    </ThemedText>
                  </View>

                  <View
                    accessible
                    accessibilityLabel={t("settings.workoutTypes.available")}
                    style={styles.availableStatus}
                  >
                    <Feather
                      name="check-circle"
                      size={20}
                      color={accentColor}
                    />
                  </View>
                </View>

                {workoutType.id === "strength-training" ? (
                  <View
                    style={[styles.exerciseViewSettings, { borderTopColor: cardBorder }]}
                  >
                    <View style={styles.exerciseViewHeading}>
                      <View style={styles.typeSettingCopy}>
                        <Library width={20} height={20} color={titleColor} />
                        <ThemedText style={styles.typeSettingTitle} setColor={titleColor}>
                          {t("settings.workoutTypes.exerciseCards")}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.exerciseViewSubtitle} setColor={quietText}>
                        {t("settings.workoutTypes.exerciseCardsSubtitle")}
                      </ThemedText>
                    </View>

                    <ThemedText style={styles.exerciseViewPreviewLabel} setColor={quietText}>
                      {t("settings.workoutTypes.cardLayout")}
                    </ThemedText>
                    {EXERCISE_CARD_LAYOUT_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.82}
                        onPress={() => setCollapsedExerciseCardLayout(option.value)}
                        style={styles.exerciseViewOption}
                      >
                        <View
                          style={[
                            styles.exerciseViewRadio,
                            {
                              borderColor:
                                collapsedExerciseCardLayout === option.value
                                  ? primaryColor
                                  : quietText,
                            },
                          ]}
                        >
                          {collapsedExerciseCardLayout === option.value ? (
                            <View
                              style={[
                                styles.exerciseViewRadioDot,
                                { backgroundColor: primaryColor },
                              ]}
                            />
                          ) : null}
                        </View>
                        <View style={styles.exerciseViewOptionText}>
                          <ThemedText style={styles.exerciseViewOptionTitle} setColor={titleColor}>
                            {t(option.titleKey)}
                          </ThemedText>
                          <View
                            style={[
                              styles.exerciseViewOptionPreview,
                              { borderColor: cardBorder },
                            ]}
                          >
                            <LayoutOptionPreview
                              cardLayout={option.value}
                              view={collapsedExerciseView}
                              theme={theme}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}

                    <ThemedText style={styles.exerciseViewPreviewLabel} setColor={quietText}>
                      {t("settings.workoutTypes.setSummary")}
                    </ThemedText>
                    {EXERCISE_VIEW_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.82}
                        onPress={() => setCollapsedExerciseView(option.value)}
                        style={styles.exerciseViewOption}
                      >
                        <View
                          style={[
                            styles.exerciseViewRadio,
                            {
                              borderColor:
                                collapsedExerciseView === option.value
                                  ? primaryColor
                                  : quietText,
                            },
                          ]}
                        >
                          {collapsedExerciseView === option.value ? (
                            <View
                              style={[
                                styles.exerciseViewRadioDot,
                                { backgroundColor: primaryColor },
                              ]}
                            />
                          ) : null}
                        </View>
                        <View style={styles.exerciseViewOptionText}>
                          <ThemedText style={styles.exerciseViewOptionTitle} setColor={titleColor}>
                            {t(option.titleKey)}
                          </ThemedText>
                          <View
                            style={[
                              styles.exerciseViewOptionPreview,
                              { borderColor: cardBorder },
                            ]}
                          >
                            <LayoutOptionPreview
                              cardLayout="compact"
                              view={option.value}
                              theme={theme}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}

                    <ThemedText style={styles.exerciseViewPreviewLabel} setColor={quietText}>
                      {t("settings.workoutTypes.preview")}
                    </ThemedText>
                    <View
                      style={[
                        styles.exerciseViewPreview,
                        { backgroundColor: cardSurface, borderColor: cardBorder },
                      ]}
                    >
                      <View style={styles.exerciseViewPreviewHeader}>
                        <ThemedText style={styles.exerciseViewPreviewName} setColor={titleColor}>
                          {t("settings.workoutTypes.previewExercise")}
                        </ThemedText>
                        <ThemedText setColor={quietText}>● ★ ● ●</ThemedText>
                      </View>
                      <LayoutOptionPreview
                        cardLayout={collapsedExerciseCardLayout}
                        view={collapsedExerciseView}
                        theme={theme}
                      />
                    </View>
                  </View>
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
                          opacity:
                            isLoadingBirthDate ? 0.55 : 1,
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
                            {t("settings.workoutTypes.birthDate")}
                          </ThemedText>
                          <ThemedText
                            style={styles.typeSettingMeta}
                            setColor={quietText}
                          >
                            {birthDateDisplay
                              ? t("settings.workoutTypes.birthDateWithAge", {
                                  date: birthDateDisplay,
                                  age: calculatedAge,
                                })
                              : t("settings.workoutTypes.setBirthDate")}
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
                      disabled={
                        isLoadingBirthDate ||
                        isSavingMaxHeartRate
                      }
                      onPress={openMaxHeartRateModal}
                      style={[
                        styles.typeSettingRow,
                        {
                          borderTopColor: cardBorder,
                          opacity:
                            isLoadingBirthDate ? 0.55 : 1,
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
                            {t("settings.workoutTypes.maxHeartRate")}
                          </ThemedText>
                          <ThemedText
                            style={styles.typeSettingMeta}
                            setColor={quietText}
                          >
                            {maxHeartRate === null
                              ? t("settings.workoutTypes.maxHeartRateEmpty")
                              : t("settings.workoutTypes.bpm", {
                                  value: maxHeartRate,
                                })}
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
                            {MAX_HEART_RATE_SOURCE_KEYS.includes(maxHeartRateSource)
                              ? t(
                                  `settings.workoutTypes.sources.${maxHeartRateSource}.title`
                                )
                              : maxHeartRateSource}
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
        title={t("settings.workoutTypes.birthDatePickerTitle")}
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
        title={t("settings.workoutTypes.maxHeartRate")}
        dismissOnBackdropPress={!isSavingMaxHeartRate}
        onClose={() => {
          if (!isSavingMaxHeartRate) {
            setMaxHeartRateModalVisible(false);
          }
        }}
      >
        <ThemedText style={styles.modalSectionLabel} setColor={quietText}>
          {t("settings.workoutTypes.howWorkedOut")}
        </ThemedText>

        <View style={styles.maxHeartRateSourceList}>
          {maxHeartRateSourceOptions.map((option) => {
            const isSelected =
              option.id === preferredMaxHeartRateSource;

            return (
              <TouchableOpacity
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: isSelected,
                  disabled: !option.available,
                }}
                activeOpacity={0.75}
                disabled={!option.available || isSavingMaxHeartRate}
                onPress={() => saveMaxHeartRateSource(option.id)}
                style={[
                  styles.maxHeartRateSourceOption,
                  {
                    backgroundColor: iconSurface,
                    borderColor: isSelected ? primaryColor : cardBorder,
                    opacity: option.available ? 1 : 0.45,
                  },
                ]}
              >
                <View style={styles.maxHeartRateSourceOptionCopy}>
                  <ThemedText
                    style={styles.maxHeartRateSourceOptionTitle}
                    setColor={isSelected ? primaryColor : titleColor}
                  >
                    {option.title}
                  </ThemedText>
                  <ThemedText
                    style={styles.maxHeartRateSourceOptionDetail}
                    setColor={quietText}
                  >
                    {option.detail}
                  </ThemedText>
                </View>
                <Feather
                  name={isSelected ? "check-circle" : "circle"}
                  size={18}
                  color={isSelected ? primaryColor : quietText}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        {showManualMaxHeartRateField ? (
          <>
            <ThemedText style={styles.modalSectionLabel} setColor={quietText}>
              {t("settings.workoutTypes.manualValue")}
            </ThemedText>

            <ThemedTextInput
              value={maxHeartRateInput}
              onChangeText={(value) =>
                setMaxHeartRateInput(value.replace(/[^0-9]/g, "").slice(0, 3))
              }
              placeholder={
                maxHeartRate === null
                  ? t("settings.workoutTypes.maxBpmPlaceholder")
                  : t("settings.workoutTypes.currentBpmPlaceholder", {
                      value: maxHeartRate,
                    })
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
                  {t("settings.workoutTypes.clearManualValue")}
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            <View style={styles.modalActions}>
              <ThemedButton
                title={t("common.cancel")}
                variant="secondary"
                disabled={isSavingMaxHeartRate}
                onPress={() => setMaxHeartRateModalVisible(false)}
                style={styles.modalAction}
              />
              <ThemedButton
                title={
                  isSavingMaxHeartRate
                    ? t("settings.workoutTypes.saving")
                    : t("common.save")
                }
                disabled={
                  isSavingMaxHeartRate ||
                  !maxHeartRateInput.trim() ||
                  Boolean(maxHeartRateInputError)
                }
                onPress={() => saveManualMaxHeartRate()}
                style={styles.modalAction}
              />
            </View>
          </>
        ) : (
          // Nothing to save here: the source choice is written the moment it is
          // tapped, so a Save button would sit permanently disabled.
          <ThemedButton
            title={t("common.done")}
            variant="secondary"
            disabled={isSavingMaxHeartRate}
            onPress={() => setMaxHeartRateModalVisible(false)}
            fullWidth
          />
        )}
      </ThemedModal>
    </ThemedView>
  );
}
