import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./SicknessPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { programService } from "../../Services";
import {
  ThemedButton,
  ThemedHeader,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
  ThemedView,
} from "../../Resources/ThemedComponents";
import {
  formatDate,
  normalizeLocalDateString,
  parseCustomDate,
} from "../../Utils/dateUtils";
import {
  DEFAULT_SICKNESS_TYPE,
  SICKNESS_TYPES,
} from "../../Resources/Images/sicknessTypes";

function getTodayLabel() {
  return formatDate(new Date());
}

function mapSicknessRecord(record) {
  return {
    id: String(record.sickness_id),
    startDate: record.start_date,
    endDate: record.end_date,
    sicknessType: record.sickness_type?.trim() || DEFAULT_SICKNESS_TYPE,
    note: record.note?.trim() ?? "",
  };
}

function getSicknessTypeImage(sicknessType) {
  const foundType = SICKNESS_TYPES.find((type) => type.label === sicknessType);
  return (foundType ?? SICKNESS_TYPES[0]).image;
}

function getSicknessDateRange(record) {
  if (!record.endDate) {
    return `${record.startDate} - Ongoing`;
  }

  if (record.endDate === record.startDate) {
    return record.startDate;
  }

  return `${record.startDate} - ${record.endDate}`;
}

function isEndDateBeforeStartDate(startDate, endDate) {
  return parseCustomDate(endDate) < parseCustomDate(startDate);
}

