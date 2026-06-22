import { useState, useCallback, useRef } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../Resources/GlobalStyling/colors";

import {
  ThemedCard,
  ThemedText,
  ThemedBottomSheet,
  ThemedEditableCell,
} from "../../../../Resources/ThemedComponents";

import Advanced from "../../../../Resources/Icons/UI-icons/Advanced";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import Cross from "../../../../Resources/Icons/UI-icons/Cross";
import Delete from "../../../../Resources/Icons/UI-icons/Delete";
import Fire from "../../../../Resources/Icons/UI-icons/Fire";
import Plus from "../../../../Resources/Icons/UI-icons/Plus";
import Snow from "../../../../Resources/Icons/UI-icons/Snow";
import styles from "./RunStyle";
import ListHeader from "./ListHeader";
import { runningService as runningRepository } from "../../../../Services";

const ZONES = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
];

const ZONE_COLORS = {
  1: "#9CA3AF",
  2: "#22C7F2",
  3: "#10B981",
  4: "#F7742E",
  5: "#EF4444",
};

const ZONE_POPOVER_WIDTH = 238;
const ZONE_POPOVER_HEIGHT = 40;
const ZONE_POPOVER_MARGIN = 12;

const parseNumberInput = (value) => {
  const normalized = String(value ?? "").trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const parseDurationInput = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".")
    .replace(/[\u2019\u2032]/g, "'")
    .replace(/[\u201d\u2033]/g, "");

  if (!normalized) {
    return null;
  }

  const clockMatch = normalized.match(/^(\d+)[\:'](\d{1,2})$/);

  if (clockMatch) {
    const minutes = Number(clockMatch[1]);
    const seconds = Number(clockMatch[2]);

    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes + seconds / 60;
    }
  }

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const formatDistanceDisplay = (value, fallback = "") => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return numericValue.toFixed(1);
};

