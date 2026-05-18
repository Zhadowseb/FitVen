import { useState, useEffect } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots"
import Copy from "../../../../Resources/Icons/UI-icons/Copy";
import Thermostat from "../../../../Resources/Icons/UI-icons/Thermostat";
import CalenderPastePicker from "../../../../Resources/Components/CalenderPastePicker/CalenderPasteModal";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import WeekdayIndicator from "../../../../Resources/Figures/WeekdayIndicator";
import { getWorkoutIconConfig } from "../../../../Resources/Icons/WorkoutLabels";
import PickWorkoutModal from "../../../WeekPage/Components/Day/Components/PickWorkoutModal/PickWorkoutModal";
import AddWorkoutModal from "../../../../Resources/Components/AddWorkoutModal";

import styles from "./MicrocycleListStyle";
import { programService as programRepository } from "../../../../Services";

import { ThemedCard, 
        ThemedText, 
        ThemedBottomSheet,
        ThemedModal,
        ThemedPicker,
        ThemedTextInput,
        ThemedTitle } from "../../../../Resources/ThemedComponents";
import { formatDate, parseCustomDate } from "../../../../Utils/dateUtils";
import Delete from "../../../../Resources/Icons/UI-icons/Delete";
import {
  DEFAULT_SICKNESS_TYPE,
  SICKNESS_TYPES,
} from "../../../../Resources/Images/sicknessTypes";

const DAY_CONTEXT_MENU_WIDTH = 266;
const DAY_CONTEXT_MENU_HEIGHT = 330;
const DAY_CONTEXT_MENU_MARGIN = 18;

const MenuAddIcon = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeLinecap="round"
      strokeWidth={2}
    />
  </Svg>
);

const MenuCopyIcon = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8 8.5c0-1.4 0-2.1.27-2.64a2.5 2.5 0 0 1 1.09-1.09C9.9 4.5 10.6 4.5 12 4.5h3.5c1.4 0 2.1 0 2.64.27a2.5 2.5 0 0 1 1.09 1.09c.27.54.27 1.24.27 2.64V12c0 1.4 0 2.1-.27 2.64a2.5 2.5 0 0 1-1.09 1.09c-.54.27-1.24.27-2.64.27H12c-1.4 0-2.1 0-2.64-.27a2.5 2.5 0 0 1-1.09-1.09C8 14.1 8 13.4 8 12V8.5z"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    />
    <Path
      d="M6 8H5.5c-1.4 0-2.1 0-2.64.27a2.5 2.5 0 0 0-1.09 1.09C1.5 9.9 1.5 10.6 1.5 12v3.5c0 1.4 0 2.1.27 2.64a2.5 2.5 0 0 0 1.09 1.09c.54.27 1.24.27 2.64.27H9c1.4 0 2.1 0 2.64-.27a2.5 2.5 0 0 0 1.09-1.09c.27-.54.27-1.24.27-2.64V15"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    />
  </Svg>
);

const MenuDeleteIcon = ({ color }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 6h14M9 6V4.75c0-.7.55-1.25 1.25-1.25h3.5c.7 0 1.25.55 1.25 1.25V6M18 9l-.55 8.2c-.09 1.36-.14 2.04-.58 2.46-.43.42-1.12.42-2.49.42H9.62c-1.37 0-2.06 0-2.49-.42-.44-.42-.49-1.1-.58-2.46L6 9M10 11.5v5M14 11.5v5"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    />
  </Svg>
);

const DayContextMenuAction = ({
  Icon,
  iconColor,
  label,
  onPress,
  textColor,
}) => (
  <TouchableOpacity
    activeOpacity={0.78}
    onPress={onPress}
    style={styles.dayContextAction}
  >
    <View style={styles.dayContextActionIcon}>
      <Icon color={iconColor} />
    </View>
    <ThemedText style={styles.dayContextActionText} setColor={textColor}>
      {label}
    </ThemedText>
  </TouchableOpacity>
);

