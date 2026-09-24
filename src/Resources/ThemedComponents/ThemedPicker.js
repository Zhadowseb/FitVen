import { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";
import ChevronRight from "../Icons/UI-icons/ChevronRight";
import ThemedText from "./ThemedText";
import ThemedModal from "./ThemedModal";
import { useTranslation } from "@localization";

const ThemedPicker = ({
  value,
  items = [],
  onChange,
  placeholder,
  title,
  style,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const placeholderText = placeholder ?? t("common.picker.placeholder");
  const titleText = title ?? t("common.picker.title");
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  /**
   * Normalize items:
   * ["Deload"] -> { label: "Deload", value: "Deload" }
   */
  const normalizedItems = useMemo(
    () =>
      items.map(item =>
        typeof item === "string"
          ? { label: item, value: item }
          : item
      ),
    [items]
  );

  const selectedLabel =
    normalizedItems.find(i => i.value === value)?.label ?? placeholderText;

  return (
    <>
      {/* Closed state */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          {
            backgroundColor: theme.uiBackground,
            borderColor: theme.cardBorder,
          },
          style,
        ]}
      >
        <ThemedText style={styles.inputLabel} numberOfLines={1}>
          {selectedLabel}
        </ThemedText>

        {/* Rotated a quarter turn: this opens a list below, it does not
            navigate onwards. */}
        <View style={styles.inputChevron}>
          <ChevronRight
            width={14}
            height={14}
            color={theme.quietText ?? theme.iconColor}
            thickness={2.4}
          />
        </View>
      </Pressable>

      {/* Modal */}
      <ThemedModal
        visible={open}
        onClose={() => setOpen(false)}
        title={titleText}
      >
        <ScrollView style={styles.scrollview}>
          {normalizedItems.map(item => (
            <Pressable
              key={item.value}
              onPress={() => {
                onChange?.(item.value);
                setOpen(false);
              }}
              style={styles.option}
            >
              <ThemedText>{item.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </ThemedModal>
    </>
  );
};

export default ThemedPicker;


const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  inputLabel: {
    flexShrink: 1,
  },

  inputChevron: {
    transform: [{ rotate: "90deg" }],
  },

  option: {
    paddingVertical: 14,
  },

  scrollview: {
    maxHeight: 320,
  }
});