const formatMinutesClock = (value, fallback = "") => {
  const numericValue = parseDurationInput(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  const totalSeconds = Math.round(numericValue * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatSecondsClock = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatPaceDisplay = (value, fallback = "") => {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".")
    .replace(/[\u2019\u2032]/g, "'")
    .replace(/[\u201d\u2033]/g, "");

  if (!normalized) {
    return fallback;
  }

  const clockMatch = normalized.match(/^(\d+)[\:'](\d{1,2})$/);

  if (clockMatch) {
    return `${Number(clockMatch[1])}:${String(Number(clockMatch[2])).padStart(
      2,
      "0"
    )}`;
  }

  const numericValue = Number(normalized);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return formatMinutesClock(numericValue);
  }

  return normalized;
};

const getIntervalsSummary = (sets, emptySummary) => {
  const workingSets = sets.filter((set) => !set.is_pause);
  const totalDistance = workingSets.reduce(
    (sum, set) => sum + (Number(set.distance) || 0),
    0
  );
  const totalMinutes = sets.reduce(
    (sum, set) => sum + (parseDurationInput(set.time) || 0),
    0
  );

  if (!sets.length) {
    return emptySummary;
  }

  const distanceText =
    totalDistance > 0
      ? `${formatDistanceDisplay(totalDistance)} km total`
      : "Distance not set";
  const timeText =
    totalMinutes > 0 ? `~${Math.round(totalMinutes)} min` : "Time not set";

  return `${distanceText} - ${timeText}`;
};

const RunSetList = ({
  workout_id,
  type,
  empty,
  reloadKey,
  triggerReload,
  activeSet,
  activeSet_remainingTime,
  variant = "intervals",
  sectionTitle,
  sectionEyebrow,
  emptySummary = "No sets",
  onAddSet,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const db = useSQLiteContext();

  const [sets, setSets] = useState([]);
  const [bottomsheetVisible, set_bottomsheetVisible] = useState(false);
  const [selectedSet, set_selectedSet] = useState(null);

  const [zoneDropdownVisible, setZoneDropdownVisible] = useState(false);
  const [zoneSetId, setZoneSetId] = useState(null);
  const [zonePopoverPosition, setZonePopoverPosition] = useState({
    left: ZONE_POPOVER_MARGIN,
    top: ZONE_POPOVER_MARGIN,
  });
  const [activeEditableCell, setActiveEditableCell] = useState(null);
  const zoneTriggerRefs = useRef({});

  const primaryColor = theme.primary ?? theme.iconColor ?? theme.text;
  const secondaryColor = theme.secondary ?? primaryColor;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const mutedSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const isCompactSection = variant === "segment";
  const isDark = colorScheme === "dark";
  const tableSurface = isDark ? "rgba(16, 17, 24, 0.58)" : "#f5f4fa";
  const tableBorder = isDark
    ? "rgba(255, 255, 255, 0.07)"
    : "rgba(32, 30, 43, 0.12)";
  const cellSurface = isDark
    ? "rgba(24, 25, 34, 0.9)"
    : "rgba(255, 255, 255, 0.86)";
  const cellBorder = isDark
    ? "rgba(255, 255, 255, 0.045)"
    : "rgba(32, 30, 43, 0.08)";
  const setChipBackground = isDark
    ? "rgba(247, 116, 46, 0.17)"
    : "rgba(247, 116, 46, 0.14)";

  const loadRunSets = useCallback(async () => {
    try {
      const rows = await runningRepository.getRunSets(db, {
        workoutId: workout_id,
        type,
      });

      setSets(rows);
      empty?.(rows.length === 0);
    } catch (err) {
      console.error("Failed to load run sets:", err);
    }
  }, [db, empty, type, workout_id]);

  useFocusEffect(
    useCallback(() => {
      void loadRunSets();
    }, [loadRunSets, reloadKey])
  );

  const closeZoneDropdown = () => {
    setZoneDropdownVisible(false);
  };

  const handleZonePress = (setId) => {
    if (zoneSetId === setId && zoneDropdownVisible) {
      closeZoneDropdown();
      return;
    }

    const anchor = zoneTriggerRefs.current[setId];

    if (!anchor?.measureInWindow) {
      return;
    }

    anchor.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      const screenHeight = Dimensions.get("window").height;
      const preferredLeft = x + width - ZONE_POPOVER_WIDTH;
      const preferredTop = y + height / 2 - ZONE_POPOVER_HEIGHT / 2;
      const maxLeft = screenWidth - ZONE_POPOVER_WIDTH - ZONE_POPOVER_MARGIN;
      const maxTop = screenHeight - ZONE_POPOVER_HEIGHT - ZONE_POPOVER_MARGIN;

      setZonePopoverPosition({
        left: Math.max(ZONE_POPOVER_MARGIN, Math.min(preferredLeft, maxLeft)),
        top: Math.max(ZONE_POPOVER_MARGIN, Math.min(preferredTop, maxTop)),
      });
      setZoneSetId(setId);
      setZoneDropdownVisible(true);
    });
  };

  const handleAddSet = async () => {
    await onAddSet?.();
  };

  const openSetOptions = (set) => {
    set_selectedSet(set);
    set_bottomsheetVisible(true);
  };

  const updateSelectedSetField = async (field, value) => {
    if (!selectedSet) {
      return;
    }

    await runningRepository.updateRunSetField(db, {
      runId: selectedSet.Run_id,
      field,
      value,
    });

    set_selectedSet((prev) =>
      prev?.Run_id === selectedSet.Run_id ? { ...prev, [field]: value } : prev
    );
    await loadRunSets();
    triggerReload();
  };

  const deleteSet = async () => {
    if (!selectedSet) return;

    await runningRepository.deleteRunSet(db, {
      runId: selectedSet.Run_id,
      workoutId: workout_id,
      type,
    });

    set_selectedSet(null);
    set_bottomsheetVisible(false);
    triggerReload();
  };

  const togglePause = async () => {
    if (!selectedSet) return;

    const newValue = selectedSet.is_pause ? 0 : 1;

    await runningRepository.toggleRunSetPause(db, {
      runId: selectedSet.Run_id,
      workoutId: workout_id,
      type,
      isPause: newValue === 1,
    });

    set_selectedSet((prev) =>
      prev?.Run_id === selectedSet.Run_id ? { ...prev, is_pause: newValue } : prev
    );
    await loadRunSets();
    triggerReload();
  };

  const toggleDone = async (set) => {
    await runningRepository.updateRunSetDone(db, {
      runId: set.Run_id,
      done: !set.done,
    });

    set_selectedSet((prev) =>
      prev?.Run_id === set.Run_id ? { ...prev, done: set.done ? 0 : 1 } : prev
    );
    await loadRunSets();
    triggerReload();
  };

  const renderEditableValue = ({ cellKey, onFocus, onBlur, ...props }) => {
    const isActive = activeEditableCell === cellKey;

    return (
      <View
        style={[
          styles.valuePill,
          {
            backgroundColor: isActive ? cellSurface : "transparent",
            borderColor: isActive ? cellBorder : "transparent",
          },
        ]}
      >
        <ThemedEditableCell
          {...props}
          onFocus={(event) => {
            setActiveEditableCell(cellKey);
            onFocus?.(event);
          }}
          onBlur={() => {
            setActiveEditableCell((currentCell) =>
              currentCell === cellKey ? null : currentCell
            );
            onBlur?.();
          }}
        />
      </View>
    );
  };

  const renderDoneButton = (set) => {
    const done = Number(set.done) === 1;

    return (
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() => toggleDone(set)}
        style={styles.doneButton}
      >
        <View
          style={[
            styles.doneCircle,
            {
              borderColor: done ? secondaryColor : theme.secondaryDark ?? secondaryColor,
              backgroundColor: done ? secondaryColor : "transparent",
            },
          ]}
        >
          {done && (
            <Checkmark
              width={17}
              height={17}
              color={invertedText}
              thickness={2.2}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderZoneDropdown = (set) => {
    if (!zoneDropdownVisible || zoneSetId !== set.Run_id) {
      return null;
    }

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={closeZoneDropdown}
      >
        <View style={styles.zoneDropdownOverlay}>
          <Pressable
            style={styles.zoneDropdownBackdrop}
            onPress={closeZoneDropdown}
          />

          <View
            style={[
              styles.zoneDropdownContainer,
              zonePopoverPosition,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.zoneDropdownOption,
                styles.zoneDropdownClear,
                { borderColor: theme.danger ?? ZONE_COLORS[5] },
              ]}
              onPress={async () => {
                closeZoneDropdown();
                await runningRepository.updateRunSetField(db, {
                  runId: set.Run_id,
                  field: "heartrate",
                  value: null,
                });

                await loadRunSets();
                triggerReload();
              }}
            >
              <Cross
                width={14}
                height={14}
                color={theme.danger ?? ZONE_COLORS[5]}
              />
            </TouchableOpacity>

            {ZONES.map((zone) => {
              const bgColor = ZONE_COLORS[zone.value];

              return (
                <TouchableOpacity
                  key={zone.value}
                  style={[styles.zoneDropdownOption, { backgroundColor: bgColor }]}
                  onPress={async () => {
                    closeZoneDropdown();

                    await runningRepository.updateRunSetField(db, {
                      runId: set.Run_id,
                      field: "heartrate",
                      value: zone.value,
                    });

                    await loadRunSets();
                    triggerReload();
                  }}
                >
                  <ThemedText
                    style={[
                      styles.zoneDropdownText,
                      { color: zone.value === 1 ? "#111111" : "#FFFFFF" },
                    ]}
                  >
                    {zone.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    );
  };

  const renderWorkingRow = (set, index) => {
    const isActive = activeSet === set.Run_id;
    const isLast = index === sets.length - 1;

    return (
      <View
        key={set.Run_id}
        style={[
          styles.runTableRow,
          { borderBottomColor: tableBorder },
          isActive && [
            styles.runTableRowActive,
            {
              borderLeftColor: primaryColor,
              borderRightColor: primaryColor,
              backgroundColor: cellSurface,
            },
          ],
          isLast && styles.lastRunTableRow,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.78}
          style={[styles.runTableCell, styles.runSetColumn]}
          onPress={() => openSetOptions(set)}
        >
          <View
            style={[
              styles.setNumberBadge,
              {
                backgroundColor: isActive ? primaryColor : setChipBackground,
                borderColor: isActive ? primaryColor : cellBorder,
              },
            ]}
          >
            <ThemedText
              style={styles.setNumberText}
              setColor={isActive ? invertedText : primaryColor}
            >
              {set.set_number}
            </ThemedText>
          </View>
        </TouchableOpacity>

        <View style={[styles.runTableCell, styles.runDistanceColumn]}>
          {renderEditableValue({
            cellKey: `${set.Run_id}:distance`,
            value: set.distance?.toString() ?? "",
            displayFormatter: (value) => formatDistanceDisplay(value),
            onCommit: async (value) => {
              await runningRepository.updateRunSetField(db, {
                runId: set.Run_id,
                field: "distance",
                value: parseNumberInput(value),
              });
              await loadRunSets();
              triggerReload();
            },
          })}
        </View>

        <View style={[styles.runTableCell, styles.runPaceColumn]}>
          {renderEditableValue({
            cellKey: `${set.Run_id}:pace`,
            value: set.pace?.toString() ?? "",
            keyboardType: "normal",
            displayFormatter: (value) => formatPaceDisplay(value),
            onCommit: async (value) => {
              await runningRepository.updateRunSetField(db, {
                runId: set.Run_id,
                field: "pace",
                value: value === "" ? null : value,
              });
              await loadRunSets();
              triggerReload();
            },
          })}
        </View>

        <View style={[styles.runTableCell, styles.runTimeColumn]}>
          {isActive ? (
            <ThemedText style={styles.activeTimeText} setColor={titleColor}>
              {formatSecondsClock(activeSet_remainingTime)}
            </ThemedText>
          ) : (
            renderEditableValue({
              cellKey: `${set.Run_id}:time`,
              value: set.time?.toString() ?? "",
              keyboardType: "normal",
              displayFormatter: (value) => formatMinutesClock(value),
              onCommit: async (value) => {
                await runningRepository.updateRunSetField(db, {
                  runId: set.Run_id,
                  field: "time",
                  value: parseDurationInput(value),
                });
                await loadRunSets();
                triggerReload();
              },
            })
          )}
        </View>

        <View style={[styles.runTableCell, styles.runZoneColumn]}>
          <View
            ref={(node) => {
              if (node) {
                zoneTriggerRefs.current[set.Run_id] = node;
              } else {
                delete zoneTriggerRefs.current[set.Run_id];
              }
            }}
            style={styles.zoneAnchor}
          >
            <TouchableOpacity
              activeOpacity={0.78}
              style={[
                styles.zonePill,
                {
                  backgroundColor: set.heartrate
                    ? ZONE_COLORS[set.heartrate]
                    : "transparent",
                  borderColor: set.heartrate
                    ? ZONE_COLORS[set.heartrate]
                    : "transparent",
                },
              ]}
              onPress={() => handleZonePress(set.Run_id)}
            >
              <ThemedText
                style={[
                  styles.zoneText,
                  {
                    color:
                      set.heartrate && set.heartrate !== 1
                        ? "#FFFFFF"
                        : titleColor,
                  },
                ]}
              >
                {set.heartrate ? `Z${set.heartrate}` : ""}
              </ThemedText>
            </TouchableOpacity>

            {renderZoneDropdown(set)}
          </View>
        </View>

        <View style={[styles.runTableCell, styles.runDoneColumn]}>
          {renderDoneButton(set)}
        </View>
      </View>
    );
  };

  const renderPauseRow = (set, index) => {
    const isActive = activeSet === set.Run_id;
    const isLast = index === sets.length - 1;

    return (
      <View
        key={set.Run_id}
        style={[
          styles.runTableRow,
          { borderBottomColor: tableBorder },
          isActive && [
            styles.runTableRowActive,
            {
              borderLeftColor: primaryColor,
              borderRightColor: primaryColor,
              backgroundColor: cellSurface,
            },
          ],
          isLast && styles.lastRunTableRow,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.78}
          style={[styles.runTableCell, styles.runSetColumn]}
          onPress={() => openSetOptions(set)}
        >
          <View
            style={[
              styles.pauseIconBadge,
              {
                backgroundColor: mutedSurface,
                borderColor: cellBorder,
              },
            ]}
          >
            <View style={[styles.pauseBar, { backgroundColor: "#B8B8B8" }]} />
            <View style={[styles.pauseBar, { backgroundColor: "#B8B8B8" }]} />
          </View>
        </TouchableOpacity>

        <View style={[styles.runTableCell, styles.runDistanceColumn]}>
          {renderEditableValue({
            cellKey: `${set.Run_id}:distance`,
            value: set.distance?.toString() ?? "",
            displayFormatter: (value) => formatDistanceDisplay(value),
            onCommit: async (value) => {
              await runningRepository.updateRunSetField(db, {
                runId: set.Run_id,
                field: "distance",
                value: parseNumberInput(value),
              });
              await loadRunSets();
              triggerReload();
            },
          })}
        </View>

        <View style={[styles.runTableCell, styles.runPaceColumn]}>
          {renderEditableValue({
            cellKey: `${set.Run_id}:pace`,
            value: set.pace?.toString() ?? "",
            keyboardType: "normal",
            displayFormatter: (value) => formatPaceDisplay(value),
            onCommit: async (value) => {
              await runningRepository.updateRunSetField(db, {
                runId: set.Run_id,
                field: "pace",
                value: value === "" ? null : value,
              });
              await loadRunSets();
              triggerReload();
            },
          })}
        </View>

        <View style={[styles.runTableCell, styles.runTimeColumn]}>
          {isActive ? (
            <ThemedText style={styles.activeTimeText} setColor={titleColor}>
              {formatSecondsClock(activeSet_remainingTime)}
            </ThemedText>
          ) : (
            renderEditableValue({
              cellKey: `${set.Run_id}:time`,
              value: set.time?.toString() ?? "",
              keyboardType: "normal",
              displayFormatter: (value) => formatMinutesClock(value),
              onCommit: async (value) => {
                await runningRepository.updateRunSetField(db, {
                  runId: set.Run_id,
                  field: "time",
                  value: parseDurationInput(value),
                });
                await loadRunSets();
                triggerReload();
              },
            })
          )}
        </View>

        <View style={[styles.runTableCell, styles.runZoneColumn]}>
          <View
            ref={(node) => {
              if (node) {
                zoneTriggerRefs.current[set.Run_id] = node;
              } else {
                delete zoneTriggerRefs.current[set.Run_id];
              }
            }}
            style={styles.zoneAnchor}
          >
            <TouchableOpacity
              activeOpacity={0.78}
              style={[
                styles.zonePill,
                {
                  backgroundColor: set.heartrate
                    ? ZONE_COLORS[set.heartrate]
                    : "transparent",
                  borderColor: set.heartrate
                    ? ZONE_COLORS[set.heartrate]
                    : "transparent",
                },
              ]}
              onPress={() => handleZonePress(set.Run_id)}
            >
              <ThemedText
                style={[
                  styles.zoneText,
                  {
                    color:
                      set.heartrate && set.heartrate !== 1
                        ? "#FFFFFF"
                        : titleColor,
                  },
                ]}
              >
                {set.heartrate ? `Z${set.heartrate}` : ""}
              </ThemedText>
            </TouchableOpacity>

            {renderZoneDropdown(set)}
          </View>
        </View>

        <View style={[styles.runTableCell, styles.runDoneColumn]}>
          {renderDoneButton(set)}
        </View>
      </View>
    );
  };

  const renderSegmentCard = () => {
    const SegmentIcon = type === "COOLDOWN" ? Snow : Fire;
    const accentColor = type === "COOLDOWN" ? theme.recordLight ?? primaryColor : primaryColor;

    return (
      <View style={styles.sectionShell}>
        <ThemedCard
          style={[
            styles.segmentCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.82}
            style={styles.segmentMain}
            onPress={handleAddSet}
          >
            <View
              style={[
                styles.segmentIconFrame,
                { backgroundColor: mutedSurface, borderColor: cardBorder },
              ]}
            >
              <SegmentIcon
                width={19}
                height={19}
                color={accentColor}
                stroke={accentColor}
              />
            </View>

            <View style={styles.segmentTextBlock}>
              <ThemedText style={styles.segmentEyebrow} setColor={quietText}>
                {sectionEyebrow}
              </ThemedText>
              <ThemedText
                style={styles.segmentSummaryText}
                setColor={quietText}
                numberOfLines={1}
              >
                {emptySummary}
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.78}
            style={[
              styles.segmentActionButton,
              { backgroundColor: mutedSurface, borderColor: cardBorder },
            ]}
            onPress={handleAddSet}
          >
            <Advanced
              width={18}
              height={18}
              color={primaryColor}
              stroke={primaryColor}
            />
          </TouchableOpacity>
        </ThemedCard>
      </View>
    );
  };

  const renderIntervalsCard = () => {
    const workingSets = sets.filter((set) => !set.is_pause);
    const completedSets = workingSets.filter((set) => Number(set.done) === 1);
    const summary = getIntervalsSummary(sets, emptySummary);

    return (
      <View style={styles.sectionShell}>
        <ThemedCard
          style={[
            styles.intervalsCard,
            {
              backgroundColor: cardSurface,
              borderColor: primaryColor,
            },
          ]}
        >
          <View style={styles.intervalsHeader}>
            <View style={styles.intervalsTitleBlock}>
              <ThemedText style={styles.intervalsEyebrow} setColor={primaryColor}>
                {sectionEyebrow}
              </ThemedText>
              <ThemedText style={styles.intervalsTitle} setColor={titleColor}>
                {sectionTitle}
              </ThemedText>
            </View>

            <ThemedText style={styles.intervalsSetCount} setColor={quietText}>
              {completedSets.length} / {workingSets.length} sets
            </ThemedText>
          </View>

          <ThemedText style={styles.intervalsSummary} setColor={quietText}>
            {summary}
          </ThemedText>

          <View
            style={[
              styles.runTableShell,
              { backgroundColor: tableSurface, borderColor: tableBorder },
            ]}
          >
            <ListHeader styles={styles} dividerColor={tableBorder} />

            {sets.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyStateText} setColor={quietText}>
                  {emptySummary}
                </ThemedText>
              </View>
            ) : (
              sets.map((set, index) =>
                set.is_pause ? renderPauseRow(set, index) : renderWorkingRow(set, index)
              )
            )}

            <TouchableOpacity
              activeOpacity={0.78}
              style={[styles.tableAddRow, { borderTopColor: tableBorder }]}
              onPress={handleAddSet}
            >
              <Plus width={18} height={18} color={quietText} thickness={1.7} />
            </TouchableOpacity>
          </View>
        </ThemedCard>
      </View>
    );
  };

  const selectedSetTitle = selectedSet?.is_pause
    ? "Rest"
    : type === "WARMUP"
      ? "Warmup"
      : type === "COOLDOWN"
        ? "Cooldown"
        : `Set ${selectedSet?.set_number ?? ""}`;

  return (
    <>
      {isCompactSection && sets.length === 0
        ? renderSegmentCard()
        : renderIntervalsCard()}

      <ThemedBottomSheet
        visible={bottomsheetVisible}
        onClose={() => set_bottomsheetVisible(false)}
      >
        <View style={styles.bottomsheetHeader}>
          <View>
            <ThemedText style={styles.bottomsheetEyebrow} setColor={quietText}>
              {sectionEyebrow}
            </ThemedText>
            <ThemedText style={styles.bottomsheetSetTitle} setColor={titleColor}>
              {selectedSetTitle}
            </ThemedText>
          </View>

          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => set_bottomsheetVisible(false)}
          >
            <Cross width={20} height={20} color={quietText} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomsheetEditGrid}>
          <View style={styles.bottomsheetField}>
            <ThemedText style={styles.bottomsheetFieldLabel} setColor={quietText}>
              DIST
            </ThemedText>
            <View
              style={[
                styles.bottomsheetEditCell,
                { backgroundColor: mutedSurface, borderColor: cardBorder },
              ]}
            >
              <ThemedEditableCell
                value={selectedSet?.distance?.toString() ?? ""}
                displayFormatter={(value) => formatDistanceDisplay(value)}
                onCommit={(value) =>
                  updateSelectedSetField("distance", parseNumberInput(value))
                }
              />
            </View>
          </View>

          <View style={styles.bottomsheetField}>
            <ThemedText style={styles.bottomsheetFieldLabel} setColor={quietText}>
              PACE
            </ThemedText>
            <View
              style={[
                styles.bottomsheetEditCell,
                { backgroundColor: mutedSurface, borderColor: cardBorder },
              ]}
            >
              <ThemedEditableCell
                value={selectedSet?.pace?.toString() ?? ""}
                keyboardType="normal"
                displayFormatter={(value) => formatPaceDisplay(value)}
                onCommit={(value) =>
                  updateSelectedSetField("pace", value === "" ? null : value)
                }
              />
            </View>
          </View>

          <View style={styles.bottomsheetField}>
            <ThemedText style={styles.bottomsheetFieldLabel} setColor={quietText}>
              TIME
            </ThemedText>
            <View
              style={[
                styles.bottomsheetEditCell,
                { backgroundColor: mutedSurface, borderColor: cardBorder },
              ]}
            >
              <ThemedEditableCell
                value={selectedSet?.time?.toString() ?? ""}
                keyboardType="normal"
                displayFormatter={(value) => formatMinutesClock(value)}
                onCommit={(value) =>
                  updateSelectedSetField("time", parseDurationInput(value))
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.zoneChipRow}>
          <TouchableOpacity
            activeOpacity={0.78}
            style={[
              styles.zoneChip,
              {
                backgroundColor: selectedSet?.heartrate ? "transparent" : mutedSurface,
                borderColor: cardBorder,
              },
            ]}
            onPress={() => updateSelectedSetField("heartrate", null)}
          >
            <ThemedText style={styles.zoneChipText} setColor={quietText}>
              NO ZONE
            </ThemedText>
          </TouchableOpacity>

          {ZONES.map((zone) => {
            const selected = Number(selectedSet?.heartrate) === zone.value;

            return (
              <TouchableOpacity
                key={zone.value}
                activeOpacity={0.78}
                style={[
                  styles.zoneChip,
                  {
                    backgroundColor: selected ? ZONE_COLORS[zone.value] : "transparent",
                    borderColor: selected ? ZONE_COLORS[zone.value] : cardBorder,
                  },
                ]}
                onPress={() => updateSelectedSetField("heartrate", zone.value)}
              >
                <ThemedText
                  style={styles.zoneChipText}
                  setColor={selected && zone.value !== 1 ? "#FFFFFF" : titleColor}
                >
                  Z{zone.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bottomsheetActionRow}>
          {type === "WORKING_SET" && (
            <TouchableOpacity
              activeOpacity={0.78}
              style={[
                styles.bottomsheetAction,
                { backgroundColor: mutedSurface, borderColor: cardBorder },
              ]}
              onPress={togglePause}
            >
              <ThemedText style={styles.bottomsheetActionText} setColor={titleColor}>
                {selectedSet?.is_pause ? "Make interval" : "Make rest"}
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.78}
            style={[
              styles.bottomsheetAction,
              styles.bottomsheetActionDanger,
              { borderColor: theme.danger ?? primaryColor },
            ]}
            onPress={() => {
              void deleteSet();
            }}
          >
            <Delete width={20} height={20} color={theme.danger ?? primaryColor} />
            <ThemedText
              style={styles.bottomsheetActionText}
              setColor={theme.danger ?? primaryColor}
            >
              Delete
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>
    </>
  );
};

export default RunSetList;
