import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { Colors } from "../GlobalStyling/colors";
import Calender from "../Icons/UI-icons/Calender";
import Checkmark from "../Icons/UI-icons/Checkmark";
import Cross from "../Icons/UI-icons/Cross";
import Library from "../Icons/UI-icons/Library";
import { ThemedModal, ThemedText } from "../ThemedComponents";

const SINGLE_WORKOUT_KEY = "single-workout";
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getTargetKey(target) {
  return `program-${target?.program_id ?? "unknown"}-${target?.day_id ?? "day"}`;
}

function colorWithAlpha(color, alpha, fallback) {
  if (typeof color !== "string") {
    return fallback;
  }

  const hexMatch = color.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);

  if (hexMatch) {
    const hex = hexMatch[1];
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgbMatch = color
    .trim()
    .match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/i);

  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return fallback;
}

function parseLocalDate(dateLabel) {
  if (typeof dateLabel !== "string") {
    return null;
  }

  const [day, month, year] = dateLabel.split(".").map(Number);

  if (!day || !month || !year) {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatConflictDate(dateLabel) {
  const parsedDate = parseLocalDate(dateLabel);

  if (!parsedDate) {
    return dateLabel || "This date";
  }

  return `${SHORT_WEEKDAYS[parsedDate.getDay()]} ${String(
    parsedDate.getDate()
  ).padStart(2, "0")} ${SHORT_MONTHS[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
}

function getBlockWeekLabel(target) {
  return [
    target?.mesocycle_number ? `Block ${target.mesocycle_number}` : null,
    target?.microcycle_number ? `Week ${target.microcycle_number}` : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function getProgramSubtitle(target) {
  const dayLabel = [target?.weekday, target?.date].filter(Boolean).join(" ");
  return [dayLabel, target?.program_name].filter(Boolean).join(" - ");
}

function getProgramMeta(target) {
  const blockWeek = getBlockWeekLabel(target);
  return blockWeek ? blockWeek.toUpperCase() : "PROGRAM";
}

function WorkoutCopyTargetModal({
  visible,
  dateLabel,
  programTargets = [],
  isSubmitting = false,
  onClose,
  onConfirmProgramTarget,
  onConfirmSingleWorkout,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [selectedKey, setSelectedKey] = useState(SINGLE_WORKOUT_KEY);
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const mutedText = theme.iconColor ?? quietText;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const warningColor = theme.planned ?? "#ffdd00";
  const fieldSurface = theme.fields ?? theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const confirmTextColor = theme.textInverted ?? theme.background ?? "#0E0F12";
  const primarySoft = colorWithAlpha(primaryColor, 0.14, fieldSurface);
  const secondarySoft = colorWithAlpha(secondaryColor, 0.14, fieldSurface);
  const selectedProgramTarget = useMemo(
    () => programTargets.find((target) => getTargetKey(target) === selectedKey),
    [programTargets, selectedKey]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSelectedKey(
      programTargets[0] ? getTargetKey(programTargets[0]) : SINGLE_WORKOUT_KEY
    );
  }, [programTargets, visible]);

  const handleConfirm = () => {
    if (isSubmitting) {
      return;
    }

    if (selectedKey === SINGLE_WORKOUT_KEY) {
      onConfirmSingleWorkout?.();
      return;
    }

    if (selectedProgramTarget) {
      onConfirmProgramTarget?.(selectedProgramTarget);
    }
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={onClose}
      dismissOnBackdropPress={!isSubmitting}
      style={[
        styles.modal,
        {
          backgroundColor: theme.cardBackground ?? theme.background,
          borderColor: cardBorder,
        },
      ]}
      contentStyle={styles.modalBody}
    >
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={[styles.warningBadge, { backgroundColor: fieldSurface }]}>
          <ThemedText style={styles.warningIcon} setColor={warningColor}>
            !
          </ThemedText>
        </View>

        <View style={styles.headerText}>
          <ThemedText style={styles.eyebrow} setColor={warningColor}>
            DATE CONFLICT
          </ThemedText>
          <ThemedText style={styles.title} setColor={titleColor}>
            Where should this workout live?
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={isSubmitting}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Cross width={28} height={28} color={mutedText} />
        </Pressable>
      </View>

      <View
        style={[
          styles.conflictRow,
          { backgroundColor: fieldSurface, borderColor: cardBorder },
        ]}
      >
        <Calender width={18} height={18} color={mutedText} />
        <ThemedText style={styles.conflictText} setColor={titleColor}>
          {formatConflictDate(dateLabel)} already has a program session scheduled.
        </ThemedText>
      </View>

      <ScrollView
        style={styles.optionScroll}
        contentContainerStyle={styles.optionList}
        showsVerticalScrollIndicator={false}
      >
        {programTargets.map((target, index) => {
          const targetKey = getTargetKey(target);
          const selected = selectedKey === targetKey;

          return (
            <TouchableOpacity
              key={targetKey}
              activeOpacity={0.82}
              disabled={isSubmitting}
              onPress={() => setSelectedKey(targetKey)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: fieldSurface,
                  borderColor: selected ? primaryColor : cardBorder,
                  opacity: isSubmitting ? 0.62 : 1,
                },
                selected && styles.selectedCard,
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: primarySoft },
                ]}
              >
                <Library width={22} height={22} color={primaryColor} />
              </View>

              <View style={styles.optionText}>
                <View style={styles.optionEyebrowRow}>
                  <ThemedText style={styles.optionEyebrow} setColor={primaryColor}>
                    {getProgramMeta(target)}
                  </ThemedText>
                  {index === 0 ? (
                    <View
                      style={[
                        styles.recommendedPill,
                        { backgroundColor: primarySoft },
                      ]}
                    >
                      <ThemedText
                        style={styles.recommendedText}
                        setColor={primaryColor}
                      >
                        RECOMMENDED
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={styles.optionTitle} setColor={titleColor}>
                  Add to program
                </ThemedText>
                <ThemedText style={styles.optionSubtitle} setColor={mutedText}>
                  {getProgramSubtitle(target)}
                </ThemedText>
                <ThemedText style={styles.optionDescription} setColor={quietText}>
                  Keeps your plan intact and tracks volume.
                </ThemedText>
              </View>

              <View
                style={[
                  styles.selectControl,
                  {
                    borderColor: selected ? primaryColor : cardBorder,
                    backgroundColor: selected ? primaryColor : "transparent",
                  },
                ]}
              >
                {selected ? (
                  <Checkmark
                    width={18}
                    height={18}
                    color={confirmTextColor}
                    thickness={2.4}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          activeOpacity={0.82}
          disabled={isSubmitting}
          onPress={() => setSelectedKey(SINGLE_WORKOUT_KEY)}
          style={[
            styles.optionCard,
            {
              backgroundColor: fieldSurface,
              borderColor:
                selectedKey === SINGLE_WORKOUT_KEY ? secondaryColor : cardBorder,
              opacity: isSubmitting ? 0.62 : 1,
            },
            selectedKey === SINGLE_WORKOUT_KEY && styles.selectedCard,
          ]}
        >
          <View
            style={[
              styles.optionIcon,
              { backgroundColor: secondarySoft },
            ]}
          >
            <Calender width={22} height={22} color={secondaryColor} />
          </View>

          <View style={styles.optionText}>
            <ThemedText style={styles.optionEyebrow} setColor={secondaryColor}>
              STANDALONE
            </ThemedText>
            <ThemedText style={styles.optionTitle} setColor={titleColor}>
              Single workout
            </ThemedText>
            <ThemedText style={styles.optionSubtitle} setColor={mutedText}>
              Lives only in the calendar.
            </ThemedText>
            <ThemedText style={styles.optionDescription} setColor={quietText}>
              Won't affect program progression.
            </ThemedText>
          </View>

          <View
            style={[
              styles.selectControl,
              {
                borderColor:
                  selectedKey === SINGLE_WORKOUT_KEY ? secondaryColor : cardBorder,
                backgroundColor:
                  selectedKey === SINGLE_WORKOUT_KEY
                    ? secondaryColor
                    : "transparent",
              },
            ]}
          >
            {selectedKey === SINGLE_WORKOUT_KEY ? (
              <Checkmark
                width={18}
                height={18}
                color={confirmTextColor}
                thickness={2.4}
              />
            ) : null}
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: cardBorder }]}>
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={onClose}
          style={[
            styles.cancelButton,
            { borderColor: cardBorder, opacity: isSubmitting ? 0.62 : 1 },
          ]}
        >
          <ThemedText style={styles.cancelText} setColor={mutedText}>
            CANCEL
          </ThemedText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleConfirm}
          style={[
            styles.confirmButton,
            {
              backgroundColor: primaryColor,
              opacity: isSubmitting ? 0.62 : 1,
            },
          ]}
        >
          <ThemedText
            style={styles.confirmText}
            setColor={confirmTextColor}
          >
            CONFIRM &gt;
          </ThemedText>
        </Pressable>
      </View>
    </ThemedModal>
  );
}

export default WorkoutCopyTargetModal;

const styles = StyleSheet.create({
  modal: {
    width: "92%",
    maxHeight: "86%",
    borderRadius: 28,
    borderWidth: 1,
    padding: 0,
    paddingBottom: 0,
  },
  modalBody: {
    gap: 0,
    flexGrow: 0,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    gap: 12,
  },
  warningBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  warningIcon: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
    paddingTop: 2,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 3,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
  },
  closeButton: {
    marginTop: -2,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  conflictRow: {
    minHeight: 48,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  conflictText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  optionScroll: {
    flexShrink: 1,
    maxHeight: 330,
  },
  optionList: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  optionCard: {
    minHeight: 116,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  selectedCard: {
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  optionEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  recommendedPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  recommendedText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  optionTitle: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  optionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  optionDescription: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  selectControl: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    minHeight: 50,
    flex: 0.38,
    borderWidth: 1,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  confirmButton: {
    minHeight: 50,
    flex: 0.62,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
});
