import React, { useState } from "react";
import { Pressable, View, useColorScheme } from "react-native";

import styles from "./AddProgramStyle";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import { getWeekStart } from "../../../../Utils/weekUtils";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";

export default function AddProgram({ visible, onClose, onSubmit }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [programName, setProgramName] = useState("");

  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const innerSurface =
    theme.fields ?? theme.cardBackground ?? theme.background;
  const accentColor = theme.primary ?? "#f7742e";
  const normalizedProgramName = programName.trim();
  const canCreate = normalizedProgramName.length > 0;

  const resetAndClose = () => {
    setProgramName("");
    onClose();
  };

  const handleSubmit = (status) => {
    if (!canCreate) {
      return;
    }

    onSubmit({
      program_name: normalizedProgramName,
      start_date: getWeekStart(new Date()),
      status,
    });
    setProgramName("");
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={resetAndClose}
      style={styles.modal}
      contentStyle={styles.content}
    >
      <View style={styles.hero}>
        <ThemedText style={styles.eyebrow} setColor={accentColor}>
          New program
        </ThemedText>

        <ThemedTitle type="h3" style={styles.title}>
          Create a training plan
        </ThemedTitle>

        <ThemedText style={styles.description} setColor={quietText}>
          Create a draft to plan it first, or start it immediately in the
          current week.
        </ThemedText>
      </View>

      <View style={styles.fieldGroup}>
        <ThemedText style={styles.label} setColor={quietText}>
          Program name
        </ThemedText>

        <ThemedTextInput
          placeholder="Example: Spring strength block"
          value={programName}
          onChangeText={setProgramName}
          inputStyle={[styles.input, { backgroundColor: innerSurface }]}
        />
      </View>

      <View style={styles.actions}>
        <ThemedButton
          title="Start now"
          variant="primary"
          disabled={!canCreate}
          onPress={() => handleSubmit("ACTIVE")}
          style={[styles.primaryAction, { backgroundColor: accentColor }]}
          fullWidth
        />

        <Pressable
          disabled={!canCreate}
          onPress={() => handleSubmit("NOT_STARTED")}
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              backgroundColor: innerSurface,
              borderColor: cardBorder,
              opacity: !canCreate ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText style={styles.secondaryActionText} setColor={titleColor}>
            Create draft
          </ThemedText>
        </Pressable>

        <Pressable onPress={resetAndClose} style={styles.cancelAction}>
          <ThemedText style={styles.cancelActionText} setColor={quietText}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>
    </ThemedModal>
  );
}
