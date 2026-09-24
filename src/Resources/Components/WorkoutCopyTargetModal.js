import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import Calender from "../Icons/UI-icons/Calender";
import Checkmark from "../Icons/UI-icons/Checkmark";
import Cross from "../Icons/UI-icons/Cross";
import Library from "../Icons/UI-icons/Library";
import {
  ThemedModal,
  ThemedSheetHandle,
  ThemedText,
} from "../ThemedComponents";
import { useTranslation } from "@localization";

const SINGLE_WORKOUT_KEY = "single-workout";
// Keys under workout.copyTarget, in Date#getMonth / Date#getDay order.
const SHORT_MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const SHORT_WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function getTargetKey(target) {
  return `program-${target?.program_id ?? "unknown"}-${target?.day_id ?? "day"}`;
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

function formatConflictDate(dateLabel, t) {
  const parsedDate = parseLocalDate(dateLabel);

  if (!parsedDate) {
    return dateLabel || t("workout.copyTarget.thisDate");
  }

  return t("workout.copyTarget.date", {
    weekday: t(`workout.copyTarget.weekdays.${SHORT_WEEKDAY_KEYS[parsedDate.getDay()]}`),
    day: String(parsedDate.getDate()).padStart(2, "0"),
    month: t(`workout.copyTarget.months.${SHORT_MONTH_KEYS[parsedDate.getMonth()]}`),
    year: parsedDate.getFullYear(),
  });
}

function getBlockWeekLabel(target, t) {
  return [
    target?.mesocycle_number
      ? t("workout.program.block", { number: target.mesocycle_number })
      : null,
    target?.microcycle_number
      ? t("workout.program.week", { number: target.microcycle_number })
      : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function getProgramSubtitle(target) {
  const dayLabel = [target?.weekday, target?.date].filter(Boolean).join(" ");
  return [dayLabel, target?.program_name].filter(Boolean).join(" - ");
}

function getProgramMeta(target, t) {
  const blockWeek = getBlockWeekLabel(target, t);
  return blockWeek ? blockWeek.toUpperCase() : t("workout.copyTarget.programFallback");
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
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState(SINGLE_WORKOUT_KEY);
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const mutedText = theme.iconColor ?? quietText;
  const primaryColor = theme.primary;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary;
  const warningColor = theme.planned;
  const fieldSurface = theme.fields ?? theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const confirmTextColor = theme.textInverted ?? theme.background;
  const primarySoft = withAlpha(primaryColor, 0.14);
  const secondarySoft = withAlpha(secondaryColor, 0.14);
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
      <ThemedSheetHandle style={styles.handle} />

      <View style={styles.header}>
        <View style={[styles.warningBadge, { backgroundColor: fieldSurface }]}>
          <ThemedText style={styles.warningIcon} setColor={warningColor}>
            !
          </ThemedText>
        </View>

        <View style={styles.headerText}>
          <ThemedText style={styles.eyebrow} setColor={warningColor}>
            {t("workout.copyTarget.eyebrow")}
          </ThemedText>
          <ThemedText style={styles.title} setColor={titleColor}>
            {t("workout.copyTarget.title")}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
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
          {t("workout.copyTarget.conflict", {
            date: formatConflictDate(dateLabel, t),
          })}
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
                <Library width={22} height={22} color={primaryTextColor} />
              </View>

              <View style={styles.optionText}>
                <View style={styles.optionEyebrowRow}>
                  <ThemedText style={styles.optionEyebrow} setColor={primaryTextColor}>
                    {getProgramMeta(target, t)}
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
                        setColor={primaryTextColor}
                      >
                        {t("workout.copyTarget.recommended")}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={styles.optionTitle} setColor={titleColor}>
                  {t("workout.copyTarget.addToProgram")}
                </ThemedText>
                <ThemedText style={styles.optionSubtitle} setColor={mutedText}>
                  {getProgramSubtitle(target)}
                </ThemedText>
                <ThemedText style={styles.optionDescription} setColor={quietText}>
                  {t("workout.copyTarget.addToProgramDetail")}
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
              {t("workout.copyTarget.standalone")}
            </ThemedText>
            <ThemedText style={styles.optionTitle} setColor={titleColor}>
              {t("workout.copyTarget.singleWorkout")}
            </ThemedText>
            <ThemedText style={styles.optionSubtitle} setColor={mutedText}>
              {t("workout.copyTarget.singleWorkoutSubtitle")}
            </ThemedText>
            <ThemedText style={styles.optionDescription} setColor={quietText}>
              {t("workout.copyTarget.singleWorkoutDetail")}
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
            {t("workout.copyTarget.cancel")}
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
            {t("workout.copyTarget.confirm")}
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
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 3,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900",
  },
  closeButton: {
    marginTop: -2,
    width: 40,
    height: 40,
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
    fontSize: 11,
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
    fontSize: 11,
    lineHeight: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  optionTitle: {
    marginTop: 6,
    fontSize: 17,
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