const MicrocycleList = ({
  program_id,
  mesocycle_id,
  period_start,
  period_end,
  refreshKey,
  updateui,
  headerComponent = null,
}) => {
  const colorScheme = useColorScheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const theme = Colors[colorScheme] ?? Colors.light;
  const sickColor = theme.planned ?? Colors.dark.planned ?? "#ffdd00";
  const sickBorderColor =
    theme.plannedDark ?? Colors.dark.plannedDark ?? sickColor;
  const modalBorderColor =
    theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const modalTitleColor = theme.title ?? theme.text;
  const modalQuietColor = theme.quietText ?? theme.iconColor ?? theme.text;
  const modalInvertedColor =
    theme.textInverted ?? theme.cardBackground ?? "#0E0F12";
  const db = useSQLiteContext();
  const navigation = useNavigation();

  const [microcycles, setMicrocycles] = useState([]);
  const [weekSummaries, setWeekSummaries] = useState({});
  const [loading, setLoading] = useState(false);

  const [workoutCounts, setWorkoutCounts] = useState({});

  const [selectedWeek, set_selectedWeek] = useState(0);
  const [targetWeek, set_targetWeek] = useState(0);
  const [OptionsBottomsheet_visible, set_OptionsBottomsheet_visible] = useState(false);
  const [showCalendarPicker, set_ShowCalendarPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [pickWorkoutModalVisible, setPickWorkoutModalVisible] = useState(false);
  const [pickMode, setPickMode] = useState(null);
  const [dayOptionsVisible, setDayOptionsVisible] = useState(false);
  const [dayOptionsPosition, setDayOptionsPosition] = useState({
    left: DAY_CONTEXT_MENU_MARGIN,
    top: 120,
  });
  const [pendingSickDay, setPendingSickDay] = useState(null);
  const [sickContinuationVisible, setSickContinuationVisible] = useState(false);
  const [sicknessDetailsVisible, setSicknessDetailsVisible] = useState(false);
  const [sicknessDraftDay, setSicknessDraftDay] = useState(null);
  const [selectedSicknessType, setSelectedSicknessType] =
    useState(DEFAULT_SICKNESS_TYPE);
  const [sicknessNote, setSicknessNote] = useState("");
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [newDate, setNewDate] = useState(new Date());
  const PICK_MODE = {
    DELETE: "delete",
    COPY: "copy",
  };

  const isWorkoutCompleted = (workout) =>
    workout.done === 1 || workout.done === true;

  const isDaySick = (day) =>
    day?.is_sick === true ||
    day?.is_sick === "true" ||
    Number(day?.is_sick) === 1;

  const loadMicrocycles = async () => {
    try {
      setLoading(true);
      const cycles =
        await programRepository.getMicrocyclesByMesocycle(db, mesocycle_id);

      const enriched = enrichMicrocycles(cycles);
      setMicrocycles(enriched);

    } catch (error) {
      console.error("Error loading programs", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekSummaries = async () => {
    const summariesByMicrocycle = {};
    const weekDayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = formatDate(todayDate);

    for (const mc of microcycles) {
      const days = [];

      for (let i = 0; i < 7; i++) {
        const dayRow = await programRepository.getDayDetails(db, {
          microcycleId: mc.microcycle_id,
          weekday: weekDayNames[i],
        });
        const date = dayRow?.date ?? buildMicrocycleDate(mc.period_start, i);
        const dayDate = parseCustomDate(date);
        dayDate.setHours(0, 0, 0, 0);
        const isPastDay = dayDate < todayDate;
        const workouts = dayRow?.workouts ?? [];
        const sick = isDaySick(dayRow);
        const completed =
          workouts.length > 0 &&
          workouts.every((workout) => isWorkoutCompleted(workout));

        const workoutCards = workouts.map((workout) => {
          const workoutType = workout.workout_type ?? workout.label;
          const found = getWorkoutIconConfig(workoutType);
          const workoutCompleted = isWorkoutCompleted(workout);

          return {
            key: workout.workout_id,
            icon: found?.Icon ?? null,
            iconLabel: found?.short ?? workout.label ?? workoutType,
            completed: workoutCompleted,
            hasPersonalRecord: Number(workout.has_personal_record) === 1,
            sickCompleted: sick && workoutCompleted,
            overdue: isPastDay && !workoutCompleted && !sick,
            sickOverdue: isPastDay && !workoutCompleted && sick,
            workout,
          };
        });

        const icon = workoutCards[0]?.icon ?? null;
        const iconLabel =
          workouts.length === 1 ? workoutCards[0]?.iconLabel ?? null : null;

        days.push({
          microcycleId: mc.microcycle_id,
          dayId: dayRow?.day_id ?? null,
          label: weekDayLabels[i],
          day: weekDayNames[i],
          date,
          dateLabel: date.slice(0, 5),
          active: date === today,
          completed,
          isSick: sick,
          icon,
          iconLabel,
          workoutCards,
          workouts,
        });
      }

      summariesByMicrocycle[mc.microcycle_id] = days;
    }

    setWeekSummaries(summariesByMicrocycle);
  };


  const enrichMicrocycles = (cycles) => {
    return cycles.map(cycle => {
      const start = parseCustomDate(period_start);
      start.setDate(start.getDate() + (cycle.microcycle_number * 7 - 7))

      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      return {
        ...cycle,
        period_start: formatDate(start),
        period_end: formatDate(end),
      };
    })
  };

  const updateFocus = async (microcycle_id, focus) => {
    try {
      setLoading(true);

      await programRepository.updateMicrocycleFocus(db, {
        microcycleId: microcycle_id,
        focus,
      });

      updateui();
    } catch (error) {
      console.error("Error loading programs", error);
    } finally {
      setLoading(false);
    }
  }

  const copyWeek = async (source_microcycle_id, target_microcycle_id) => {
    try {
      setLoading(true);

      await programRepository.copyMicrocycleWorkouts(db, {
        sourceMicrocycleId: source_microcycle_id,
        targetMicrocycleId: target_microcycle_id,
      });
      set_targetWeek(null);

    } catch (err) {
      console.error("Error copying week:", err);
    } finally {
      setLoading(false);
    }
  };

  const getWorkoutCounts = async (microcycle_id) => {
    return programRepository.getMicrocycleWorkoutCounts(db, microcycle_id);
  };

  const loadCounts = async () => {
    const result = {};

    for (const mc of microcycles) {
      result[mc.microcycle_id] =
        await getWorkoutCounts(mc.microcycle_id);
    }

    setWorkoutCounts(result);
  };

  useFocusEffect(
    useCallback(() => {
      loadMicrocycles();

    }, [mesocycle_id, refreshKey])
  );

  useEffect(() => {
    loadCounts();
  }, [refreshKey]);

  useEffect(() => {
    if (microcycles.length === 0) return;
    loadWeekSummaries();
    loadCounts();
  }, [microcycles]);
  
  const buildMicrocycleDate = (periodStart, dayOffset) => {
    const start = parseCustomDate(periodStart);
    start.setDate(start.getDate() + dayOffset);
    return formatDate(start);
  };

  const buildWeekdayIndicators = (microcycle) => {
    const days = [];
    const start = parseCustomDate(microcycle.period_start);
    const today = formatDate(new Date());
    const weekDayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const formattedDate = formatDate(date);

      days.push({
        microcycleId: microcycle.microcycle_id,
        dayId: null,
        label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        day: weekDayNames[i],
        date: formattedDate,
        dateLabel: formattedDate.slice(0, 5),
        active: formattedDate === today,
        completed: false,
        isSick: false,

        // simpelt default – kan udvides senere
        icon: null,
        iconLabel: null,
        workoutCards: [],
        workouts: [],
      });
    }

    return days;
  };


  const deleteMicrocycle = async (microcycle_id) => {
    try {
      await programRepository.deleteMicrocycle(db, microcycle_id);

      updateui(); // refresh list
      set_OptionsBottomsheet_visible(false);

    } catch (e) {
      console.error("deleteMicrocycle failed:", e);
    }
  };



  /*
  Add in total sets for each exercise.
  Add in total weight liftet for week.
  */

  const navigateToWorkout = (workout, day) => {
    navigation.navigate("WorkoutPage", {
      workout_id: workout.workout_id,
      workout_label: workout.label,
      workout_type: workout.workout_type,
      day: day.day,
      date: day.date,
    });
  };

  const handleWeekdayLongPress = (day, event) => {
    const pageX = event?.nativeEvent?.pageX ?? windowWidth / 2;
    const pageY = event?.nativeEvent?.pageY ?? 160;
    const maxLeft = Math.max(
      DAY_CONTEXT_MENU_MARGIN,
      windowWidth - DAY_CONTEXT_MENU_WIDTH - DAY_CONTEXT_MENU_MARGIN
    );
    const maxTop = Math.max(
      DAY_CONTEXT_MENU_MARGIN,
      windowHeight - DAY_CONTEXT_MENU_HEIGHT - DAY_CONTEXT_MENU_MARGIN
    );

    setSelectedDay(day);
    setDayOptionsPosition({
      left: Math.min(Math.max(DAY_CONTEXT_MENU_MARGIN, pageX - 42), maxLeft),
      top: Math.min(Math.max(DAY_CONTEXT_MENU_MARGIN, pageY - 48), maxTop),
    });
    setDayOptionsVisible(true);
  };

  const addWorkoutToSelectedDay = () => {
    setDayOptionsVisible(false);
    setLabelModalVisible(true);
  };

  const copySelectedDayWorkout = () => {
    const workouts = selectedDay?.workouts ?? [];

    if (!workouts.length) {
      return;
    }

    if (workouts.length === 1) {
      setSelectedWorkoutId(workouts[0].workout_id);
      setDayOptionsVisible(false);
      setDatePickerVisible(true);
      return;
    }

    setDayOptionsVisible(false);
    setPickMode(PICK_MODE.COPY);
    setPickWorkoutModalVisible(true);
  };

  const deleteSelectedDayWorkout = () => {
    const workouts = selectedDay?.workouts ?? [];

    if (!workouts.length) {
      return;
    }

    if (workouts.length === 1) {
      deleteWorkout(workouts[0].workout_id);
      return;
    }

    setDayOptionsVisible(false);
    setPickMode(PICK_MODE.DELETE);
    setPickWorkoutModalVisible(true);
  };

  const getPreviousDateLabel = (date) => {
    if (!date) {
      return null;
    }

    const previousDate = parseCustomDate(date);

    if (Number.isNaN(previousDate.getTime())) {
      return null;
    }

    previousDate.setDate(previousDate.getDate() - 1);
    return formatDate(previousDate);
  };

  const findLoadedDayByDate = (date) => {
    for (const days of Object.values(weekSummaries)) {
      if (!Array.isArray(days)) {
        continue;
      }

      const foundDay = days.find((day) => day.date === date);

      if (foundDay) {
        return foundDay;
      }
    }

    return null;
  };

  const getPreviousSickDate = async (day) => {
    const previousDate = getPreviousDateLabel(day?.date);

    if (!previousDate) {
      return null;
    }

    const loadedPreviousDay = findLoadedDayByDate(previousDate);

    if (loadedPreviousDay) {
      return loadedPreviousDay.isSick ? previousDate : null;
    }

    if (!program_id) {
      return null;
    }

    const previousDayRow = await programRepository.getDayByDate(db, {
      programId: program_id,
      date: previousDate,
    });

    return isDaySick(previousDayRow) ? previousDate : null;
  };

  const applyDaySickness = async (
    day,
    nextIsSick,
    {
      continuesPrevious = false,
      sicknessType = null,
      note = null,
    } = {}
  ) => {
    if (!day) {
      return;
    }

    try {
      const dayRow =
        day.dayId
          ? { day_id: day.dayId }
          : await programRepository.getDayByMicrocycleAndDate(db, {
              microcycleId: day.microcycleId,
              date: day.date,
            });

      if (!dayRow?.day_id) {
        setDayOptionsVisible(false);
        return;
      }

      await programRepository.markDaySick(db, {
        dayId: dayRow.day_id,
        isSick: nextIsSick,
        date: day.date,
        previousDate: day.previousSickDate ?? null,
        continuesPrevious,
        sicknessType,
        note,
      });

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      setWeekSummaries((current) => {
        const currentDays = current[day.microcycleId];

        if (!currentDays) {
          return current;
        }

        return {
          ...current,
          [day.microcycleId]: currentDays.map((summaryDay) =>
            summaryDay.date === day.date
              ? (() => {
                  const dayDate = parseCustomDate(summaryDay.date);
                  dayDate.setHours(0, 0, 0, 0);
                  const isPastDay = dayDate < todayDate;

                  return {
                    ...summaryDay,
                    dayId: summaryDay.dayId ?? dayRow.day_id,
                    isSick: nextIsSick,
                    workoutCards: (summaryDay.workoutCards ?? []).map(
                      (workoutCard) => ({
                        ...workoutCard,
                        sickCompleted: nextIsSick && workoutCard.completed,
                        overdue:
                          !nextIsSick && isPastDay && !workoutCard.completed,
                        sickOverdue:
                          nextIsSick && isPastDay && !workoutCard.completed,
                      })
                    ),
                  };
                })()
              : summaryDay
          ),
        };
      });

      setSelectedDay(null);
      setPendingSickDay(null);
      setSickContinuationVisible(false);
      setSicknessDetailsVisible(false);
      setSicknessDraftDay(null);
      setSelectedSicknessType(DEFAULT_SICKNESS_TYPE);
      setSicknessNote("");
      setDayOptionsVisible(false);
      updateui?.();
    } catch (error) {
      console.error("Failed to mark day sick:", error);
    }
  };

  const openSicknessDetailsModal = (day) => {
    setSicknessDraftDay(day);
    setSelectedSicknessType(DEFAULT_SICKNESS_TYPE);
    setSicknessNote("");
    setDayOptionsVisible(false);
    setSickContinuationVisible(false);
    setSicknessDetailsVisible(true);
  };

  const markSelectedDaySick = async () => {
    if (!selectedDay) {
      return;
    }

    const nextIsSick = !selectedDay.isSick;

    if (!nextIsSick) {
      await applyDaySickness(selectedDay, false);
      return;
    }

    try {
      const previousSickDate = await getPreviousSickDate(selectedDay);

      if (previousSickDate) {
        setPendingSickDay({
          ...selectedDay,
          previousSickDate,
        });
        setDayOptionsVisible(false);
        setSickContinuationVisible(true);
        return;
      }
    } catch (error) {
      console.error("Failed to check previous sick day:", error);
    }

    openSicknessDetailsModal(selectedDay);
  };

  const closeSickContinuationPrompt = () => {
    setSickContinuationVisible(false);
    setPendingSickDay(null);
    setSelectedDay(null);
  };

  const submitSickContinuationChoice = async (continuesPrevious) => {
    if (!continuesPrevious) {
      openSicknessDetailsModal(pendingSickDay);
      return;
    }

    await applyDaySickness(pendingSickDay, true, {
      continuesPrevious: true,
    });
  };

  const closeSicknessDetailsModal = () => {
    setSicknessDetailsVisible(false);
    setSicknessDraftDay(null);
    setSicknessNote("");
    setSelectedSicknessType(DEFAULT_SICKNESS_TYPE);
    setPendingSickDay(null);
    setSelectedDay(null);
  };

  const submitSicknessDetails = async () => {
    await applyDaySickness(sicknessDraftDay, true, {
      continuesPrevious: false,
      sicknessType: selectedSicknessType,
      note: sicknessNote.trim() || null,
    });
  };

  const createWorkoutForDay = async (labelId) => {
    if (!selectedDay) {
      return;
    }

    try {
      const dayRow =
        selectedDay.dayId
          ? { day_id: selectedDay.dayId }
          : await programRepository.getDayByMicrocycleAndDate(db, {
              microcycleId: selectedDay.microcycleId,
              date: selectedDay.date,
            });

      if (!dayRow?.day_id) {
        return;
      }

      const workoutResult = await programRepository.createWorkoutForDay(db, {
        date: selectedDay.date,
        dayId: dayRow.day_id,
        workoutType: labelId.id,
        label: null,
      });
      const workoutLabel = labelId.displayName ?? labelId.id;

      setLabelModalVisible(false);
      setDayOptionsVisible(false);
      updateui();

      navigation.navigate("WorkoutPage", {
        program_id: program_id,
        day: selectedDay.day,
        date: selectedDay.date,
        workout_id: workoutResult.lastInsertRowId,
        workout_label: workoutLabel,
        workout_type: labelId.id,
      });
    } catch (error) {
      console.error("Failed to create workout:", error);
    }
  };

  const deleteWorkout = async (workoutId) => {
    try {
      await programRepository.deleteWorkout(db, workoutId);
      setPickWorkoutModalVisible(false);
      setDayOptionsVisible(false);
      setSelectedDay(null);
      setSelectedWorkoutId(null);
      setPickMode(null);
      updateui();
    } catch (error) {
      console.error("Failed to delete workout:", error);
    }
  };

  const copyWorkoutToDate = async (workoutId, date) => {
    try {
      const copiedWorkoutId = await programRepository.copyWorkoutToDate(db, {
        workoutId,
        programId: program_id,
        date,
      });

      if (!copiedWorkoutId) {
        console.warn("No day found for date");
        setSelectedWorkoutId(null);
        setPickMode(null);
        return;
      }

      setDatePickerVisible(false);
      setSelectedWorkoutId(null);
      setPickWorkoutModalVisible(false);
      setDayOptionsVisible(false);
      setSelectedDay(null);
      setPickMode(null);
      updateui();
    } catch (error) {
      console.error("Copy workout failed:", error);
    }
  };

  const renderItem = ({ item }) => {

    const counts =
      workoutCounts[item.microcycle_id] ?? { total: 0, done: 0 };
    const days = weekSummaries[item.microcycle_id] ?? buildWeekdayIndicators(item);
    const sickDayCount = days.filter((day) => day.isSick).length;
    const isWeekComplete = counts.total > 0 && counts.done === counts.total;
    const isWeekSick = sickDayCount >= 4;
    const hasWeekRecord = days.some((day) =>
      (day.workoutCards ?? []).some(
        (workoutCard) =>
          workoutCard.completed && Boolean(workoutCard.hasPersonalRecord)
      )
    );
    const primaryColor = theme.primary ?? Colors.dark.primary ?? "#f7742e";
    const primaryBorderColor =
      theme.primaryDark ?? Colors.dark.primaryDark ?? primaryColor;
    const secondaryColor = theme.secondary ?? Colors.dark.secondary ?? "#60daac";
    const secondaryBorderColor =
      theme.secondaryDark ?? Colors.dark.secondaryDark ?? secondaryColor;
    const recordColor = theme.record ?? Colors.dark.record ?? secondaryColor;
    const recordBorderColor =
      theme.recordDark ?? Colors.dark.recordDark ?? recordColor;
    const sickBorderColor =
      theme.plannedDark ?? Colors.dark.plannedDark ?? sickColor;
    const cardBorder = theme.cardBorder ?? theme.iconColor;
    const weekCardBorderColor = isWeekSick
      ? sickBorderColor
      : hasWeekRecord
        ? recordBorderColor
      : isWeekComplete
        ? secondaryColor
        : cardBorder;
    const weekNumberBackgroundColor = isWeekSick
      ? sickColor
      : hasWeekRecord
        ? recordColor
      : isWeekComplete
        ? secondaryColor
        : primaryColor;
    const weekNumberBorderColor = isWeekSick
      ? sickBorderColor
      : hasWeekRecord
        ? recordBorderColor
      : isWeekComplete
        ? secondaryBorderColor
        : primaryBorderColor;
    const titleColor = theme.title ?? theme.text;
    const badgeTextColor = hasWeekRecord && !isWeekSick
      ? theme.title ?? "#ffffff"
      : theme.textInverted ?? theme.cardBackground ?? "#0E0F12";

    return (
      <ThemedCard
        style={[
          styles.card,
          {
            borderWidth: 1,
            borderColor: weekCardBorderColor,
            borderStyle: isWeekSick ? "dashed" : "solid",
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderContent}>
            <View style={styles.cardTitleRow}>
              <View
                style={[
                  styles.weekNumberBadge,
                  {
                    backgroundColor: weekNumberBackgroundColor,
                    borderColor: weekNumberBorderColor,
                    borderStyle: isWeekSick ? "dashed" : "solid",
                    borderWidth: 2,
                  },
                ]}
              >
                <ThemedText
                  style={styles.weekNumberBadgeText}
                  setColor={badgeTextColor}
                >
                  {item.microcycle_number}
                </ThemedText>
              </View>

              <ThemedTitle
                type="h3"
                style={[styles.cardHeaderTitle, { color: titleColor }]}
              >
                {item.focus || "No focus set"}
              </ThemedTitle>
            </View>
          </View>

          <View style={styles.cardHeaderSide}>
            <TouchableOpacity
              style={styles.optionsButton}
              onPress={async () => {
                set_selectedWeek(item);
                set_OptionsBottomsheet_visible(true);
              }}
            >
              <ThreeDots
                width={"20"}
                height={"20"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekdaysShell}>
          <View style={styles.weekdaysRow}>
            {days.map((day) => (
              <View
                key={`${item.microcycle_id}-${day.day}`}
                style={styles.weekdayTouchable}
              >
                <WeekdayIndicator
                  label={day.label}
                  dateLabel={day.dateLabel}
                  active={day.active}
                  completed={day.completed}
                  isSick={day.isSick}
                  icon={day.icon}
                  iconLabel={day.iconLabel}
                  workoutCards={day.workoutCards}
                  onWorkoutPress={(workout) => {
                    if (!workout) {
                      return;
                    }

                    navigateToWorkout(workout, day);
                  }}
                  onDayLongPress={(event) => {
                    handleWeekdayLongPress(day, event);
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      </ThemedCard>
    );
  };

  return (
    <>
    <FlatList
      data={microcycles}
      renderItem={renderItem}
      ListHeaderComponent={
        headerComponent ? (
          <View style={styles.listHeader}>
            {headerComponent}
          </View>
        ) : null
      }
    />

    <ThemedBottomSheet
      visible={OptionsBottomsheet_visible}
      onClose={() => set_OptionsBottomsheet_visible(false)} >

      <View style={styles.bottomsheet_title}>

          <ThemedTitle type={"h3"} style={{flex: 10}}> 
            Week number: {selectedWeek.microcycle_number} 
          </ThemedTitle>

          <View style={styles.focus}>
            <ThemedText> Change Focus </ThemedText>

            <ThemedPicker
              value={selectedWeek.focus}
              onChange={ (newFocus) => {
                updateFocus(selectedWeek.microcycle_id, newFocus);
              }}
              placeholder="Focus"
              title="Select Week Focus"
              items={[
                "Progressive Overload",
                "Volume",
                "Intensity",
                "Technique",
                "Speed / Power",
                "Easy / Recovery",
                "Deload",
                "Max Test",
              ]}
            />
          </View>
      </View>

      <View style={styles.bottomsheet_body}>

          {/* Copy a workout, and paste it to a different day */}
          <TouchableOpacity 
              style={styles.option}
              onPress={async () => {
                set_ShowCalendarPicker(true);
              }}>

              <Copy
                  width={24}
                  height={24}/>
              <ThemedText style={styles.option_text}> 
                  Copy workouts to a different week
              </ThemedText>

          </TouchableOpacity>

          {/* Delete microcycle */}
          <TouchableOpacity 
              style={styles.option}
              onPress={async () => {
                await deleteMicrocycle(selectedWeek.microcycle_id);
              }}>

              <Delete
                  width={24}
                  height={24}/>
              <ThemedText style={styles.option_text}> 
                  Delete Week.
              </ThemedText>

          </TouchableOpacity>

      </View>

    </ThemedBottomSheet>
    
    {showCalendarPicker && (
      <CalenderPastePicker 
        program_id={program_id}
        visible={showCalendarPicker}
        close={ (returned) => {
          set_ShowCalendarPicker(false);
          copyWeek(selectedWeek.microcycle_id, returned.microcycle_id);
          updateui();
        }} 
        version="microcycle"/>
    )}

    <PickWorkoutModal
      workouts={selectedDay?.workouts ?? []}
      visible={pickWorkoutModalVisible}
      onClose={() => {
        setPickWorkoutModalVisible(false);
        setSelectedWorkoutId(null);
        setPickMode(null);
      }}
      onSubmit={(workout) => {
        if (pickMode === PICK_MODE.DELETE) {
          deleteWorkout(workout.workout_id);
          return;
        }

        if (pickMode === PICK_MODE.COPY) {
          setSelectedWorkoutId(workout.workout_id);
          setPickWorkoutModalVisible(false);
          setDatePickerVisible(true);
          return;
        }

        navigateToWorkout(workout, selectedDay);
      }}
    />

    <Modal
      visible={dayOptionsVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setDayOptionsVisible(false)}
    >
      <View style={styles.dayContextOverlay}>
        <Pressable
          style={styles.dayContextBackdrop}
          onPress={() => setDayOptionsVisible(false)}
        />

        <View
          style={[
            styles.dayContextMenu,
            {
              left: dayOptionsPosition.left,
              top: dayOptionsPosition.top,
              backgroundColor:
                colorScheme === "dark"
                  ? "#151922"
                  : theme.cardBackground ?? theme.background,
              borderColor: theme.cardBorder ?? theme.iconColor,
            },
          ]}
        >
          <View
            style={[
              styles.dayContextHeader,
              { borderBottomColor: theme.cardBorder ?? theme.iconColor },
            ]}
          >
            <ThemedText
              style={styles.dayContextMeta}
              setColor={theme.iconColor ?? theme.quietText}
            >
              {selectedDay?.date ?? ""}
            </ThemedText>

            <ThemedText
              style={styles.dayContextTitle}
              setColor={theme.title ?? theme.text}
              numberOfLines={1}
            >
              {selectedDay?.day ?? "Day options"}
            </ThemedText>
          </View>

          <View style={styles.dayContextBody}>
            <DayContextMenuAction
              Icon={MenuAddIcon}
              iconColor={theme.primary ?? "#f7742e"}
              label="Add new workout"
              onPress={addWorkoutToSelectedDay}
              textColor={theme.primary ?? "#f7742e"}
            />

            <DayContextMenuAction
              Icon={Thermostat}
              iconColor={sickColor}
              label={selectedDay?.isSick ? "Clear sick day" : "Mark as sick"}
              onPress={markSelectedDaySick}
              textColor={sickColor}
            />

            {!!selectedDay?.workouts?.length && (
              <DayContextMenuAction
                Icon={MenuCopyIcon}
                iconColor={theme.title ?? theme.text}
                label="Copy workout to a different day"
                onPress={copySelectedDayWorkout}
                textColor={theme.title ?? theme.text}
              />
            )}

            {!!selectedDay?.workouts?.length && (
              <DayContextMenuAction
                Icon={MenuDeleteIcon}
                iconColor={theme.danger ?? Colors.dark.danger ?? "#ba0000ff"}
                label="Delete workout"
                onPress={deleteSelectedDayWorkout}
                textColor={theme.danger ?? Colors.dark.danger ?? "#ba0000ff"}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>

    <ThemedModal
      visible={sickContinuationVisible}
      onClose={closeSickContinuationPrompt}
      title="Continue sickness?"
      style={[
        styles.sickContinuationModal,
        {
          borderColor: sickBorderColor,
        },
      ]}
      contentStyle={styles.sickContinuationContent}
    >
      <ThemedText
        style={styles.sickContinuationText}
        setColor={modalQuietColor}
      >
        {pendingSickDay?.previousSickDate
          ? `${pendingSickDay.previousSickDate} is already marked as sick. Should ${pendingSickDay.date} belong to the same sickness period?`
          : "The previous day is already marked as sick. Should this day belong to the same sickness period?"}
      </ThemedText>

      <View style={styles.sickContinuationButtonRow}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => submitSickContinuationChoice(false)}
          style={[
            styles.sickContinuationButton,
            {
              borderColor: modalBorderColor,
            },
          ]}
        >
          <ThemedText
            style={styles.sickContinuationButtonText}
            setColor={modalTitleColor}
          >
            No, new sickness
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => submitSickContinuationChoice(true)}
          style={[
            styles.sickContinuationButton,
            styles.sickContinuationPrimaryButton,
            {
              backgroundColor: sickColor,
              borderColor: sickBorderColor,
            },
          ]}
        >
          <ThemedText
            style={styles.sickContinuationButtonText}
            setColor={modalInvertedColor}
          >
            Yes, continue
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedModal>

    <ThemedModal
      visible={sicknessDetailsVisible}
      onClose={closeSicknessDetailsModal}
      title="Log sickness"
      style={[
        styles.sicknessDetailsModal,
        {
          borderColor: sickBorderColor,
        },
      ]}
      contentStyle={styles.sicknessDetailsContent}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sicknessDetailsScroll}
      >
        <ThemedText
          style={styles.sicknessDetailsDate}
          setColor={modalQuietColor}
        >
          {sicknessDraftDay?.date ?? ""}
        </ThemedText>

        <View style={styles.sicknessTypeGrid}>
          {SICKNESS_TYPES.map((type) => {
            const selected = selectedSicknessType === type.label;

            return (
              <TouchableOpacity
                key={type.label}
                activeOpacity={0.84}
                onPress={() => setSelectedSicknessType(type.label)}
                style={styles.sicknessTypeOption}
              >
                <View
                  style={[
                    styles.sicknessTypeImageCard,
                    {
                      borderColor: selected ? sickBorderColor : modalBorderColor,
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
                  setColor={selected ? sickColor : modalTitleColor}
                  numberOfLines={2}
                >
                  {type.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View>
          <ThemedText
            style={styles.sicknessNoteLabel}
            setColor={modalQuietColor}
          >
            Note
          </ThemedText>
          <ThemedTextInput
            value={sicknessNote}
            onChangeText={setSicknessNote}
            placeholder="What are you dealing with?"
            multiline
            textAlignVertical="top"
            inputStyle={styles.sicknessNoteInput}
          />
        </View>
      </ScrollView>

      <View style={styles.sicknessDetailsButtonRow}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={closeSicknessDetailsModal}
          style={[
            styles.sickContinuationButton,
            {
              borderColor: modalBorderColor,
            },
          ]}
        >
          <ThemedText
            style={styles.sickContinuationButtonText}
            setColor={modalTitleColor}
          >
            Cancel
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={submitSicknessDetails}
          style={[
            styles.sickContinuationButton,
            styles.sickContinuationPrimaryButton,
            {
              backgroundColor: sickColor,
              borderColor: sickBorderColor,
            },
          ]}
        >
          <ThemedText
            style={styles.sickContinuationButtonText}
            setColor={modalInvertedColor}
          >
            Save
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedModal>

    <AddWorkoutModal
      visible={labelModalVisible}
      onClose={() => {
        setLabelModalVisible(false);
      }}
      onSubmit={async (labelId) => {
        await createWorkoutForDay(labelId);
      }}
    />

    {datePickerVisible && (
      <DateTimePicker
        value={newDate}
        mode="date"
        display="default"
        onChange={async (event, date) => {
          setDatePickerVisible(false);

          if (event.type !== "set" || !date || !selectedWorkoutId) {
            setSelectedWorkoutId(null);
            setPickMode(null);
            return;
          }

          setNewDate(date);
          await copyWorkoutToDate(selectedWorkoutId, date);
        }}
      />
    )}
    
    </>
  );

};

export default MicrocycleList;
