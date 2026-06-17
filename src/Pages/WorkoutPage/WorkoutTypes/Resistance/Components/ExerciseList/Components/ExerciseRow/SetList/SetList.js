import { TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import { useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { Colors } from "../../../../../../../../../Resources/GlobalStyling/colors";

import styles from "./SetListStyle.js";
import Title from "./Title";

import {
  ThemedBouncyCheckbox,
  ThemedBottomSheet,
  ThemedCard,
  ThemedEditableCell,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../../../../../../../../Resources/ThemedComponents";
import Delete from "../../../../../../../../../Resources/Icons/UI-icons/Delete";
import Note from "../../../../../../../../../Resources/Icons/UI-icons/Note";
import Amrap from "../../../../../../../../../Resources/Icons/UI-icons/Amrap";
import Plus from "../../../../../../../../../Resources/Icons/UI-icons/Plus";
import Cogwheel from "../../../../../../../../../Resources/Icons/UI-icons/Cogwheel";
import { weightliftingService as weightliftingRepository } from "../../../../../../../../../Services";

const SET_LIST_COLUMN_KEYS = [
  "note",
  "rest",
  "set",
  "reps",
  "rpe",
  "rm_percentage",
  "weight",
  "done",
];
const SET_LIST_DEFAULT_VISIBLE_COLUMNS = SET_LIST_COLUMN_KEYS.reduce(
  (columns, key) => ({
    ...columns,
    [key]: true,
  }),
  {}
);
const REST_UNIT_MINUTES = "minutes";
const REST_UNIT_SECONDS = "seconds";
const REST_DIVIDER_BUBBLE_SIZE = 32;

const resolveSetListVisibleColumns = (visibleColumns) => {
  let parsedColumns = visibleColumns;

  if (typeof parsedColumns === "string") {
    try {
      parsedColumns = JSON.parse(parsedColumns);
    } catch {
      parsedColumns = null;
    }
  }

  const defaultColumns =
    weightliftingRepository.DEFAULT_VISIBLE_COLUMNS ??
    SET_LIST_DEFAULT_VISIBLE_COLUMNS;

  if (
    !parsedColumns ||
    typeof parsedColumns !== "object" ||
    Array.isArray(parsedColumns)
  ) {
    return defaultColumns;
  }

  const normalizedColumns = SET_LIST_COLUMN_KEYS.reduce(
    (columns, key) => ({
      ...columns,
      [key]: Boolean(parsedColumns[key]),
    }),
    {}
  );

  return Object.values(normalizedColumns).some(Boolean)
    ? normalizedColumns
    : defaultColumns;
};

const SetList = ({
  sets,
  exerciseName,
  visibleColumns,
  onToggleSet,
  updateUI,
  onAddSet,
  onOpenSettings,
  recordColor,
  recordLightColor,
  recordDarkColor,
  recordControlFillColor,
  recordControlTextColor,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
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
  const setChipTextColor = theme.primary ?? theme.text;
  const personalRecordColor =
    recordColor ?? theme.record ?? Colors.dark.record ?? setChipTextColor;
  const personalRecordSurface =
    recordLightColor ??
    theme.recordLight ??
    Colors.dark.recordLight ??
    (isDark ? "rgba(55, 63, 174, 0.38)" : "rgba(55, 63, 174, 0.16)");
  const personalRecordBorder =
    recordDarkColor ??
    theme.recordDark ??
    Colors.dark.recordDark ??
    personalRecordColor;
  const personalRecordControlFill =
    recordControlFillColor ?? personalRecordBorder;
  const personalRecordControlText =
    recordControlTextColor ?? personalRecordSurface;
  const addSetColor = theme.iconColor ?? theme.quietText ?? theme.text;
  const exerciseActionColor = theme.primary ?? addSetColor;
  const secondaryColor = theme.secondary ?? Colors.dark.secondary;
  const selectedRestUnitTextColor =
    theme.textInverted ?? theme.cardBackground ?? "#0E0F12";
  const restUnitBorderColor =
    theme.cardBorder ?? theme.iconColor ?? "rgba(255, 255, 255, 0.12)";
  const restSettingsFieldSurface = theme.fields ?? cellSurface;

  const db = useSQLiteContext();
  const [localSets, setLocalSets] = useState(sets);
  const resolvedVisibleColumns = resolveSetListVisibleColumns(visibleColumns);

  const [setOptionsVisible, setSetOptionsVisible] = useState(false);
  const [selectedSet, set_selectedSet] = useState(null);
  const [selectedSetNote, setSelectedSetNote] = useState("");
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteModalText, setNoteModalText] = useState("");
  const [activeEditableCell, setActiveEditableCell] = useState(null);
  const [restUnit, setRestUnit] = useState(REST_UNIT_MINUTES);
  const [mirrorRestValues, setMirrorRestValues] = useState(false);
  const [restUnitModalVisible, setRestUnitModalVisible] = useState(false);
  const [setRowLayouts, setSetRowLayouts] = useState({});

  useEffect(() => {
    setLocalSets(sets);
  }, [sets]);

  const displayedSets = localSets ?? [];
  const hasSets = displayedSets.length > 0;
  const isPersonalRecordSet = (set) =>
    Number(set?.personal_record) === 1 &&
    Number(set?.done) === 1 &&
    Number(set?.failed) !== 1;

  const applyPersonalRecordSetIds = (setIds) => {
    if (!Array.isArray(setIds)) {
      return;
    }

    const personalRecordSetIds = new Set(setIds.map((setId) => Number(setId)));

    setLocalSets((prev) =>
      prev.map((set) => ({
        ...set,
        personal_record: personalRecordSetIds.has(Number(set.sets_id)) ? 1 : 0,
      }))
    );

    set_selectedSet((prev) =>
      prev
        ? {
            ...prev,
            personal_record: personalRecordSetIds.has(Number(prev.sets_id))
              ? 1
              : 0,
          }
        : prev
    );
  };

  const getNextSetCompletion = (set) => {
    const isDone = Number(set.done) === 1;
    const isFailed = Number(set.failed) === 1;

    if (!isDone && !isFailed) {
      return { done: 1, failed: 0 };
    }

    if (isDone && !isFailed) {
      return { done: 1, failed: 1 };
    }

    return { done: 0, failed: 0 };
  };

  const columnConfig = [
    { key: "note", style: styles.note, flexValue: 1 },
    { key: "rest", style: styles.pause, flexValue: 20 },
    { key: "set", style: styles.set, flexValue: 8 },
    { key: "reps", style: styles.reps, flexValue: 13 },
    { key: "rpe", style: styles.rpe, flexValue: 9 },
    { key: "rm_percentage", style: styles.rm_percentage, flexValue: 14 },
    { key: "weight", style: styles.weight, flexValue: 20 },
    { key: "done", style: styles.done, flexValue: 14 },
  ];

  const selectedColumns = columnConfig.filter(
    (col) => resolvedVisibleColumns[col.key]
  );
  const activeColumns =
    selectedColumns.length > 0 ? selectedColumns : columnConfig;
  const renderedVisibleColumns = activeColumns.reduce(
    (columns, column) => ({
      ...columns,
      [column.key]: true,
    }),
    {}
  );
  const showRestForSets =
    Boolean(resolvedVisibleColumns.rest) && displayedSets.length > 0;
  const settingsColumnKey = renderedVisibleColumns.done
    ? "done"
    : activeColumns[activeColumns.length - 1]?.key;

  const getRenderedColumns = (set) => {
    if (set.amrap !== 1 || !renderedVisibleColumns.reps) {
      return activeColumns;
    }

    const renderedColumns = [];

    for (const column of activeColumns) {
      if (column.key === "rpe") {
        continue;
      }

      if (column.key === "reps") {
        renderedColumns.push({
          ...column,
          mergedStyle: {
            flex:
              column.flexValue +
              (renderedVisibleColumns.rpe ? 9 : 0),
          },
        });
        continue;
      }

      renderedColumns.push(column);
    }

    return renderedColumns;
  };

  const parsePauseValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsedValue = Number(String(value).replace(",", "."));

    return Number.isFinite(parsedValue) ? parsedValue : null;
  };

  const formatRestUnitValue = (value) => {
    const pauseValue = parsePauseValue(value);

    if (pauseValue === null) {
      return "";
    }

    const unitValue =
      restUnit === REST_UNIT_MINUTES ? pauseValue / 60 : pauseValue;

    if (Number.isInteger(unitValue)) {
      return unitValue.toString();
    }

    return Number(unitValue.toFixed(2)).toString();
  };

  const getPauseSuffix = () =>
    restUnit === REST_UNIT_MINUTES ? "min" : "sec";

  const getStoredPauseValue = (value) => {
    const pauseValue = parsePauseValue(value);

    if (pauseValue === null) {
      return "";
    }

    return restUnit === REST_UNIT_MINUTES ? pauseValue * 60 : pauseValue;
  };

  const deleteSet = async (setId) => {
    await weightliftingRepository.deleteSet(db, setId);
    updateUI();
  };

  const updateField = async (field, value, setId) => {
    const nextValue =
      field === "note"
        ? value === "" ? null : value
        : value === "" ? null : Number(value);

    setLocalSets((prev) =>
      prev.map((set) =>
        set.sets_id === setId ? { ...set, [field]: nextValue } : set
      )
    );

    set_selectedSet((prev) =>
      prev?.sets_id === setId ? { ...prev, [field]: nextValue } : prev
    );

    const result = await weightliftingRepository.updateSetField(db, {
      field,
      value: nextValue,
      setId,
    });

    applyPersonalRecordSetIds(result?.personalRecordSetIds);
    updateUI();
  };

  const updateRestPause = async (value, setId) => {
    if (!mirrorRestValues) {
      await updateField("pause", value, setId);
      return;
    }

    const nextValue = value === "" ? null : Number(value);
    const mirroredSetIds = displayedSets
      .map((set) => set.sets_id)
      .filter((id) => id !== null && id !== undefined);

    setLocalSets((prev) =>
      prev.map((set) => ({ ...set, pause: nextValue }))
    );

    set_selectedSet((prev) =>
      prev ? { ...prev, pause: nextValue } : prev
    );

    await Promise.all(
      mirroredSetIds.map((mirroredSetId) =>
        weightliftingRepository.updateSetField(db, {
          field: "pause",
          value: nextValue,
          setId: mirroredSetId,
        })
      )
    );

    updateUI();
  };

  const updateRmPercentage = async (value, setId) => {
    const result = await weightliftingRepository.updateSetRmPercentage(db, {
      setId,
      rmPercentage: value,
    });

    setLocalSets((prev) =>
      prev.map((set) => {
        if (set.sets_id !== setId) {
          return set;
        }

        return {
          ...set,
          rm_percentage: result.rmPercentage,
          ...(result.weightUpdated ? { weight: result.weight } : {}),
        };
      })
    );

    set_selectedSet((prev) =>
      prev?.sets_id === setId
        ? {
            ...prev,
            rm_percentage: result.rmPercentage,
            ...(result.weightUpdated ? { weight: result.weight } : {}),
          }
        : prev
    );

    applyPersonalRecordSetIds(result.personalRecordSetIds);
    updateUI();
  };

  const updateWeight = async (value, setId) => {
    const result = await weightliftingRepository.updateSetWeight(db, {
      setId,
      weight: value,
    });

    setLocalSets((prev) =>
      prev.map((set) =>
        set.sets_id === setId
          ? {
              ...set,
              weight: result.weight,
              rm_percentage: result.rmPercentage,
            }
          : set
      )
    );

    set_selectedSet((prev) =>
      prev?.sets_id === setId
        ? {
            ...prev,
            weight: result.weight,
            rm_percentage: result.rmPercentage,
          }
        : prev
    );

    applyPersonalRecordSetIds(result.personalRecordSetIds);
    updateUI();
  };

  const handleOpenSetOptions = (set) => {
    set_selectedSet(set);
    setSelectedSetNote(set.note ?? "");
    setSetOptionsVisible(true);
  };

  const persistSelectedSetNote = async () => {
    if (!selectedSet) {
      return;
    }

    const currentNote = selectedSet.note ?? "";

    if (selectedSetNote === currentNote) {
      return;
    }

    await updateField("note", selectedSetNote, selectedSet.sets_id);
  };

  const handleCloseSetOptions = async () => {
    await persistSelectedSetNote();
    setSetOptionsVisible(false);
  };

  const renderEditableValue = ({
    cellKey,
    containerStyle,
    onFocus,
    onBlur,
    ...props
  }) => {
    const isActive = activeEditableCell === cellKey;

    return (
      <View
        style={[
          styles.valuePill,
          containerStyle,
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

  const renderCellContent = (key, set) => {
    switch (key) {
      case "note":
        return set.note ? (
          <TouchableOpacity
            style={styles.note_button}
            onPress={() => {
              setNoteModalText(set.note);
              setNoteModalVisible(true);
            }}
          >
            <Note width={18} height={18} />
          </TouchableOpacity>
        ) : null;

      case "rest":
        return null;

      case "set": {
        const isPersonalRecord = isPersonalRecordSet(set);

        return (
          <TouchableOpacity
            activeOpacity={0.82}
            style={[
              styles.set_chip,
              {
                backgroundColor: isPersonalRecord
                  ? personalRecordControlFill
                  : setChipBackground,
                borderColor: isPersonalRecord
                  ? personalRecordControlFill
                  : cellBorder,
              },
            ]}
            onPress={() => handleOpenSetOptions(set)}
          >
            <ThemedText
              style={styles.set_chip_text}
              setColor={
                isPersonalRecord ? personalRecordControlText : setChipTextColor
              }
            >
              {set.set_number}
            </ThemedText>
          </TouchableOpacity>
        );
      }

      case "reps":
        return renderEditableValue({
          cellKey: `${set.sets_id}:reps`,
          value: set.reps?.toString() ?? "",
          suffix: set.amrap === 1 ? "AMRAP" : "",
          showSuffixWhenEmpty: set.amrap === 1,
          onCommit: (value) => updateField("reps", value, set.sets_id),
        });

      case "rpe":
        return renderEditableValue({
          cellKey: `${set.sets_id}:rpe`,
          value: set.rpe?.toString() ?? "",
          onCommit: (value) => updateField("rpe", value, set.sets_id),
        });

      case "rm_percentage":
        return renderEditableValue({
          cellKey: `${set.sets_id}:rm_percentage`,
          value: set.rm_percentage?.toString() ?? "",
          suffix: "%",
          onCommit: (value) => updateRmPercentage(value, set.sets_id),
        });

      case "weight":
        return renderEditableValue({
          cellKey: `${set.sets_id}:weight`,
          value: set.weight?.toString() ?? "",
          suffix: "kg",
          onCommit: (value) => updateWeight(value, set.sets_id),
        });

      case "done": {
        const isPersonalRecord = isPersonalRecordSet(set);

        return (
          <ThemedBouncyCheckbox
            value={Number(set.done) === 1 || Number(set.failed) === 1}
            onChange={() =>
              onToggleSet(set.sets_id, getNextSetCompletion(set), set)
            }
            size={18}
            edgeSize={2}
            checkmarkColor={
              isPersonalRecord ? personalRecordControlText : theme.cardBackground
            }
            fillColor={
              Number(set.failed) === 1
                ? theme.danger
                : isPersonalRecord
                  ? personalRecordControlFill
                  : undefined
            }
          />
        );
      }

      default:
        return null;
    }
  };

  const renderAddSetCell = (key) => {
    const actions = [];

    if (key === "set") {
      actions.push(
        <TouchableOpacity
          key="add-set"
          activeOpacity={0.72}
          style={styles.addSetIconCell}
          onPress={onAddSet}
        >
          <Plus width={18} height={18} color={addSetColor} />
        </TouchableOpacity>
      );
    }

    if (key === settingsColumnKey) {
      actions.push(
        <TouchableOpacity
          key="settings"
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Open exercise settings"
          style={styles.addSetIconCell}
          onPress={onOpenSettings}
        >
          <Cogwheel width={17} height={17} color={exerciseActionColor} />
        </TouchableOpacity>
      );
    }

    return actions.length > 0 ? (
      <View style={styles.addSetActions}>{actions}</View>
    ) : null;
  };

  const handleSetRowLayout = (setId, event) => {
    const { y, height } = event.nativeEvent.layout;

    setSetRowLayouts((prev) => {
      const current = prev[setId];

      if (
        current &&
        Math.abs(current.y - y) < 0.5 &&
        Math.abs(current.height - height) < 0.5
      ) {
        return prev;
      }

      return {
        ...prev,
        [setId]: { y, height },
      };
    });
  };

  const renderRestDivider = (set, renderedColumns) => {
    const rowLayout = setRowLayouts[set.sets_id];

    if (!rowLayout) {
      return null;
    }

    return (
      <View
        key={`${set.sets_id}:rest-divider`}
        pointerEvents="box-none"
        style={[
          styles.container,
          styles.restDividerOverlayRow,
          {
            height: REST_DIVIDER_BUBBLE_SIZE,
            top: rowLayout.y + rowLayout.height - REST_DIVIDER_BUBBLE_SIZE / 2,
          },
        ]}
      >
        {renderedColumns.map((col, colIndex) => {
          const isLast = colIndex === renderedColumns.length - 1;

          return (
            <View
              pointerEvents="box-none"
              key={`${set.sets_id}:rest-divider:${col.key}`}
              style={[
                styles.restDividerOverlayCell,
                styles.padding,
                col.style,
                col.mergedStyle,
                isLast && { borderRightWidth: 0 },
              ]}
            >
              {col.key === "rest" ? (
                <View
                  style={[
                    styles.restDividerBubble,
                    {
                      backgroundColor: cellSurface,
                      borderColor: tableBorder,
                    },
                  ]}
                >
                  {renderEditableValue({
                    cellKey: `${set.sets_id}:rest-divider`,
                    containerStyle: styles.restDividerValuePill,
                    value: formatRestUnitValue(set.pause),
                    suffixFormatter: getPauseSuffix,
                    onCommit: (value) =>
                      updateRestPause(getStoredPauseValue(value), set.sets_id),
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <>
      <ThemedCard
        collapsable={false}
        style={[
          styles.wrapper,
          {
            backgroundColor: tableSurface,
            borderColor: tableBorder,
          },
        ]}
      >
        {hasSets && (
          <Title
            visibleColumns={renderedVisibleColumns}
            onRestTitlePress={() => setRestUnitModalVisible(true)}
          />
        )}

        {displayedSets.map((set, rowIndex) => {
          const renderedColumns = getRenderedColumns(set);

          return (
            <View
              key={set.sets_id}
              onLayout={(event) => handleSetRowLayout(set.sets_id, event)}
              style={[
                styles.container,
                styles.setRow,
                {
                  borderBottomColor: tableBorder,
                },
                rowIndex === displayedSets.length - 1 && styles.lastGrid,
              ]}
            >
              {renderedColumns.map((col, colIndex) => {
                const isLast = colIndex === renderedColumns.length - 1;

                return (
                  <View
                    key={col.key}
                    style={[
                      styles.editable_cell,
                      styles.padding,
                      col.style,
                      col.mergedStyle,
                      {
                        borderColor: tableBorder,
                      },
                      isLast && { borderRightWidth: 0 },
                    ]}
                  >
                    {renderCellContent(col.key, set)}
                  </View>
                );
              })}
            </View>
          );
        })}

        <View
          style={[
            styles.container,
            styles.setRow,
            styles.addSetRow,
            {
              borderColor: tableBorder,
            },
          ]}
        >
          {activeColumns.map((col, colIndex) => {
            const isLast = colIndex === activeColumns.length - 1;

            return (
              <View
                key={`add-set-${col.key}`}
                style={[
                  styles.editable_cell,
                  styles.padding,
                  col.style,
                  {
                    borderColor: tableBorder,
                  },
                  isLast && { borderRightWidth: 0 },
                ]}
              >
                {renderAddSetCell(col.key)}
              </View>
            );
          })}
        </View>

        {showRestForSets &&
          displayedSets.map((set) =>
            renderRestDivider(set, getRenderedColumns(set))
          )}
      </ThemedCard>

      <ThemedBottomSheet
        visible={setOptionsVisible}
        onClose={handleCloseSetOptions}
      >
        <View style={styles.bottomsheet_title}>
          <ThemedText>Set: {selectedSet?.set_number}</ThemedText>
          <ThemedText>{exerciseName}</ThemedText>
        </View>

        <View style={styles.bottomsheet_body}>
          <View style={styles.note_section}>
            <ThemedText size={12} setColor={theme.quietText}>
              Note
            </ThemedText>

            <ThemedTextInput
              value={selectedSetNote}
              onChangeText={setSelectedSetNote}
              onEndEditing={persistSelectedSetNote}
              placeholder="Add note"
              multiline
              inputStyle={styles.note_input}
            />
          </View>

          <TouchableOpacity
            style={styles.option}
            onPress={async () => {
              if (!selectedSet) {
                return;
              }

              await updateField(
                "amrap",
                selectedSet.amrap === 1 ? 0 : 1,
                selectedSet.sets_id
              );
              setSetOptionsVisible(false);
            }}
          >
            <Amrap width={24} height={24} />
            <ThemedText style={styles.option_text}>
              {selectedSet?.amrap === 1
                ? "Remove AMRAP mark"
                : "Mark as AMRAP"}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={async () => {
              if (!selectedSet) {
                return;
              }

              await deleteSet(selectedSet.sets_id);
              setSetOptionsVisible(false);
            }}
          >
            <Delete width={24} height={24} />
            <ThemedText style={styles.option_text}>Delete set</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>

      <ThemedModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        title="Note"
      >
        <ThemedText>{noteModalText}</ThemedText>
      </ThemedModal>

      <ThemedModal
        visible={restUnitModalVisible}
        onClose={() => setRestUnitModalVisible(false)}
        title="Rest"
        style={styles.restUnitModal}
        contentStyle={styles.restUnitModalContent}
      >
        <View style={styles.restSettingsSection}>
          <ThemedText
            style={styles.restSettingsLabel}
            setColor={theme.quietText}
          >
            Unit
          </ThemedText>

          <View
            style={[
              styles.restUnitToggle,
              {
                backgroundColor: restSettingsFieldSurface,
                borderColor: restUnitBorderColor,
              },
            ]}
          >
            {[
              { unit: REST_UNIT_MINUTES, label: "Minutes" },
              { unit: REST_UNIT_SECONDS, label: "Seconds" },
            ].map((option) => {
              const selected = restUnit === option.unit;

              return (
                <TouchableOpacity
                  key={option.unit}
                  activeOpacity={0.82}
                  style={[
                    styles.restUnitOption,
                    selected && { backgroundColor: secondaryColor },
                  ]}
                  onPress={() => {
                    setRestUnit(option.unit);
                  }}
                >
                  <ThemedText
                    style={styles.restUnitOptionText}
                    setColor={selected ? selectedRestUnitTextColor : theme.text}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.restSettingsSection}>
          <ThemedText
            style={styles.restSettingsLabel}
            setColor={theme.quietText}
          >
            Apply
          </ThemedText>

          <TouchableOpacity
            activeOpacity={0.82}
            style={[
              styles.restMirrorButton,
              {
                backgroundColor: restSettingsFieldSurface,
                borderColor: restUnitBorderColor,
              },
            ]}
            onPress={() => setMirrorRestValues((prev) => !prev)}
          >
            <View style={styles.restMirrorTextGroup}>
              <ThemedText style={styles.restMirrorTitle}>
                Mirror rest fields
              </ThemedText>
              <ThemedText
                style={styles.restMirrorDescription}
                setColor={theme.quietText}
              >
                New rest edits update every set
              </ThemedText>
            </View>

            <View
              style={[
                styles.restMirrorSwitch,
                {
                  backgroundColor: mirrorRestValues
                    ? secondaryColor
                    : restUnitBorderColor,
                },
              ]}
            >
              <View
                style={[
                  styles.restMirrorSwitchThumb,
                  mirrorRestValues && styles.restMirrorSwitchThumbActive,
                  { backgroundColor: selectedRestUnitTextColor },
                ]}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ThemedModal>
    </>
  );
};

export default SetList;
