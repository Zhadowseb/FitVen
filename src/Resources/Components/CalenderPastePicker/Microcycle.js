import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { programService } from "../../../Services";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import ArrowLeft from "../../Icons/UI-icons/ArrowLeft";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import Cross from "../../Icons/UI-icons/Cross";
import Library from "../../Icons/UI-icons/Library";
import {
  ThemedModal,
  ThemedSheetHandle,
  ThemedStateBlock,
  ThemedText,
} from "../../ThemedComponents";
import { useTranslation } from "@localization";

// Translated at render, so the dates follow a language switch.
const SHORT_MONTH_KEYS = [
  "programs.monthsShort.jan",
  "programs.monthsShort.feb",
  "programs.monthsShort.mar",
  "programs.monthsShort.apr",
  "programs.monthsShort.may",
  "programs.monthsShort.jun",
  "programs.monthsShort.jul",
  "programs.monthsShort.aug",
  "programs.monthsShort.sep",
  "programs.monthsShort.oct",
  "programs.monthsShort.nov",
  "programs.monthsShort.dec",
];

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

function formatShortDate(dateLabel, t) {
  const parsedDate = parseLocalDate(dateLabel);

  if (!parsedDate) {
    return dateLabel || "";
  }

  return `${String(parsedDate.getDate()).padStart(2, "0")} ${t(
    SHORT_MONTH_KEYS[parsedDate.getMonth()]
  )}`;
}

function formatWeekRange(startDate, endDate, t) {
  const start = formatShortDate(startDate, t);
  const end = formatShortDate(endDate, t);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || t("programs.picker.noDates");
}

function getWeekCountLabel(count, t) {
  const weekCount = Number(count) || 0;
  return t("programs.picker.weekCount", { count: weekCount });
}

function getWorkoutCountLabel(count, t) {
  const workoutCount = Number(count) || 0;
  return t("common.workouts", { count: workoutCount });
}

