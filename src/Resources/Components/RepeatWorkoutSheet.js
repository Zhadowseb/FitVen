import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import ArrowLeft from "../Icons/UI-icons/ArrowLeft";
import ChevronRight from "../Icons/UI-icons/ChevronRight";
import Cross from "../Icons/UI-icons/Cross";
import ReplayHistory from "../Icons/UI-icons/ReplayHistory";
import Calender from "../Icons/UI-icons/Calender";
import { programService } from "../../Services";

const noop = () => {};

const STEPS = ["program", "block", "week", "day"];

const STEP_LABELS = {
  program: "Choose a program",
  block: "Choose a block",
  week: "Choose a week",
  day: "Choose a day",
};

function formatDayDate(date) {
  if (typeof date !== "string" || date.length < 8) {
    return "";
  }

  return date;
}

export default function RepeatWorkoutSheet({
  visible,
  workout = null,
  isWorking = false,
  onClose = noop,
  onStart = noop,
  onPlan = noop,
}) {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState("choice");
  const [step, setStep] = useState("program");
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [selection, setSelection] = useState({
    program: null,
    block: null,
    week: null,
  });

  // Every open starts from the two-button choice again.
  useEffect(() => {
    if (visible) {
      setMode("choice");
      setStep("program");
      setOptions([]);
      setSelection({ program: null, block: null, week: null });
    }
  }, [visible]);

  const loadOptions = useCallback(
    async (nextStep, nextSelection) => {
      try {
        setIsLoading(true);

        if (nextStep === "program") {
          setOptions(await programService.getProgramOptions(db));
          return;
        }

        if (nextStep === "block") {
          setOptions(
            await programService.getMesocycleOptions(
              db,
              nextSelection.program.program_id
            )
          );
          return;
        }

        if (nextStep === "week") {
          const weeks = await programService.getMicrocyclesByMesocycle(
            db,
            nextSelection.block.mesocycle_id
          );
          setOptions(
            [...weeks].sort(
              (left, right) => left.microcycle_number - right.microcycle_number
            )
          );
          return;
        }

        const days = await programService.getDaysByMicrocycle(
          db,
          nextSelection.week.microcycle_id
        );
        setOptions(days);
      } catch (error) {
        console.error("Failed to load repeat targets:", error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [db]
  );

  const handleChoosePlan = () => {
    setMode("plan");
    setStep("program");
    loadOptions("program", selection);
  };

  const handleSelectOption = (option) => {
    if (step === "program") {
      const nextSelection = { program: option, block: null, week: null };
      setSelection(nextSelection);
      setStep("block");
      loadOptions("block", nextSelection);
      return;
    }

    if (step === "block") {
      const nextSelection = { ...selection, block: option, week: null };
      setSelection(nextSelection);
      setStep("week");
      loadOptions("week", nextSelection);
      return;
    }

    if (step === "week") {
      const nextSelection = { ...selection, week: option };
      setSelection(nextSelection);
      setStep("day");
      loadOptions("day", nextSelection);
      return;
    }

    onPlan({
      dayId: option.day_id,
      date: option.date,
      weekday: option.Weekday,
      programId: selection.program?.program_id ?? null,
      programName: selection.program?.program_name ?? null,
    });
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(step);

    if (currentIndex <= 0) {
      setMode("choice");
      return;
    }

    const previousStep = STEPS[currentIndex - 1];
    setStep(previousStep);
    loadOptions(previousStep, selection);
  };

  const getOptionLabel = (option) => {
    if (step === "program") {
      return option.program_name ?? "Untitled program";
    }

    if (step === "block") {
      return `Block ${option.mesocycle_number}`;
    }

    if (step === "week") {
      return `Week ${option.microcycle_number}`;
    }

    return option.Weekday ?? "Day";
  };

  const getOptionDetail = (option) => {
    if (step === "program") {
      return option.status === "ACTIVE" ? "Active" : option.status ?? "";
    }

    if (step === "block") {
      return option.focus ?? `${option.weeks ?? "?"} weeks`;
    }

    if (step === "week") {
      return option.focus ?? "";
    }

    return formatDayDate(option.date);
  };

  const styles = createStyles(theme);
  const breadcrumb = [
    selection.program?.program_name,
    selection.block ? `Block ${selection.block.mesocycle_number}` : null,
    selection.week ? `Week ${selection.week.microcycle_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            {mode === "plan" ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={handleBack}
                style={styles.headerButton}
              >
                <ArrowLeft width={18} height={18} color={theme.quietText} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerButton} />
            )}

            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow} numberOfLines={1}>
                {workout?.label ?? "Workout"}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {mode === "choice" ? "Repeat workout" : STEP_LABELS[step]}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.headerButton}
            >
              <Cross width={17} height={17} color={theme.quietText} />
            </TouchableOpacity>
          </View>

          {mode === "choice" ? (
            <View style={styles.choiceBlock}>
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                disabled={isWorking}
                onPress={onStart}
                style={[styles.choiceCard, styles.choiceCardPrimary]}
              >
                <View style={styles.choiceIcon}>
                  <ReplayHistory width={18} height={18} color={primaryTextColor} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>Start</Text>
                  <Text style={styles.choiceSubtitle}>
                    Copy it to today and open it right away.
                  </Text>
                </View>
                {isWorking ? (
                  <ActivityIndicator color={primaryTextColor} />
                ) : (
                  <ChevronRight
                    width={17}
                    height={17}
                    color={theme.quietText}
                    thickness={2}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                disabled={isWorking}
                onPress={handleChoosePlan}
                style={styles.choiceCard}
              >
                <View style={styles.choiceIcon}>
                  <Calender width={18} height={18} color={theme.quietText} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>Plan</Text>
                  <Text style={styles.choiceSubtitle}>
                    Pick a program, block, week and day.
                  </Text>
                </View>
                <ChevronRight
                  width={17}
                  height={17}
                  color={theme.quietText}
                  thickness={2}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.optionBlock}>
              {breadcrumb ? (
                <Text style={styles.breadcrumb} numberOfLines={1}>
                  {breadcrumb}
                </Text>
              ) : null}

              {isLoading ? (
                <View style={styles.stateBlock}>
                  <ActivityIndicator color={primaryTextColor} />
                </View>
              ) : options.length > 0 ? (
                <ScrollView
                  style={styles.optionList}
                  contentContainerStyle={styles.optionListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {options.map((option, index) => {
                    const detail = getOptionDetail(option);

                    return (
                      <TouchableOpacity
                        key={`${step}-${index}`}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        disabled={isWorking}
                        onPress={() => handleSelectOption(option)}
                        style={styles.optionRow}
                      >
                        <View style={styles.choiceCopy}>
                          <Text style={styles.optionTitle} numberOfLines={1}>
                            {getOptionLabel(option)}
                          </Text>
                          {detail ? (
                            <Text style={styles.optionDetail} numberOfLines={1}>
                              {detail}
                            </Text>
                          ) : null}
                        </View>
                        <ChevronRight
                          width={16}
                          height={16}
                          color={theme.quietText}
                          thickness={2}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.stateBlock}>
                  <Text style={styles.optionDetail}>
                    Nothing to choose from here.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  const sheetBackground = theme.cardBackground ?? theme.background;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.62)",
    },
    sheet: {
      width: "100%",
      maxHeight: "86%",
      backgroundColor: sheetBackground,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
      paddingTop: 18,
      paddingHorizontal: 18,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: withAlpha(theme.text, 0.28),
      marginBottom: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 16,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 2,
    },
    eyebrow: {
      color: theme.quietText,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    title: {
      color: theme.title,
      fontSize: 17,
      fontWeight: "900",
    },
    choiceBlock: {
      gap: 10,
      paddingBottom: 6,
    },
    choiceCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.background,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    choiceCardPrimary: {
      borderColor: withAlpha(theme.primary, 0.45),
      backgroundColor: withAlpha(theme.primary, 0.1),
    },
    choiceIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.chipBackground,
    },
    choiceCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    choiceTitle: {
      color: theme.title,
      fontSize: 15,
      fontWeight: "800",
    },
    choiceSubtitle: {
      color: theme.quietText,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },
    optionBlock: {
      gap: 10,
    },
    breadcrumb: {
      color: theme.quietText,
      fontSize: 11,
      fontWeight: "700",
    },
    optionList: {
      maxHeight: 380,
    },
    optionListContent: {
      gap: 8,
      paddingBottom: 4,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.background,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    optionTitle: {
      color: theme.title,
      fontSize: 13,
      fontWeight: "800",
    },
    optionDetail: {
      color: theme.quietText,
      fontSize: 11,
      fontWeight: "600",
    },
    stateBlock: {
      paddingVertical: 28,
      alignItems: "center",
    },
  });
}
