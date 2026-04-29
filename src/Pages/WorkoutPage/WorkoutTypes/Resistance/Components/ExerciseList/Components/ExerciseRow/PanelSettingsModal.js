import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../../../../../Resources/GlobalStyling/colors";

import {
  ThemedButton,
  ThemedCard,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../../../../../../../Resources/ThemedComponents";

export default function PanelSettingsModal({
  visible,
  onClose,
  onDelete,
  currentColumns,
  currentNote,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [columns, setColumns] = useState(currentColumns);
  const [note, setNote] = useState(currentNote ?? "");

  useEffect(() => {
    if (visible) {
      setColumns(currentColumns);
      setNote(currentNote ?? "");
    }
  }, [visible, currentColumns, currentNote]);

  const columnConfig = [
    { key: "note", label: "Note" },
    { key: "rest", label: "Rest" },
    { key: "set", label: "Set" },
    { key: "reps", label: "Reps" },
    { key: "rpe", label: "RPE" },
    { key: "rm_percentage", label: "1RM %" },
    { key: "weight", label: "Weight" },
    { key: "done", label: "Done" },
  ];

  const toggleColumn = (key) => {
    setColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleClose = () => {
    onClose({
      columns,
      note,
    });
  };

  return (
    <ThemedModal
      style={{ maxHeight: 520 }}
      visible={visible}
      onClose={handleClose}
      title="Exercise Settings"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <ThemedText size={12} setColor={theme.quietText}>
            Visible columns
          </ThemedText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {columnConfig.map((col) => {
              const isActive = columns[col.key];

              return (
                <TouchableOpacity
                  key={col.key}
                  onPress={() => toggleColumn(col.key)}
                >
                  <ThemedCard
                    style={[
                      styles.columnChip,
                      {
                        backgroundColor: isActive
                          ? theme.secondary
                          : theme.cardBackground,
                        borderWidth: 1,
                        borderColor: isActive
                          ? theme.cardBackground
                          : theme.secondary,
                      },
                    ]}
                  >
                    <ThemedText
                      textcolor={isActive ? theme.background : theme.text}
                      size={10}
                    >
                      {col.label}
                    </ThemedText>
                  </ThemedCard>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <ThemedText size={12} setColor={theme.quietText}>
            Exercise note
          </ThemedText>

          <ThemedTextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add note"
            multiline
            inputStyle={styles.noteInput}
          />
        </View>

        <View style={styles.deleteButtonContainer}>
          <ThemedButton
            title="Delete Exercise"
            variant="danger"
            style={{ width: 200 }}
            onPress={onDelete}
          />
        </View>
      </ScrollView>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  columnChip: {
    justifyContent: "center",
    alignItems: "center",
    width: 52,
    marginRight: 6,
    marginLeft: 0,
    borderRadius: 6,
    padding: 2,
    paddingTop: 10,
    paddingBottom: 10,
  },
  noteInput: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  deleteButtonContainer: {
    alignItems: "center",
    paddingTop: 8,
  },
});
