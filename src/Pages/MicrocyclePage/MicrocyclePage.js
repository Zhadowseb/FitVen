import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  View,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { Colors } from "../../Resources/GlobalStyling/colors";

import styles from "./MicrocyclePageStyle";
import MicrocycleList from "./Components/MicrocycleList/MicrocycleList";
import ThreeDots from "../../Resources/Icons/UI-icons/ThreeDots";
import PlusCircled from "../../Resources/Icons/UI-icons/PlusCircled";
import Delete from "../../Resources/Icons/UI-icons/Delete";

import {
  ThemedBottomSheet,
  ThemedView,
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedPicker,
  ThemedModal,
} from "../../Resources/ThemedComponents";

import {
  programService as programRepository,
  weightliftingService,
} from "../../Services";

const MicrocyclePage = ({ route }) => {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const {
    mesocycle_id,
    mesocycle_number,
    mesocycle_focus,
    program_id,
    period_start,
    period_end,
  } = route.params;
  const headerEyebrowColor = theme.quietText ?? theme.iconColor;
  const headerTitle = `Block ${mesocycle_number}`;

  const [refreshing, set_refreshing] = useState(0);
  const [OptionsBottomsheet_visible, set_OptionsBottomsheet_visible] =
    useState(false);
  const [focus, set_focus] = useState(mesocycle_focus);
  const [progressionModalVisible, setProgressionModalVisible] = useState(false);
  const [selectedProgressionExerciseName, setSelectedProgressionExerciseName] =
    useState(null);
  const [progressiveOverload, setProgressiveOverload] = useState({
    summary: "No 1 RM values yet.",
    progressions: [],
  });
  const [progressionUpdating, setProgressionUpdating] = useState(false);

  const updateUI = () => {
    set_refreshing((prev) => prev + 1);
  };

  const selectedProgression = progressiveOverload.progressions.find(
    (progression) =>
      progression.exercise_name === selectedProgressionExerciseName
  );

  useEffect(() => {
    const loadProgressiveOverload = async () => {
      try {
        const nextProgressiveOverload =
          await weightliftingService.getMesocycleProgressiveOverload(db, {
            mesocycleId: mesocycle_id,
            programId: program_id,
            mesocycleNumber: mesocycle_number,
          });

        setProgressiveOverload(nextProgressiveOverload);
        setSelectedProgressionExerciseName((currentSelection) => {
          if (
            currentSelection &&
            nextProgressiveOverload.progressions.some(
              (progression) =>
                progression.exercise_name === currentSelection
            )
          ) {
            return currentSelection;
          }

          return nextProgressiveOverload.progressions[0]?.exercise_name ?? null;
        });
      } catch (error) {
        console.error("Failed to load mesocycle progression:", error);
      }
    };

    loadProgressiveOverload();
  }, [db, mesocycle_id, mesocycle_number, program_id, refreshing]);

  const deleteMesocycle = async () => {
    try {
      await programRepository.deleteMesocycle(db, mesocycle_id);
    } catch (error) {
      console.error("deleteMesocycle failed:", error);
      throw error;
    }

    set_OptionsBottomsheet_visible(false);
    navigation.goBack();
  };

  const confirmDeleteMesocycle = () => {
    Alert.alert(
      "Delete mesocycle?",
      "This removes the block and all weeks and workouts inside it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete mesocycle",
          style: "destructive",
          onPress: () => {
            void deleteMesocycle();
          },
        },
      ]
    );
  };

  const updateFocus = async (nextFocus) => {
    try {
      await programRepository.updateMesocycleFocus(db, {
        mesocycleId: mesocycle_id,
        focus: nextFocus,
      });

      updateUI();
    } catch (error) {
      console.error("Error loading programs", error);
    }
  };

  const addExtraWeek = async () => {
    try {
      await programRepository.addWeekToMesocycle(db, {
        mesocycleId: mesocycle_id,
        programId: program_id,
      });

      updateUI();
      set_OptionsBottomsheet_visible(false);
    } catch (error) {
      console.error(error);
    }
  };

  const adjustProgression = async (delta) => {
    if (!selectedProgression?.exercise_name || progressionUpdating) {
      return;
    }

    try {
      setProgressionUpdating(true);
      await weightliftingService.adjustMesocycleProgressionByDelta(db, {
        programId: program_id,
        mesocycleId: mesocycle_id,
        exerciseName: selectedProgression.exercise_name,
        delta,
      });
      updateUI();
    } catch (error) {
      console.error("Failed to adjust progression:", error);
    } finally {
      setProgressionUpdating(false);
    }
  };

  return (
    <>
      <ThemedView safe={["top", "left", "right"]}>
        <ThemedHeader
          right={
            <TouchableOpacity
              onPress={() => {
                set_focus(mesocycle_focus);
                set_OptionsBottomsheet_visible(true);
              }}
            >
              <ThreeDots width={20} height={20} />
            </TouchableOpacity>
          }
        >
          <View style={styles.page_header_title_group}>
            <ThemedText
              size={10}
              style={[
                styles.page_header_title_eyebrow,
                { color: headerEyebrowColor },
              ]}
            >
              Block
            </ThemedText>

            <ThemedTitle
              type="h3"
              style={styles.page_header_title_main}
              numberOfLines={1}
            >
              {headerTitle}
            </ThemedTitle>
          </View>
        </ThemedHeader>

        <MicrocycleList
          program_id={program_id}
          mesocycle_id={mesocycle_id}
          period_start={period_start}
          period_end={period_end}
          refreshKey={refreshing}
          updateui={updateUI}
          headerComponent={
            <View style={styles.section_container}>
              <ThemedTitle type="h2">Progressive Overload</ThemedTitle>

              <View style={styles.progression_section}>
                {selectedProgression ? (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.progression_selector_scroll}
                      contentContainerStyle={styles.progression_selector_list}
                    >
                      {progressiveOverload.progressions.map((progression) => {
                        const isSelected =
                          progression.exercise_name ===
                          selectedProgressionExerciseName;

                        return (
                          <TouchableOpacity
                            key={progression.exercise_name}
                            activeOpacity={0.88}
                              style={[
                                styles.progression_selector_chip,
                                {
                                  borderColor:
                                    theme.cardBorder ?? theme.iconColor,
                                  backgroundColor: isSelected
                                    ? theme.secondary
                                    : theme.cardBackground,
                                },
                                isSelected && {
                                  borderColor: theme.secondary,
                                },
                            ]}
                            onPress={() => {
                              setSelectedProgressionExerciseName(
                                progression.exercise_name
                              );
                            }}
                            >
                              <ThemedText
                                style={styles.progression_selector_chip_text}
                                setColor={
                                  isSelected ? theme.cardBackground : undefined
                                }
                              >
                                {progression.exercise_name}
                              </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <TouchableOpacity
                      activeOpacity={0.88}
                        style={[
                          styles.progression_detail_box,
                          {
                            borderColor: theme.cardBorder ?? theme.iconColor,
                            backgroundColor: theme.cardBackground,
                          },
                        ]}
                      onPress={() => {
                        setProgressionModalVisible(true);
                      }}
                    >
                      {selectedProgression.is_base_mesocycle ? (
                            <View style={styles.progression_detail_row}>
                              <ThemedText
                                size={12}
                                style={styles.progression_detail_label}
                                setColor={theme.quietText}
                          >
                            1 RM
                          </ThemedText>
                          <ThemedText style={styles.progression_value}>
                            {selectedProgression.current_weight_display}
                          </ThemedText>
                        </View>
                      ) : (
                        <>
                          <View style={styles.progression_detail_row}>
                            <ThemedText
                              size={12}
                              style={styles.progression_detail_label}
                              setColor={theme.quietText}
                            >
                              Previous 1 RM
                            </ThemedText>
                              <ThemedText style={styles.progression_detail_value}>
                                {selectedProgression.previous_weight_display}
                              </ThemedText>
                            </View>

                            <View style={styles.progression_detail_row}>
                              <ThemedText
                                size={12}
                                style={styles.progression_detail_label}
                                setColor={theme.quietText}
                              >
                                This block
                              </ThemedText>
                              <ThemedText style={styles.progression_value}>
                                {selectedProgression.block_delta_display}
                              </ThemedText>
                            </View>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <ThemedText
                    size={12}
                    style={styles.progression_empty}
                    setColor={theme.quietText}
                  >
                    No 1 RM values yet.
                  </ThemedText>
                )}
              </View>

              <ThemedTitle type="h2" style={styles.weeks_title}>
                Weeks
              </ThemedTitle>
            </View>
          }
        />
      </ThemedView>

      <ThemedBottomSheet
        visible={OptionsBottomsheet_visible}
        onClose={() => set_OptionsBottomsheet_visible(false)}
      >
        <View style={styles.bottomsheet_title}>
          <ThemedTitle type={"h3"} style={{ flex: 10 }}>
            Mesocycle number: {mesocycle_number}
          </ThemedTitle>

          <View style={styles.focus}>
            <ThemedText> Change Focus </ThemedText>

            <ThemedPicker
              value={focus}
              onChange={(newFocus) => {
                set_focus(newFocus);
                updateFocus(newFocus);
              }}
              placeholder={focus}
              title="Select Week Focus"
              items={[
                "Strength",
                "Bodybuilding",
                "Technique",
                "Speed / Power",
                "Easy / Recovery",
                "Max Test",
              ]}
            />
          </View>
        </View>

        <View style={styles.bottomsheet_body}>
          <TouchableOpacity
            style={styles.option}
            onPress={async () => {
              addExtraWeek();
            }}
          >
            <PlusCircled width={24} height={24} />
            <ThemedText style={styles.option_text}>
              Add week to mesocycle.
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={confirmDeleteMesocycle}
          >
            <Delete width={24} height={24} />
            <ThemedText style={styles.option_text}>
              Delete mesocycle.
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>

      <ThemedModal
        visible={progressionModalVisible}
        onClose={() => {
          setProgressionModalVisible(false);
        }}
        title={selectedProgression?.exercise_name ?? "Progressive Overload"}
        style={styles.progression_modal}
      >
        <View
          style={[
            styles.progression_modal_card,
            {
              backgroundColor: theme.uiBackground,
              borderColor: theme.cardBorder ?? theme.iconColor,
            },
          ]}
        >
          <ThemedText
            size={11}
            style={styles.progression_modal_label}
            setColor={theme.quietText}
          >
            This block
          </ThemedText>

          <ThemedText size={32} style={styles.progression_modal_value}>
            {selectedProgression?.block_delta_display ?? "+0 kg"}
          </ThemedText>

          <ThemedText size={12} setColor={theme.quietText}>
            {selectedProgression?.is_base_mesocycle
              ? `1 RM: ${selectedProgression?.current_weight_display ?? "--"}`
              : `Previous 1 RM: ${selectedProgression?.previous_weight_display ?? "--"}`}
          </ThemedText>

          {!selectedProgression?.is_base_mesocycle && (
            <ThemedText size={12} setColor={theme.quietText}>
              Current 1 RM: {selectedProgression?.current_weight_display ?? "--"}
            </ThemedText>
          )}
        </View>

        <View style={styles.progression_pill}>
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={progressionUpdating}
            style={[
              styles.progression_pill_button,
              styles.progression_pill_button_left,
              {
                backgroundColor: theme.secondary,
                opacity: progressionUpdating ? 0.6 : 1,
              },
            ]}
            onPress={() => adjustProgression(2.5)}
          >
            <ThemedText
              style={styles.progression_pill_button_text}
              setColor={theme.cardBackground}
            >
              +2.5 kg
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={progressionUpdating}
            style={[
              styles.progression_pill_button,
              styles.progression_pill_button_right,
              {
                backgroundColor: theme.danger,
                opacity: progressionUpdating ? 0.6 : 1,
              },
            ]}
            onPress={() => adjustProgression(-2.5)}
          >
            <ThemedText
              style={styles.progression_pill_button_text}
              setColor={theme.cardBackground}
            >
              -2.5 kg
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedModal>
    </>
  );
};

export default MicrocyclePage;
