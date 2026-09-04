import { useState } from "react";
import { Alert, View, TouchableOpacity, useColorScheme } from "react-native";
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
} from "../../Resources/ThemedComponents";

import { programService as programRepository } from "../../Services";

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
  const headerTitle = `Block ${mesocycle_number}`;

  const [refreshing, set_refreshing] = useState(0);
  const [OptionsBottomsheet_visible, set_OptionsBottomsheet_visible] =
    useState(false);
  const [focus, set_focus] = useState(mesocycle_focus);

  const updateUI = () => {
    set_refreshing((prev) => prev + 1);
  };

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
      "Delete block?",
      "This removes the block and all weeks and workouts inside it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete block",
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
            <ThemedTitle
              type="pageTitle"
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
        />
      </ThemedView>

      <ThemedBottomSheet
        visible={OptionsBottomsheet_visible}
        onClose={() => set_OptionsBottomsheet_visible(false)}
      >
        <View
          style={[styles.bottomsheet_title, { borderBottomColor: theme.hairline }]}
        >
          <ThemedTitle type={"h3"} style={{ flex: 10 }}>
            Block {mesocycle_number}
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
              title="Select block focus"
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
              Add week
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={confirmDeleteMesocycle}
          >
            <Delete width={24} height={24} />
            <ThemedText style={styles.option_text}>
              Delete block
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>

    </>
  );
};

export default MicrocyclePage;