const Microcycle = ({
  program_id,
  visible,
  close,
  source_microcycle_id,
}) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [microcycles, setMicrocycles] = useState([]);
  const [mesocycles, setMesocycles] = useState([]);
  const [selectedMesocycleId, setSelectedMesocycleId] = useState(null);
  const [loading, setLoading] = useState(false);

  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const mutedText = theme.iconColor ?? quietText;
  const primaryColor = theme.primary;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary;
  const warningColor = theme.planned;
  const cardBackground = theme.cardBackground ?? theme.background;
  const fieldSurface = theme.fields ?? theme.uiBackground ?? cardBackground;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const primarySoft = withAlpha(primaryColor, 0.14);
  const secondarySoft = withAlpha(secondaryColor, 0.14);
  const warningSoft = withAlpha(warningColor, 0.16);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSelectedMesocycleId(null);
  }, [visible]);

  useEffect(() => {
    if (!program_id || !visible) {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);

        const { mesocycles: mesoRows, microcycles: microRows } =
          await programService.getMicrocycleOptions(db, program_id);

        setMesocycles(mesoRows);
        setMicrocycles(microRows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [db, program_id, visible]);

  const groupedMesocycles = useMemo(() => {
    const map = {};

    mesocycles.forEach((mesocycle) => {
      map[mesocycle.mesocycle_id] = {
        ...mesocycle,
        microcycles: [],
      };
    });

    microcycles.forEach((microcycle) => {
      if (map[microcycle.mesocycle_id]) {
        map[microcycle.mesocycle_id].microcycles.push(microcycle);
      }
    });

    return Object.values(map).sort(
      (a, b) => Number(a.mesocycle_number) - Number(b.mesocycle_number)
    );
  }, [mesocycles, microcycles]);

  const selectedGroup = useMemo(
    () =>
      groupedMesocycles.find(
        (group) =>
          Number(group.mesocycle_id) === Number(selectedMesocycleId)
      ) ?? null,
    [groupedMesocycles, selectedMesocycleId]
  );

  const selectMicrocycle = (microcycle) => {
    if (
      Number(microcycle?.microcycle_id) === Number(source_microcycle_id)
    ) {
      return;
    }

    close(microcycle);
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={() => close()}
      style={[
        styles.modal,
        {
          backgroundColor: cardBackground,
          borderColor: cardBorder,
        },
      ]}
      contentStyle={styles.modalBody}
    >
      <ThemedSheetHandle style={styles.handle} />

      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: fieldSurface }]}>
          <Library width={18} height={18} color={mutedText} />
        </View>

        <View style={styles.headerCopy}>
          <ThemedText style={styles.eyebrow} setColor={mutedText}>
            {t("programs.picker.copyWeekEyebrow")}
          </ThemedText>
          <ThemedText style={styles.title} setColor={titleColor}>
            {selectedGroup
              ? t("programs.picker.pickWeek")
              : t("programs.picker.pickBlock")}
          </ThemedText>
          <ThemedText style={styles.subtitle} setColor={mutedText}>
            {selectedGroup
              ? t("programs.picker.pickWeekHint")
              : t("programs.picker.pickBlockHint")}
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={() => close()}
          style={styles.closeButton}
        >
          <Cross width={28} height={28} color={mutedText} />
        </Pressable>
      </View>

      {loading ? (
        <ThemedStateBlock />
      ) : groupedMesocycles.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: fieldSurface, borderColor: cardBorder },
          ]}
        >
          <ThemedText style={styles.emptyTitle} setColor={titleColor}>
            {t("programs.picker.noBlocksFound")}
          </ThemedText>
          <ThemedText style={styles.emptyText} setColor={mutedText}>
            {t("programs.picker.noBlocksFoundHint")}
          </ThemedText>
        </View>
      ) : (
        <>
          {selectedGroup ? (
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => setSelectedMesocycleId(null)}
              style={[
                styles.selectedBlockBar,
                {
                  backgroundColor: fieldSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.backIconWrap}>
                <ArrowLeft width={18} height={18} />
              </View>

              <View style={styles.selectedBlockCopy}>
                <View style={styles.blockLabelRow}>
                  <View
                    style={[
                      styles.blockDot,
                      { backgroundColor: primaryColor },
                    ]}
                  />
                  <ThemedText style={styles.blockEyebrow} setColor={titleColor}>
                    {t("programs.picker.mesoLabel", {
                      number: selectedGroup.mesocycle_number,
                    })}
                  </ThemedText>
                </View>
                <ThemedText style={styles.blockSubtitle} setColor={mutedText}>
                  {selectedGroup.focus
                    ? programService.getFocusLabel(selectedGroup.focus, t)
                    : t("programs.focus.noFocusSet")} -{" "}
                  {getWeekCountLabel(
                    selectedGroup.weeks ?? selectedGroup.microcycles.length,
                    t
                  )}
                </ThemedText>
              </View>

              <ThemedText style={styles.changeLabel} setColor={primaryTextColor}>
                {t("programs.picker.change")}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <ScrollView
              style={styles.optionScroll}
              contentContainerStyle={styles.optionList}
              showsVerticalScrollIndicator={false}
            >
              {groupedMesocycles.map((group, index) => {
                const blockColor =
                  index % 2 === 0 ? primaryColor : secondaryColor;
                const blockSoft =
                  index % 2 === 0 ? primarySoft : secondarySoft;

                return (
                  <TouchableOpacity
                    key={group.mesocycle_id}
                    activeOpacity={0.84}
                    onPress={() => setSelectedMesocycleId(group.mesocycle_id)}
                    style={[
                      styles.blockCard,
                      {
                        backgroundColor: fieldSurface,
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.blockIcon,
                        { backgroundColor: blockSoft },
                      ]}
                    >
                      <Library width={22} height={22} color={blockColor} />
                    </View>

                    <View style={styles.blockCardCopy}>
                      <View style={styles.blockLabelRow}>
                        <View
                          style={[
                            styles.blockDot,
                            { backgroundColor: blockColor },
                          ]}
                        />
                        <ThemedText
                          style={styles.blockEyebrow}
                          setColor={titleColor}
                        >
                          {t("programs.picker.mesoLabel", {
                            number: group.mesocycle_number,
                          })}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.blockTitle} setColor={titleColor}>
                        {group.focus
                          ? programService.getFocusLabel(group.focus, t)
                          : t("programs.blocks.blockNumber", {
                              number: group.mesocycle_number,
                            })}
                      </ThemedText>
                      <ThemedText style={styles.blockSubtitle} setColor={mutedText}>
                        {getWeekCountLabel(
                          group.weeks ?? group.microcycles.length,
                          t
                        )}
                      </ThemedText>
                    </View>

                    <View
                      style={[
                        styles.chevron,
                        { borderColor: cardBorder },
                      ]}
                    >
                      <ThemedText style={styles.chevronText} setColor={mutedText}>
                        &gt;
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedGroup ? (
            <>
              <ScrollView
                style={styles.weekScroll}
                contentContainerStyle={styles.weekList}
                showsVerticalScrollIndicator={false}
              >
                {selectedGroup.microcycles.map((microcycle) => {
                  const isCurrent =
                    Number(microcycle.microcycle_id) ===
                    Number(source_microcycle_id);
                  const workoutCount = Number(microcycle.workout_count) || 0;
                  const hasWorkouts = workoutCount > 0;

                  return (
                    <TouchableOpacity
                      key={microcycle.microcycle_id}
                      activeOpacity={0.84}
                      disabled={isCurrent}
                      onPress={() => selectMicrocycle(microcycle)}
                      style={[
                        styles.weekCard,
                        {
                          backgroundColor: fieldSurface,
                          borderColor: isCurrent ? primaryColor : cardBorder,
                          opacity: isCurrent ? 0.72 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.weekBadge,
                          { borderColor: isCurrent ? primaryColor : titleColor },
                        ]}
                      >
                        <ThemedText style={styles.weekBadgeLabel} setColor={mutedText}>
                          {t("programs.picker.weekBadge")}
                        </ThemedText>
                        <ThemedText style={styles.weekBadgeNumber} setColor={titleColor}>
                          {String(microcycle.microcycle_number).padStart(2, "0")}
                        </ThemedText>
                      </View>

                      <View style={styles.weekCopy}>
                        <View style={styles.weekTitleRow}>
                          <ThemedText style={styles.weekTitle} setColor={titleColor}>
                            {t("programs.weekNumber", {
                              number: microcycle.microcycle_number,
                            })}
                          </ThemedText>

                          {isCurrent ? (
                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: primarySoft },
                              ]}
                            >
                              <Checkmark
                                width={11}
                                height={11}
                                color={primaryTextColor}
                                thickness={2.3}
                              />
                              <ThemedText
                                style={styles.statusText}
                                setColor={primaryTextColor}
                              >
                                {t("programs.picker.copiedBadge")}
                              </ThemedText>
                            </View>
                          ) : hasWorkouts ? (
                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: warningSoft },
                              ]}
                            >
                              <ThemedText
                                style={styles.statusText}
                                setColor={warningColor}
                              >
                                {t("programs.picker.hasWorkoutsBadge")}
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>

                        <ThemedText style={styles.weekMeta} setColor={mutedText}>
                          {formatWeekRange(
                            microcycle.period_start,
                            microcycle.period_end,
                            t
                          )}{" "}
                          - {getWorkoutCountLabel(workoutCount, t)}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.chevron,
                          { borderColor: cardBorder },
                        ]}
                      >
                        <ThemedText style={styles.chevronText} setColor={mutedText}>
                          &gt;
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <View style={[styles.footer, { borderTopColor: cardBorder }]}>
            <View
              style={[
                styles.footerHint,
                {
                  backgroundColor: fieldSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ThemedText style={styles.footerText} setColor={mutedText}>
                {selectedGroup
                  ? t("programs.picker.selectWeekFooter")
                  : t("programs.picker.selectBlockFooter")}
              </ThemedText>
            </View>
          </View>
        </>
      )}
    </ThemedModal>
  );
};

export default Microcycle;

const styles = StyleSheet.create({
  modal: {
    width: "92%",
    maxHeight: "88%",
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
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 3,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  closeButton: {
    marginTop: -2,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    minHeight: 96,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  emptyText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  optionScroll: {
    flexShrink: 1,
    maxHeight: 360,
    marginTop: 20,
  },
  optionList: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  blockCard: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  blockIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  blockCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  blockLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  blockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  blockEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  blockTitle: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  blockSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  selectedBlockBar: {
    minHeight: 62,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  backIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBlockCopy: {
    flex: 1,
    minWidth: 0,
  },
  changeLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  weekScroll: {
    flexShrink: 1,
    maxHeight: 390,
    marginTop: 14,
  },
  weekList: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  weekCard: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weekBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekBadgeLabel: {
    fontSize: 11,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  weekBadgeNumber: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
  },
  weekCopy: {
    flex: 1,
    minWidth: 0,
  },
  weekTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  weekTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  statusPill: {
    minHeight: 20,
    borderRadius: 6,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  weekMeta: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronText: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  footerHint: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  footerText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
});
