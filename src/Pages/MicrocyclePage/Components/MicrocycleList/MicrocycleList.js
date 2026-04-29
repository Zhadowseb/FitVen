import { useState, useEffect } from "react";
import { View, FlatList, TouchableOpacity } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots"
import Copy from "../../../../Resources/Icons/UI-icons/Copy";
import PlusCircled from "../../../../Resources/Icons/UI-icons/PlusCircled";
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
        ThemedPicker,
        ThemedTitle } from "../../../../Resources/ThemedComponents";
import { formatDate, parseCustomDate } from "../../../../Utils/dateUtils";
import Delete from "../../../../Resources/Icons/UI-icons/Delete";

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
  const theme = Colors[colorScheme] ?? Colors.light;
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
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [newDate, setNewDate] = useState(new Date());
  const PICK_MODE = {
    DELETE: "delete",
    COPY: "copy",
  };

  const isWorkoutCompleted = (workout) =>
    workout.done === 1 || workout.done === true;


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
            overdue: isPastDay && !workoutCompleted,
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

  const handleWeekdayLongPress = (day) => {
    setSelectedDay(day);
    setDayOptionsVisible(true);
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
    const completionPercent =
      counts.total > 0
        ? Math.round((counts.done / counts.total) * 100)
        : 0;
    const isWeekComplete = counts.total > 0 && counts.done === counts.total;
    const weekSummaryText =
      counts.total === 0
        ? "No workouts scheduled this week"
        : `${counts.done} of ${counts.total} workouts complete`;
    const quietText = theme.quietText ?? theme.iconColor;
    const cardBorder = theme.cardBorder ?? theme.iconColor;
    const softSurface = theme.uiBackground ?? theme.cardBackground;
    const titleColor = theme.title ?? theme.text;
    const progressTrackColor = softSurface;
    const progressFillColor = isWeekComplete ? theme.secondary : theme.primary;

    return (
      <ThemedCard
        style={[
          styles.card,
          {
            borderWidth: 1,
            borderColor: isWeekComplete ? theme.secondary : cardBorder,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderContent}>
            <ThemedText
              size={10}
              style={styles.cardHeaderEyebrow}
              setColor={quietText}
            >
              Week {item.microcycle_number}
            </ThemedText>

            <ThemedTitle
              type="h3"
              style={[styles.cardHeaderTitle, { color: titleColor }]}
            >
              {item.focus || "No focus set"}
            </ThemedTitle>

            <ThemedText
              size={11}
              style={styles.cardHeaderSummary}
              setColor={quietText}
            >
              {weekSummaryText}
            </ThemedText>
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

        {counts.total > 0 && (
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: progressTrackColor },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${completionPercent}%`,
                  backgroundColor: progressFillColor,
                },
              ]}
            />
          </View>
        )}

        <View style={styles.weekdaysShell}>
          <View style={styles.weekdaysRow}>
            {(weekSummaries[item.microcycle_id] ?? buildWeekdayIndicators(item)).map((day) => (
              <View
                key={`${item.microcycle_id}-${day.day}`}
                style={styles.weekdayTouchable}
              >
                <WeekdayIndicator
                  label={day.label}
                  dateLabel={day.dateLabel}
                  active={day.active}
                  completed={day.completed}
                  icon={day.icon}
                  iconLabel={day.iconLabel}
                  workoutCards={day.workoutCards}
                  onWorkoutPress={(workout) => {
                    if (!workout) {
                      return;
                    }

                    navigateToWorkout(workout, day);
                  }}
                  onDayLongPress={() => {
                    handleWeekdayLongPress(day);
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

    <ThemedBottomSheet
      visible={dayOptionsVisible}
      onClose={() => {
        setDayOptionsVisible(false);
      }}
    >
      <View style={styles.bottomsheet_title}>
        <ThemedText>{selectedDay?.day}</ThemedText>
        <ThemedText>{selectedDay?.date}</ThemedText>
      </View>

      <View style={styles.bottomsheet_body}>
        <TouchableOpacity
          style={[styles.option, { paddingTop: 0 }]}
          onPress={() => {
            setDayOptionsVisible(false);
            setLabelModalVisible(true);
          }}
        >
          <PlusCircled width={24} height={24} />
          <ThemedText style={styles.option_text}>
            Add new workout
          </ThemedText>
        </TouchableOpacity>

        {!!selectedDay?.workouts?.length && (
          <TouchableOpacity
            style={styles.option}
            onPress={() => {
              if (selectedDay.workouts.length === 1) {
                setSelectedWorkoutId(selectedDay.workouts[0].workout_id);
                setPickMode(PICK_MODE.COPY);
                setDayOptionsVisible(false);
                setDatePickerVisible(true);
                return;
              }

              setDayOptionsVisible(false);
              setPickMode(PICK_MODE.COPY);
              setPickWorkoutModalVisible(true);
            }}
          >
            <Copy width={24} height={24} />
            <ThemedText style={styles.option_text}>
              Copy workout to a different day
            </ThemedText>
          </TouchableOpacity>
        )}

        {!!selectedDay?.workouts?.length && (
          <TouchableOpacity
            style={styles.option}
            onPress={() => {
              if (selectedDay.workouts.length === 1) {
                deleteWorkout(selectedDay.workouts[0].workout_id);
                return;
              }

              setDayOptionsVisible(false);
              setPickMode(PICK_MODE.DELETE);
              setPickWorkoutModalVisible(true);
            }}
          >
            <Delete width={24} height={24} />
            <ThemedText style={styles.option_text}>
              Delete workout
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </ThemedBottomSheet>

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
