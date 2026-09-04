import React, { useMemo } from "react";
import {
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

import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import ThemedSheetHandle from "../../../../Resources/ThemedComponents/ThemedSheetHandle";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import Cross from "../../../../Resources/Icons/UI-icons/Cross";
import Filter from "../../../../Resources/Icons/UI-icons/Filter";
import { EXERCISE_MUSCLE_GROUPS } from "../../../../Utils/exerciseMuscleGroups";

const GROUP_FILTERS = [
  { key: "all", label: "All" },
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "legs", label: "Legs" },
  { key: "core", label: "Core" },
  { key: "mobility", label: "Mobility" },
];

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "builtin", label: "Built-in" },
  { key: "custom", label: "Custom" },
];

const MUSCLE_GROUP_SECTIONS = [
  { key: "push", label: "Push" },
  { key: "pull", label: "Pull" },
  { key: "legs", label: "Legs" },
  { key: "core", label: "Core" },
];

function getFocusColor(sectionKey, theme) {
  if (sectionKey === "pull") {
    return theme.record;
  }

  if (sectionKey === "legs") {
    return theme.secondary;
  }

  if (sectionKey === "core") {
    return theme.planned;
  }

  return theme.primaryText;
}

function SectionLabel({ children, meta, styles }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

export default function ExerciseFilterSheet({
  visible,
  onClose,
  selectedGroupKey,
  onChangeGroupKey,
  selectedMuscleKeys,
  onToggleMuscleKey,
  exerciseTypeFilter,
  onChangeExerciseTypeFilter,
  resultCount,
  onReset,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedMuscleSet = useMemo(
    () => new Set(Array.isArray(selectedMuscleKeys) ? selectedMuscleKeys : []),
    [selectedMuscleKeys]
  );
  const selectedMuscleCount = selectedMuscleSet.has("all")
    ? 0
    : selectedMuscleSet.size;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(insets.top, 10) + 12,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <ThemedSheetHandle style={styles.handle} />

          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Close exercise filters"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Cross width={19} height={19} color={theme.quietText} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Filter width={19} height={19} color={theme.primaryText} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>REFINE</Text>
                <Text style={styles.title}>Filter exercises</Text>
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel styles={styles}>Training focus</SectionLabel>
              <View style={styles.chipWrap}>
                {GROUP_FILTERS.map((filter) => {
                  const isSelected = selectedGroupKey === filter.key;

                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => onChangeGroupKey(filter.key)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? withAlpha(theme.primary, 0.14)
                            : theme.background,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? theme.primaryText : theme.text,
                          },
                          isSelected ? styles.chipTextActive : null,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel
                styles={styles}
                meta={`${selectedMuscleCount} selected`}
              >
                Muscle groups
              </SectionLabel>

              <View style={styles.muscleSections}>
                {MUSCLE_GROUP_SECTIONS.map((section) => {
                  const sectionColor = getFocusColor(section.key, theme);
                  const muscleGroups = EXERCISE_MUSCLE_GROUPS.filter(
                    (group) => group.trainingGroupKey === section.key
                  );

                  return (
                    <View key={section.key} style={styles.muscleSection}>
                      <Text style={[styles.muscleSectionLabel, { color: sectionColor }]}>
                        {section.label}
                      </Text>
                      <View style={styles.chipWrap}>
                        {muscleGroups.map((group) => {
                          const isSelected = selectedMuscleSet.has(group.key);

                          return (
                            <Pressable
                              key={group.key}
                              onPress={() => onToggleMuscleKey(group.key)}
                              style={[
                                styles.chip,
                                styles.muscleChip,
                                {
                                  backgroundColor: isSelected
                                    ? withAlpha(sectionColor, 0.15)
                                    : theme.background,
                                  borderColor: isSelected
                                    ? sectionColor
                                    : theme.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color: isSelected
                                      ? sectionColor
                                      : theme.text,
                                  },
                                  isSelected ? styles.chipTextActive : null,
                                ]}
                              >
                                {group.label}
                              </Text>
                              {isSelected ? (
                                <Checkmark
                                  width={13}
                                  height={13}
                                  color={sectionColor}
                                  thickness={2}
                                />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel styles={styles}>Exercise type</SectionLabel>
              <View style={styles.segmentControl}>
                {TYPE_FILTERS.map((filter) => {
                  const isSelected = exerciseTypeFilter === filter.key;

                  return (
                    <Pressable
                      key={filter.key}
                      onPress={() => onChangeExerciseTypeFilter(filter.key)}
                      style={[
                        styles.segment,
                        isSelected ? styles.segmentActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: isSelected ? theme.textInverted : theme.text,
                          },
                          isSelected ? styles.segmentTextActive : null,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityRole="button"
              onPress={onReset}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              onPress={onClose}
              style={styles.showButton}
            >
              <Text style={styles.showButtonText}>
                Show {resultCount} exercises
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: theme.sheetScrim,
    },
    sheet: {
      width: "100%",
      maxHeight: "92%",
      backgroundColor: theme.cardBackground,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: "hidden",
    },
    handle: {
      position: "absolute",
      top: 14,
    },
    closeButton: {
      position: "absolute",
      top: 24,
      right: 22,
      width: 40,
      height: 40,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      zIndex: 2,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 18,
      gap: 22,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingRight: 46,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(theme.primary, 0.14),
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      color: theme.primaryText,
      fontSize: 11,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 2,
    },
    title: {
      color: theme.title,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "900",
    },
    section: {
      gap: 11,
    },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionLabel: {
      color: theme.text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    sectionMeta: {
      color: theme.primaryText,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      minHeight: 34,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    muscleChip: {
      paddingHorizontal: 12,
    },
    chipText: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "700",
    },
    chipTextActive: {
      fontWeight: "900",
    },
    muscleSections: {
      gap: 16,
    },
    muscleSection: {
      gap: 8,
    },
    muscleSectionLabel: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    segmentControl: {
      flexDirection: "row",
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    segment: {
      flex: 1,
      minHeight: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: {
      backgroundColor: theme.primary,
    },
    segmentText: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "800",
    },
    segmentTextActive: {
      fontWeight: "900",
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
      backgroundColor: theme.cardBackground,
    },
    resetButton: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    resetButtonText: {
      color: theme.text,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: "900",
    },
    showButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    showButtonText: {
      color: theme.textInverted,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
  });
}
