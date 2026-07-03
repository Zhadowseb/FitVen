import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { useSQLiteContext } from "expo-sqlite";
import { formatDate, parseCustomDate } from '../../Utils/dateUtils';
import { useEffect, useState } from "react";
import { WORKOUT_ICONS } from "../../Resources/Icons/WorkoutLabels";
import Rest from "../../Resources/Icons/WorkoutLabels/Rest";

import styles from './WeekPageStyle';

import Day from './Components/Day/Day';

import { ThemedText, ThemedView, ThemedHeader } from "../../Resources/ThemedComponents";

const WeekPage = ( {route} ) => {
    const db = useSQLiteContext();

    const microcycle_id = route.params.microcycle_id;
    const program_id = route.params.program_id;
    const week_number = route.params.week_number;
    const period_start = route.params.period_start;
    const period_end = route.params.period_end;

    const weekDays = [
        'Monday', 
        'Tuesday', 
        'Wednesday', 
        'Thursday', 
        'Friday', 
        'Saturday', 
        'Sunday'];    

  return (
    <ThemedView safe={["top", "left", "right"]}>
        <ThemedHeader>
            <ThemedText size={18}>Week {week_number} </ThemedText>
            <ThemedText size={10}> {period_start} - {period_end}  </ThemedText>
        </ThemedHeader>

        <View style={styles.body}>
            
            {weekDays.map((day) => (
                <Day 
                    key={day}
                    day={day}
                    program_id={program_id}
                    microcycle_id={microcycle_id}
                    />
            ))}

        </View>

    </ThemedView>
  );
};

export default WeekPage;
