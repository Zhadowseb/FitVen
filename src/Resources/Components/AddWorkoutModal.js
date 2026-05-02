import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
    SELECTABLE_WORKOUT_ICONS,
    getWorkoutIconConfig,
} from "../Icons/WorkoutLabels/index";
import { Colors } from "../GlobalStyling/colors";
import { programService } from "../../Services";


import ThemedButton from "../ThemedComponents/ThemedButton";
import ThemedText from "../ThemedComponents/ThemedText";
import ThemedWorkoutModal from "../ThemedComponents/ThemedWorkoutModal";

export default function AddWorkoutModal({ visible, onClose, onSubmit }) {
    const db = useSQLiteContext();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? Colors.light;
    const [workoutTypes, setWorkoutTypes] = useState(null);

    useEffect(() => {
        let isMounted = true;

        if (!visible) {
            return () => {
                isMounted = false;
            };
        }

        const loadWorkoutTypes = async () => {
            try {
                const localWorkoutTypes =
                    await programService.getSelectableWorkoutTypes(db);

                if (isMounted) {
                    setWorkoutTypes(localWorkoutTypes);
                }

                const refreshedWorkoutTypes =
                    await programService.refreshSelectableWorkoutTypes(db);

                if (isMounted) {
                    setWorkoutTypes(refreshedWorkoutTypes);
                }
            } catch (error) {
                console.warn("Failed to load workout types:", error);
            }
        };

        loadWorkoutTypes();

        return () => {
            isMounted = false;
        };
    }, [db, visible]);

    const workoutOptions = useMemo(() => {
        const fallbackWorkoutTypes = SELECTABLE_WORKOUT_ICONS.map(({ id }) => ({
            name: id,
            display_name: id,
        }));
        const sourceWorkoutTypes =
            workoutTypes !== null ? workoutTypes : fallbackWorkoutTypes;
        const fallbackIconConfig = getWorkoutIconConfig("Resistance");

        return sourceWorkoutTypes
            .map((workoutType) => {
                const id = workoutType.name ?? workoutType.id;

                if (!id) {
                    return null;
                }

                const displayName =
                    workoutType.display_name ?? workoutType.displayName ?? id;
                const iconConfig =
                    getWorkoutIconConfig(id) ?? fallbackIconConfig;

                return {
                    id,
                    displayName,
                    Icon: iconConfig?.Icon,
                };
            })
            .filter((workoutType) => workoutType?.Icon);
    }, [workoutTypes]);
    
    const handleSubmit = (workoutType) => {
        onSubmit(workoutType);
        onClose();
    };

    return (
        <ThemedWorkoutModal
            visible={visible}
            onClose={onClose}
            title="Choose a workout type">

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.list}>
                {workoutOptions.map(({ id, displayName, Icon }) => (
                    <TouchableOpacity
                        key={id}
                        style={styles.option}
                        onPress={() => handleSubmit({ id, displayName })}>

                        <View
                            style={[
                              styles.iconBox,
                              {
                                backgroundColor: theme.primary,
                                borderColor: theme.iconColor,
                              },
                            ]}
                        >
                            <Icon
                                width={72}
                                height={72}
                                color={theme.cardBackground}
                                primaryColor={theme.cardBackground}
                                backgroundColor="transparent"
                            />
                        </View>

                        <ThemedText style={styles.label}>{displayName}</ThemedText>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ThemedButton 
                title="Cancel" 
                variant="danger"
                width={100} 
                onPress={onClose} />

        </ThemedWorkoutModal>
    );
}

const styles = StyleSheet.create({
    list: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    option: {
        width: 120,
        alignItems: "center",
    },
    iconBox: {
        width: 90,
        height: 90,
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    label: {
        textAlign: "center",
        paddingTop: 8,
    },
});
