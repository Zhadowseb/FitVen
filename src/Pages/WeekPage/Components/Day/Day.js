import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import DateTimePicker from '@react-native-community/datetimepicker';
import PickWorkoutModal from './Components/PickWorkoutModal/PickWorkoutModal';

import styles from './DayStyle';
import { getWorkoutIconConfig } from '../../../../Resources/Icons/WorkoutLabels/index';

//Icons:
import ThreeDots from '../../../../Resources/Icons/UI-icons/ThreeDots';
import PlusCircled from '../../../../Resources/Icons/UI-icons/PlusCircled';
import Copy from '../../../../Resources/Icons/UI-icons/Copy';
import Delete from "../../../../Resources/Icons/UI-icons/Delete";

//Themed components and utility
import { ThemedCard, 
        ThemedText, 
        ThemedBottomSheet, 
        ThemedBouncyCheckbox } from "../../../../Resources/ThemedComponents";
import { formatDate } from '../../../../Utils/dateUtils';
import { requestOpenQuickWorkoutMenu } from "../../../../Utils/quickWorkoutMenuEvents";
import { programService as programRepository } from "../../../../Services";

const Day = ( {day, program_id, microcycle_id} ) => {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? Colors.light;
    
    const db = useSQLiteContext();
    const navigation = useNavigation();

    const [workouts, set_workouts] = useState([]);
    const [workouts_done, setWorkouts_done] = useState(false);
    const [workoutExercises, set_workoutExercises] = useState([]);
    const [day_id, setDay_id] = useState(0);
    const [date, setDate] = useState("");
    const [done, set_done] = useState(false);
    const [focusText, setFocusText] = useState("Rest");
    const [globalWeeks, set_globalWeeks] = useState(0);

    //Copy workout to different day option.
    const [newDate, set_newDate] = useState(new Date());
    const [selectedWorkout, set_selectedWorkout] = useState(0);

    //PickWorkoutModal, Option menu or actually choosing. 
    const PICK_MODE = {
        NAVIGATE: "navigate",
        COPY: "copy",
        PASTE: "paste",
        DELETE: "delete",
    };
    const [pickMode, set_pickMode] = useState(null);

    //Helps show the correct icon.
    const singleWorkoutType =
        workouts.length === 1 ? (workouts[0]?.workout_type ?? workouts[0]?.label) : null;
    const SelectedIcon = getWorkoutIconConfig(singleWorkoutType ?? focusText)?.Icon;
    
    //Visibility variabels for modals.
    const [pickWorkoutModal_visible, set_pickWorkoutModal_visible] = useState(false);
    const [datePicker_visible, set_datePicker_visible] = useState(false);
    const [OptionsBottomsheet_visible, set_OptionsBottomsheet_visible] = useState(false);
    
    const hasWorkouts = workouts.length > 0;
    
    useFocusEffect(
        useCallback(() => {
            loadDay();
        }, [day, microcycle_id])
    );

    const loadDay = async () => {
        try {
            const dayRow = await programRepository.getDayDetails(db, {
                microcycleId: microcycle_id,
                weekday: day,
            });

            if (!dayRow?.day_id) return;

            setDay_id(dayRow.day_id);
            setDate(dayRow.date);
            set_done(dayRow.done);
            set_workouts(dayRow.workouts);

            if (dayRow.workouts.length === 0) {setFocusText("Rest"); } 
            else if (dayRow.workouts.length === 1) {

                setFocusText(dayRow.workouts[0].label);
            } else { 
                setFocusText("..."); 
            }

            set_workoutExercises(dayRow.workoutExercises);
            setWorkouts_done(dayRow.workoutsDone);

        } catch (err) {
            console.error("Error loading day:", err);
        }
    };

    const copyWorkoutToDate = async (workoutId, date) => {
        try{
            const copiedWorkoutId = await programRepository.copyWorkoutToDate(db, {
                workoutId,
                programId: program_id,
                date,
            });

            if (!copiedWorkoutId) {
                console.warn("No day found for date");
                return;
            }
        } catch (err) {
            console.error("Copy workout failed:", err);
            throw err;
        }

    };

    const deleteWorkout = async (selectedWorkout) => {
        try {
            await programRepository.deleteWorkout(db, selectedWorkout);
        } catch (err) {
            console.error("Failed to delete workout:", err);
            throw err;
        }
    };




    return (
        <>
        <ThemedCard
        style={[
            styles.card,
            hasWorkouts
            ? {
                flexGrow: 1,
                minHeight: 90,
                }
            : {
                height: 50,
                opacity: 0.6,
                },
        ]}
        >
            
            <TouchableOpacity
                style={{flex: 1, flexDirection: "row"}}
                onPress={() => {
                    if(workouts.length === 1){
                        navigation.navigate("WorkoutPage", {
                            workout_id: workouts[0].workout_id,
                            day: day,
                            date: date,
                            workout_label: workouts[0].label,
                            workout_type: workouts[0].workout_type,
                        })
                    } else if (workouts.length > 1){

                        set_pickMode(PICK_MODE.NAVIGATE);
                        set_pickWorkoutModal_visible(true);
                    }
                }}>

                <View style={[styles.day]}>

                    <View style={{flexDirection: "row"}}>
                        <ThemedBouncyCheckbox
                            value={done === 1}
                            size= "20"
                            edgeSize={2}
                            disabled
                            checkmarkColor={theme.cardBackground}
                            style={{paddingRight: 10}}
                        />

                        <View style={styles.text}>
                            <ThemedText style={[workouts_done]}>
                                {day.slice(0, 3)}
                            </ThemedText>

                            <ThemedText>
                                {date.slice(0, 5)}
                            </ThemedText>
                        </View>
                    </View>

                {hasWorkouts && (
                    <View style={{flexDirection: "column", alignItems: "center", paddingBottom: 0}}>

                    <View style={ {padding: 0}}>
                        {SelectedIcon && (
                            <SelectedIcon
                                width={24}
                                height={24}
                            />
                        )}
                    </View>

                    <ThemedText style={{color: theme.quietText}} size={10}> 
                        {focusText} 
                    </ThemedText>

                    </View> )}

                </View>

                <View style={[styles.workouts, styles.text, {alignItems: hasWorkouts ? "flex-start" : "center"}]}>

                    {workoutExercises.length > 0 && (
                    <View style={{ overflow: "hidden" }}>
                        {workoutExercises.length === 1 ? (
                        // One workout = display exercises.
                        workoutExercises[0].exercises.map((ex, i) => (
                            <ThemedText key={`${ex.exercise_name}-${i}`}>
                            {ex.exercise_name} × {ex.sets}
                            </ThemedText>
                        ))
                        ) : (
                        // If there's multiple workouts, add a workout title.
                        workoutExercises.map((workout, wIndex) => (
                            <View key={workout.workout_id} style={{ marginBottom: 6 }}>
                            <ThemedText style={{ fontWeight: "600", opacity: 0.8 }}>
                                Workout {wIndex + 1}:
                            </ThemedText>

                            {workout.exercises.map((ex, i) => (
                                <ThemedText
                                key={`${workout.workout_id}-${i}`}
                                style={{ paddingLeft: 8 }}
                                >
                                {ex.exercise_name} × {ex.sets}
                                </ThemedText>
                            ))}
                            </View>
                        ))
                        )}
                    </View>
                    )}



                    {!hasWorkouts && (
                        <View style={{flexDirection: "row"}}>

                        <View style={ {padding: 4}}>
                            {SelectedIcon && (
                                <SelectedIcon
                                    width={24}
                                    height={24}
                                />
                            )}
                        </View>

                        <ThemedText style={{paddingTop: 7}}> {focusText} </ThemedText>

                        </View>
                    )}
                </View>


                <TouchableOpacity
                    style={styles.options}
                    onPress={async () => {
                        set_OptionsBottomsheet_visible(true);
                    }}>

                    <ThreeDots
                        width={"20"}
                        height={"20"}/>

                </TouchableOpacity>


                <StatusBar style="auto" />

            </TouchableOpacity>
        </ThemedCard>

        <ThemedBottomSheet
            visible={OptionsBottomsheet_visible}
            onClose={() => set_OptionsBottomsheet_visible(false)} >

            <View style={styles.bottomsheet_title}>
                <ThemedText> {day} </ThemedText>
                <ThemedText> {date} </ThemedText>
            </View>

            <View style={styles.bottomsheet_body}>

                {/* Add new workout to a certain day */}
                <TouchableOpacity 
                    style={[styles.option, {paddingTop: 0}]}
                    onPress={async () => {
                        set_OptionsBottomsheet_visible(false);
                        requestOpenQuickWorkoutMenu({
                            date,
                            day,
                            dayId: day_id,
                            programId: program_id,
                        });

                    }}>
                    <PlusCircled
                        width={24}
                        height={24}/>
                    <ThemedText style={styles.option_text}> 
                        Add new workout
                    </ThemedText>
                </TouchableOpacity>

                {/* Delete a workout */}
                <TouchableOpacity 
                    style={styles.option}
                    onPress={async () => {
                        set_pickMode(PICK_MODE.DELETE);
                        set_pickWorkoutModal_visible(true);
                    }}>

                    <Delete
                        width={24}
                        height={24}/>
                    <ThemedText style={styles.option_text}> 
                        Delete Workout
                    </ThemedText>
                </TouchableOpacity>


                {/* Copy a workout, and paste it to a different day */}
                <TouchableOpacity 
                    style={styles.option}
                    onPress={async () => {

                        set_pickMode(PICK_MODE.COPY);
                        set_pickWorkoutModal_visible(true);
                    }}>

                    <Copy
                        width={24}
                        height={24}/>
                    <ThemedText style={styles.option_text}> 
                        Copy workout to a different day
                    </ThemedText>
                </TouchableOpacity>

            </View>

        </ThemedBottomSheet>

        <PickWorkoutModal 
            workouts={workouts}
            visible={pickWorkoutModal_visible}
            onClose={() => set_pickWorkoutModal_visible(false)}
            onSubmit={(workout) => {
                console.log(workout);

                if(pickMode === PICK_MODE.NAVIGATE){
                    navigation.navigate("WorkoutPage", {
                        program_id: program_id,
                        date: date,
                        workout_id: workout.workout_id,
                        workout_label: workout.label,
                        workout_type: workout.workout_type,
                    });
                }

                if(pickMode === PICK_MODE.COPY){
                    set_selectedWorkout(workout.workout_id);
                    set_datePicker_visible(true);
                    set_pickWorkoutModal_visible(false);
                }

                if(pickMode === PICK_MODE.DELETE){
                    deleteWorkout(workout.workout_id)
                    set_pickWorkoutModal_visible(false);
                    set_OptionsBottomsheet_visible(false);
                }
            }}
        />


        {datePicker_visible && (
            <DateTimePicker
                value={newDate}
                mode="date"
                display="default"
                onChange={async (event, date) => {
                    set_datePicker_visible(false);
                    
                    if (event.type !== "set" || !date) return;

                    await copyWorkoutToDate(selectedWorkout, date)

                    set_selectedWorkout(null);
                    set_pickMode(null);
                }}
            />
        )}



        </>
    );
};

export default Day;