export default function SicknessPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const db = useSQLiteContext();
  const todayLabel = getTodayLabel();
  const [startDate, setStartDate] = useState(todayLabel);
  const [endDate, setEndDate] = useState("");
  const [sicknessType, setSicknessType] = useState(DEFAULT_SICKNESS_TYPE);
  const [note, setNote] = useState("");
  const [records, setRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [datePickerTarget, setDatePickerTarget] = useState(null);

  const primaryColor = theme.primary ?? "#f7742e";
  const sicknessColor = theme.planned ?? Colors.dark.planned ?? "#ffdd00";
  const sicknessBorderColor =
    theme.plannedDark ?? Colors.dark.plannedDark ?? sicknessColor;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const innerSurface = theme.uiBackground ?? theme.cardBackground ?? theme.background;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const invertedText = theme.textInverted ?? theme.background ?? "#0E0F12";
  const dangerColor = theme.danger ?? Colors.dark.danger ?? "#ba0000ff";
  const normalizedStartDate = normalizeLocalDateString(startDate);
  const normalizedEndDate = endDate.trim()
    ? normalizeLocalDateString(endDate)
    : null;
  const endDateError =
    normalizedStartDate &&
    normalizedEndDate &&
    isEndDateBeforeStartDate(normalizedStartDate, normalizedEndDate)
      ? "End date must be after start date"
      : null;
  const canSave = Boolean(normalizedStartDate) && !endDateError && !saving;
  const isEditing = Boolean(selectedRecord);
  const datePickerValue =
    datePickerTarget === "end" && endDate
      ? parseCustomDate(endDate)
      : parseCustomDate(startDate);

  const resetRegisterForm = () => {
    setStartDate(getTodayLabel());
    setEndDate("");
    setSicknessType(DEFAULT_SICKNESS_TYPE);
    setNote("");
    setDatePickerTarget(null);
  };

  const openRegisterModal = () => {
    setSelectedRecord(null);
    resetRegisterForm();
    setRegisterModalVisible(true);
  };

  const openEditModal = (record) => {
    setSelectedRecord(record);
    setStartDate(record.startDate);
    setEndDate(record.endDate ?? "");
    setSicknessType(record.sicknessType || DEFAULT_SICKNESS_TYPE);
    setNote(record.note ?? "");
    setDatePickerTarget(null);
    setRegisterModalVisible(true);
  };

  const closeRegisterModal = () => {
    setRegisterModalVisible(false);
    setSelectedRecord(null);
    resetRegisterForm();
  };

  const openDatePicker = (target) => {
    setDatePickerTarget(target);
  };

  const handleDatePickerChange = (event, selectedDate) => {
    if (event.type === "dismissed" || !selectedDate) {
      setDatePickerTarget(null);
      return;
    }

    const formattedDate = formatDate(selectedDate);

    if (datePickerTarget === "start") {
      setStartDate(formattedDate);

      if (
        endDate &&
        isEndDateBeforeStartDate(formattedDate, normalizeLocalDateString(endDate))
      ) {
        setEndDate("");
      }
    }

    if (datePickerTarget === "end") {
      setEndDate(formattedDate);
    }

    setDatePickerTarget(null);
  };

  const loadSicknessRecords = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const sicknessRecords = await programService.getSicknessPeriods(db);
      setRecords(sicknessRecords.map(mapSicknessRecord));
    } catch (error) {
      console.error("Failed to load sickness history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSicknessRecords();
    }, [loadSicknessRecords])
  );

  const handleSaveDraft = async () => {
    if (!canSave) {
      return;
    }

    try {
      setSaving(true);
      const sicknessPayload = {
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        sicknessType,
        note: note.trim() || null,
      };

      if (selectedRecord?.id) {
        await programService.updateSicknessPeriod(db, {
          sicknessId: Number(selectedRecord.id),
          ...sicknessPayload,
        });
      } else {
        await programService.createSicknessPeriod(db, sicknessPayload);
      }

      await loadSicknessRecords();
      closeRegisterModal();
    } catch (error) {
      console.error("Failed to save sickness period:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelectedRecord = () => {
    if (!selectedRecord?.id || saving) {
      return;
    }

    Alert.alert(
      "Delete sickness?",
      "This removes it from history and clears the sick marking for the period.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              await programService.deleteSicknessPeriod(db, {
                sicknessId: Number(selectedRecord.id),
              });
              await loadSicknessRecords();
              closeRegisterModal();
            } catch (error) {
              console.error("Failed to delete sickness period:", error);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <ThemedText size={18}>Sickness</ThemedText>
      </ThemedHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemedButton
          title="Register new sickness"
          variant="primary"
          onPress={openRegisterModal}
          style={[styles.registerButton, { backgroundColor: sicknessColor }]}
        />

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionEyebrow} setColor={primaryColor}>
            HISTORY
          </ThemedText>
          <ThemedText style={styles.sectionTitle} setColor={titleColor}>
            Previous sickness
          </ThemedText>
        </View>

        {historyLoading && records.length === 0 && (
          <View
            style={[
              styles.emptyHistory,
              {
                backgroundColor: theme.cardBackground ?? innerSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.emptyHistoryText} setColor={quietText}>
              Loading sickness history...
            </ThemedText>
          </View>
        )}

        {!historyLoading && records.length === 0 && (
          <View
            style={[
              styles.emptyHistory,
              {
                backgroundColor: theme.cardBackground ?? innerSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.emptyHistoryText} setColor={quietText}>
              No sickness periods yet.
            </ThemedText>
          </View>
        )}

        {records.map((record) => (
          <TouchableOpacity
            key={record.id}
            accessibilityRole="button"
            activeOpacity={0.86}
            onPress={() => openEditModal(record)}
            style={[
              styles.historyItem,
              {
                backgroundColor: theme.cardBackground ?? innerSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.historyTopRow}>
              <View style={styles.historyDetails}>
                <ThemedText style={styles.historyDate} setColor={titleColor}>
                  {getSicknessDateRange(record)}
                </ThemedText>
                <ThemedText style={styles.historyNote} setColor={quietText}>
                  {record.note || "No note added."}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.historyTypeImageFrame,
                  {
                    borderColor: sicknessBorderColor,
                  },
                ]}
                accessible
                accessibilityLabel={record.sicknessType}
              >
                <Image
                  source={getSicknessTypeImage(record.sicknessType)}
                  style={styles.historyTypeImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ThemedModal
        visible={registerModalVisible}
        onClose={closeRegisterModal}
        title={isEditing ? "Edit sickness" : "Register sickness"}
        style={[
          styles.registerModal,
          {
            borderColor: sicknessBorderColor,
          },
        ]}
        contentStyle={styles.registerModalContent}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.registerModalScroll}
        >
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <ThemedText style={styles.fieldLabel} setColor={quietText}>
                Start date
              </ThemedText>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => openDatePicker("start")}
                style={[
                  styles.datePickerField,
                  {
                    backgroundColor: theme.uiBackground,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <ThemedText
                  style={styles.datePickerText}
                  setColor={titleColor}
                >
                  {startDate}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.dateField}>
              <ThemedText style={styles.fieldLabel} setColor={quietText}>
                End date
              </ThemedText>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => openDatePicker("end")}
                style={[
                  styles.datePickerField,
                  {
                    backgroundColor: theme.uiBackground,
                    borderColor: endDateError ? theme.danger : cardBorder,
                  },
                ]}
              >
                <ThemedText
                  style={styles.datePickerText}
                  setColor={endDate ? titleColor : quietText}
                >
                  {endDate || "Optional"}
                </ThemedText>
              </TouchableOpacity>

              {!!endDate && (
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setEndDate("")}
                  style={styles.clearEndDateButton}
                >
                  <ThemedText
                    style={styles.clearEndDateText}
                    setColor={quietText}
                  >
                    Clear end date
                  </ThemedText>
                </TouchableOpacity>
              )}

              {!!endDateError && (
                <ThemedText
                  style={styles.dateErrorText}
                  setColor={theme.danger}
                >
                  {endDateError}
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.sicknessTypeGrid}>
            {SICKNESS_TYPES.map((type) => {
              const selected = sicknessType === type.label;

              return (
                <TouchableOpacity
                  key={type.label}
                  activeOpacity={0.84}
                  onPress={() => setSicknessType(type.label)}
                  style={styles.sicknessTypeOption}
                >
                  <View
                    style={[
                      styles.sicknessTypeImageCard,
                      {
                        borderColor: selected ? sicknessBorderColor : cardBorder,
                      },
                    ]}
                  >
                    <Image
                      source={type.image}
                      style={styles.sicknessTypeImage}
                      resizeMode="cover"
                    />
                  </View>
                  <ThemedText
                    style={styles.sicknessTypeLabel}
                    setColor={selected ? sicknessColor : titleColor}
                    numberOfLines={2}
                  >
                    {type.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View>
            <ThemedText style={styles.fieldLabel} setColor={quietText}>
              Note
            </ThemedText>
            <ThemedTextInput
              value={note}
              onChangeText={setNote}
              placeholder="What are you dealing with?"
              multiline
              textAlignVertical="top"
              inputStyle={styles.noteInput}
            />
          </View>
        </ScrollView>

        {isEditing && (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleDeleteSelectedRecord}
            disabled={saving}
            style={[
              styles.deleteButton,
              {
                borderColor: dangerColor,
                opacity: saving ? 0.44 : 1,
              },
            ]}
          >
            <ThemedText style={styles.deleteButtonText} setColor={dangerColor}>
              Delete sickness
            </ThemedText>
          </TouchableOpacity>
        )}

        <View style={styles.registerModalButtons}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={closeRegisterModal}
            style={[
              styles.registerModalButton,
              {
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText
              style={styles.registerModalButtonText}
              setColor={titleColor}
            >
              Cancel
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleSaveDraft}
            disabled={!canSave}
            style={[
              styles.registerModalButton,
              {
                backgroundColor: sicknessColor,
                borderColor: sicknessBorderColor,
                opacity: canSave ? 1 : 0.44,
              },
            ]}
          >
            <ThemedText
              style={styles.registerModalButtonText}
              setColor={invertedText}
            >
              {saving ? "Saving..." : isEditing ? "Save changes" : "Save"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedModal>

      {!!datePickerTarget && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          minimumDate={
            datePickerTarget === "end"
              ? parseCustomDate(startDate)
              : undefined
          }
          onChange={handleDatePickerChange}
        />
      )}
    </ThemedView>
  );
}
