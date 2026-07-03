import {
  ActivityIndicator,
  Alert,
  View,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useState } from "react";
import { useSQLiteContext } from "expo-sqlite";

import ProgramList from './Components/ProgramList/ProgramList';
import AddProgram from './Components/AddProgram/AddProgram';
import { formatDate } from '../../Utils/dateUtils';
import { programService, programTransferService } from "../../Services";
import { Colors } from "../../Resources/GlobalStyling/colors";
import ThreeDots from "../../Resources/Icons/UI-icons/ThreeDots";
import PlusCircled from "../../Resources/Icons/UI-icons/PlusCircled";
import ArrowDown from "../../Resources/Icons/UI-icons/ArrowDown";

import {
  ThemedView,
  ThemedText,
  ThemedHeader,
  ThemedBottomSheet,
  ThemedTitle,
} from "../../Resources/ThemedComponents";

import styles from './ProgramPageStyle';


export default function App() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [addProgram_Visible, set_addProgram_Visible] = useState(false);
  const [refreshKey, set_refreshKey] = useState(0);
  const [optionsBottomSheetVisible, setOptionsBottomSheetVisible] = useState(false);
  const [isImportingProgram, setIsImportingProgram] = useState(false);

  const refresh = () => {
      set_refreshKey(prev => prev + 1);
  }

  //Add in a new program
  const handleAdd = async (data) => {
    try {
      await programService.createProgram(db, {
        programName: data.program_name,
        startDate: formatDate(data.start_date),
        status: data.status,
      });

      set_addProgram_Visible(false);
      refresh();
    } catch (error) {
      console.error(error);
    }
  };

  const handleImportProgram = async () => {
    if (isImportingProgram) {
      return;
    }

    try {
      setIsImportingProgram(true);
      const result = await programTransferService.importProgramFromFilePicker(db);

      if (result.canceled) {
        return;
      }

      refresh();
      programService.pushDirtyStrengthHierarchyWithCloud(db).catch((error) => {
        console.warn("Program import cloud sync failed:", error);
      });

      Alert.alert(
        "Program imported",
        `${result.programName} has been added to your programs.`
      );
    } catch (error) {
      console.error("Program import failed:", error);
      Alert.alert(
        "Import failed",
        error?.message ?? "The program file could not be imported."
      );
    } finally {
      setIsImportingProgram(false);
    }
  };

  return (
    <>
    <ThemedView safe={["top", "left", "right"]}>

      <ThemedHeader
        leftWidth={48}
        rightWidth={48}
        right={
          <View style={styles.header_actions}>
            <TouchableOpacity
              style={styles.header_menu_button}
              onPress={() => setOptionsBottomSheetVisible(true)}>
              <ThreeDots width={20} height={20} />
            </TouchableOpacity>
          </View>
        }>
        <ThemedText size={18}>Programs</ThemedText>
      </ThemedHeader>

      <ProgramList
        refreshKey={refreshKey}
        onCreateProgram={() => set_addProgram_Visible(true)}
      />

      <AddProgram 
        visible={addProgram_Visible}
        onClose={() => set_addProgram_Visible(false)}
        onSubmit={handleAdd}/>

    </ThemedView>

    <ThemedBottomSheet
      visible={optionsBottomSheetVisible}
      onClose={() => setOptionsBottomSheetVisible(false)}>

      <View style={styles.bottomsheet_title}>
        <ThemedTitle type="h3" style={{ flex: 10 }}>
          Program options
        </ThemedTitle>
      </View>

      <View style={styles.bottomsheet_body}>
        <TouchableOpacity
          style={[
            styles.option,
            isImportingProgram && styles.option_disabled,
          ]}
          disabled={isImportingProgram}
          onPress={() => {
            setOptionsBottomSheetVisible(false);
            handleImportProgram();
          }}>
          {isImportingProgram ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ArrowDown width={24} height={24} />
          )}
          <ThemedText style={styles.option_text}>
            {isImportingProgram ? "Importing program..." : "Import program"}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => {
            setOptionsBottomSheetVisible(false);
            set_addProgram_Visible(true);
          }}>
          <PlusCircled width={24} height={24} />
          <ThemedText style={styles.option_text}>
            Create new program.
          </ThemedText>
        </TouchableOpacity>
      </View>

    </ThemedBottomSheet>
    </>
  );
}
