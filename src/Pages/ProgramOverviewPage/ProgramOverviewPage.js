import { Alert, View, ScrollView, TouchableOpacity } from 'react-native';
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";

import styles from './ProgramOverviewPageStyle';
import {
  programService,
  programTransferService,
  weightliftingService,
} from "../../Services";
import Rm_List from './Components/rm_list/rm_list';

import AddEstimatedSet from './Components/rm_list/Components/AddEstimatedSet/AddEstimatedSet';
import MesocycleList from "./Components/MesocycleList/MesocycleList";
import ProgramOverviewHeader from "./Components/ProgramOverviewHeader";
import StartProgramModal from "./Components/StartProgramModal";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Info from "../../Resources/Icons/UI-icons/Info";
import Copy from "../../Resources/Icons/UI-icons/Copy";
import Star from "../../Resources/Icons/UI-icons/Star";
import Pencil from "../../Resources/Icons/UI-icons/Pencil";

import { ThemedTitle,
        ThemedView,
        ThemedText,
        ThemedBottomSheet,
        ThemedModal,
        ThemedEditableCell}
  from "../../Resources/ThemedComponents";
import Delete from '../../Resources/Icons/UI-icons/Delete';
import { formatDate, parseCustomDate } from '../../Utils/dateUtils';
import { getProgramEndDate } from '../../Utils/programUtils';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const emptyProgramStats = {
    totalVolume: 0,
    avgSessionMinutes: 0,
    completionPercent: 0,
    completedWorkouts: 0,
    totalWorkouts: 0,
    streakWeeks: 0,
};

function formatCompactVolume(value) {
    const numberValue = Math.max(0, Number(value) || 0);

    if (numberValue >= 1000) {
        const thousands = numberValue / 1000;
        const rounded = Math.round(thousands * 10) / 10;
        return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
    }

    return Math.round(numberValue).toString();
}

function getLocalDateIndex(date) {
    return Math.floor(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
            MILLISECONDS_PER_DAY
    );
}

function formatHeaderDate(value) {
    if (!value) {
        return "-";
    }

    const date = parseCustomDate(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

function getProgramTimeline(startDate, totalDays) {
    const normalizedTotalDays = Math.max(0, Math.trunc(Number(totalDays) || 0));
    const totalWeeks = Math.ceil(normalizedTotalDays / 7);

    if (!startDate || normalizedTotalDays === 0) {
        return {
            currentWeek: 0,
            totalWeeks,
        };
    }

    const start = parseCustomDate(startDate);

    if (Number.isNaN(start.getTime())) {
        return {
            currentWeek: 0,
            totalWeeks,
        };
    }

    const elapsedDays = getLocalDateIndex(new Date()) - getLocalDateIndex(start);
    const currentWeek = Math.min(
        totalWeeks,
        Math.max(1, Math.floor(Math.max(0, elapsedDays) / 7) + 1)
    );

    return {
        currentWeek,
        totalWeeks,
    };
}

const BackChevronIcon = ({ color }) => (
    <Svg
        width={19}
        height={19}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
    </Svg>
);

const ThreeDotsIcon = ({ color }) => (
    <Svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round">
        <Path d="M5 12h.01M12 12h.01M19 12h.01" />
    </Svg>
);

const ProgramOverviewPage = ( {route} ) => {
    const db = useSQLiteContext();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? Colors.light;
    const radioBorderColor =
        colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.18)"
            : "rgba(15, 17, 22, 0.18)";

    const program_id = route.params.program_id;
    const initialProgramName = route.params.program_name ?? "";

    const [addEstimatedSet_visible, set_AddEstimatedSet_visible] = useState(false);
    const [refreshKey, set_refreshKey] = useState(0);
    const [status, set_status] = useState("NOT_STARTED");
    const [program_name, set_program_name] = useState(initialProgramName);
    const [start_date, set_start_date] = useState(route.params.start_date);
    const [end_date, set_end_date] = useState("");
    const [programDayCount, setProgramDayCount] = useState(0);
    const [programExercises, set_programExercises] = useState([]);
    const [visibleProgramBestExercises, set_visibleProgramBestExercises] = useState({});
    const [programExerciseBests, set_programExerciseBests] = useState([]);
    const [programStats, setProgramStats] = useState(emptyProgramStats);

    const [OptionsBottomsheet_visible, set_OptionsBottomsheet_visible] = useState(false);
    const [prSettingsBottomsheet_visible, set_prSettingsBottomsheet_visible] = useState(false);
    const [deleteConfirmModal_visible, set_DeleteConfirmModal_visible] = useState(false);
    const [isDeletingProgram, set_IsDeletingProgram] = useState(false);
    const [startProgramModal_visible, setStartProgramModalVisible] = useState(false);
    const [isStartingProgram, setIsStartingProgram] = useState(false);
    const [isExportingProgram, setIsExportingProgram] = useState(false);

    const refresh = () => {
        set_refreshKey(prev => prev + 1);
    }

    //Coming to page
    useFocusEffect(
        useCallback(() => {
            const loadOverview = async () => {
                refresh();
                await Promise.all([
                    getStatus(),
                    getName(),
                    loadProgramStats(),
                    loadProgramBestExerciseOptions(),
                    loadProgramExerciseBests(),
                    loadProgramPeriod(),
                ]);
            };

            loadOverview();
        }, [])
    );

    const handleAdd = async (data) => {
        try {
            await weightliftingService.createEstimatedSet(db, {
                programId: program_id,
                exerciseName: data.selectedExerciseName,
                estimatedWeight: data.estimated_weight,
            });

            refresh();
            set_AddEstimatedSet_visible(false);
        } catch (error) {
            console.error(error);
        }
        set_AddEstimatedSet_visible(false);
    }

    const getStatus = async () => {
        try {
            const new_status = await programService.getProgramStatus(db, program_id);
            set_status(new_status.status);

        } catch (error) {
            console.error(error);
        }
    }

    const getName = async () => {
        try {
            const name = await programService.getProgramName(db, program_id);
            set_program_name(name.program_name);

        } catch (error) {
            console.error(error);
        }
    }

    const loadProgramBestExerciseOptions = async () => {
        try {
            const exercises = await programService.getProgramBestExerciseOptions(db, program_id);
            const exerciseNames = exercises.map((exercise) => exercise.exercise_name);
            const nextVisibleExercises = Object.fromEntries(
                exercises.map((exercise) => [
                    exercise.exercise_name,
                    exercise.is_selected,
                ])
            );

            set_programExercises(exerciseNames);
            set_visibleProgramBestExercises(nextVisibleExercises);
        } catch (error) {
            console.error(error);
        }
    }

    const loadProgramExerciseBests = async () => {
        try {
            const bests = await programService.getProgramExerciseBests(db, program_id);
            set_programExerciseBests(bests);
        } catch (error) {
            console.error(error);
        }
    }

    const loadProgramStats = async () => {
        try {
            const nextStats = await programService.getProgramStats(db, program_id);
            setProgramStats(nextStats);
        } catch (error) {
            console.error(error);
            setProgramStats(emptyProgramStats);
        }
    }

    useEffect(() => {
        if (refreshKey === 0) {
            return;
        }

        loadProgramStats();
        loadProgramPeriod();
    }, [refreshKey]);

    const deleteProgram = async () => {
        try {
            set_IsDeletingProgram(true);
            await programService.deleteProgram(db, program_id);
        } catch (e) {
            console.error("deleteProgram failed:", e);
            set_IsDeletingProgram(false);
            return;
        }

        set_IsDeletingProgram(false);
        set_DeleteConfirmModal_visible(false);
        set_OptionsBottomsheet_visible(false);
        navigation.replace("ProgramPage");
    };

    const exportProgram = async () => {
        if (isExportingProgram) {
            return;
        }

        try {
            setIsExportingProgram(true);
            const result = await programTransferService.exportProgramToFile(
                db,
                program_id
            );

            Alert.alert(
                "Program exported",
                result.shared
                    ? `${result.programName} is ready to share.`
                    : `${result.fileName} was created on this device.`
            );
        } catch (error) {
            console.error("Program export failed:", error);
            Alert.alert(
                "Export failed",
                error?.message ?? "The program file could not be created."
            );
        } finally {
            setIsExportingProgram(false);
        }
    };

    const changeStatus = async (new_status) => {
        await programService.updateProgramStatus(db, {
            programId: program_id,
            status: new_status,
        });
        set_status(new_status);
    }

    const handleStatusChange = (new_status) => {
        if (status === new_status) {
            return;
        }

        if (status === "NOT_STARTED" && new_status === "ACTIVE") {
            setStartProgramModalVisible(true);
            return;
        }

        changeStatus(new_status);
    }

    const startProgram = async (selectedWeek) => {
        const nextStartDate = formatDate(selectedWeek);

        try {
            setIsStartingProgram(true);
            await programService.startProgram(db, {
                programId: program_id,
                startDate: nextStartDate,
            });

            set_start_date(nextStartDate);
            set_end_date(getProgramEndDate(nextStartDate, programDayCount));
            set_status("ACTIVE");
            setStartProgramModalVisible(false);
            refresh();
        } catch (error) {
            console.error("startProgram failed:", error);
        } finally {
            setIsStartingProgram(false);
        }
    }

    const loadProgramPeriod = async () => {
        const [result, metadata] = await Promise.all([
            programService.getProgramDayCount(db, program_id),
            programService.getProgramMetadata(db, program_id),
        ]);
        const totalDays = Math.max(0, Math.trunc(Number(result?.total_days) || 0));
        const nextStartDate = metadata?.start_date ?? start_date;

        setProgramDayCount(totalDays);
        set_start_date(nextStartDate);
        set_end_date(getProgramEndDate(nextStartDate, totalDays));
    }

    const toggleProgramBestExercise = async (exerciseName) => {
        const previousValue = visibleProgramBestExercises[exerciseName] ?? true;
        const nextValue = !previousValue;

        set_visibleProgramBestExercises((prev) => ({
            ...prev,
            [exerciseName]: nextValue,
        }));

        try {
            await programService.setProgramBestExerciseSelection(db, {
                programId: program_id,
                exerciseName,
                isSelected: nextValue,
            });
        } catch (error) {
            console.error(error);
            set_visibleProgramBestExercises((prev) => ({
                ...prev,
                [exerciseName]: previousValue,
            }));
        }
    }

    const selectedProgramBestExercises = programExercises.filter(
        (exerciseName) => visibleProgramBestExercises[exerciseName] ?? true
    );
    const programExerciseBestMap = Object.fromEntries(
        programExerciseBests.map((best) => [best.exercise_name, best])
    );

    const headerTitle = (program_name ?? "").trim() || "Program";
    const programTimeline = getProgramTimeline(start_date, programDayCount);
    const weekProgressPercent =
        status === "NOT_STARTED" || programTimeline.totalWeeks <= 0
            ? 0
            : Math.round(
                  (programTimeline.currentWeek / programTimeline.totalWeeks) * 100
              );
    const headerPeriod =
        `${formatHeaderDate(start_date)} – ${formatHeaderDate(end_date)}`;

    const statusOptions = [
        {
            value: "NOT_STARTED",
            label: "Draft",
            description: "Keep planning until you choose a start week.",
        },
        {
            value: "ACTIVE",
            label: "Active",
            description: "Use while the program is running.",
        },
        {
            value: "COMPLETE",
            label: "Complete",
            description: "Mark the cycle finished after the final week.",
        },
    ];

  return (
    <>
    <ThemedView safe={["top", "left", "right"]}>
        <View
            style={[
                styles.headerRow,
                { borderBottomColor: theme.hairline },
            ]}>
            <TouchableOpacity
                style={[
                    styles.headerCircleButton,
                    {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                    },
                ]}
                onPress={() => navigation.goBack()}>
                <BackChevronIcon color={theme.title} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
                <ThemedText style={styles.headerEyebrow} setColor={theme.quietText}>
                    Program
                </ThemedText>
                <ThemedText
                    style={styles.headerTitle}
                    setColor={theme.title}
                    numberOfLines={1}>
                    {headerTitle}
                </ThemedText>
            </View>

            <TouchableOpacity
                style={[
                    styles.headerCircleButton,
                    {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                    },
                ]}
                onPress={() => set_OptionsBottomsheet_visible(true)}>
                <ThreeDotsIcon color={theme.text} />
            </TouchableOpacity>
        </View>

        <ScrollView
            style={styles.container}
            nestedScrollEnabled
            contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + 15 },
            ]}>

            <ProgramOverviewHeader
                title={headerTitle}
                status={status}
                currentWeek={programTimeline.currentWeek}
                totalWeeks={programTimeline.totalWeeks}
                period={headerPeriod}
                weekProgressPercent={weekProgressPercent}
                completedWorkouts={programStats.completedWorkouts}
                totalWorkouts={programStats.totalWorkouts}
                totalVolumeLabel={formatCompactVolume(programStats.totalVolume)}
                avgSessionMinutes={programStats.avgSessionMinutes}
                onStart={() => setStartProgramModalVisible(true)}
            />

            {/* Mesocycle list / blocks timeline */}
            <MesocycleList
                program_id={program_id}
                start_date={start_date}
                program_status={status}
                program_current_week={programTimeline.currentWeek}
                refreshKey={refreshKey}
                refresh={refresh}/>

            {/* Program bests */}
            <View style={styles.section}>
                <View style={styles.section_header}>
                    <ThemedText
                        style={styles.section_header_eyebrow}
                        setColor={theme.quietText}>
                        Program bests
                    </ThemedText>

                    <TouchableOpacity
                        style={styles.section_header_icon}
                        onPress={() => set_prSettingsBottomsheet_visible(true)}>
                        <Info width={15} height={15} color={theme.quietText} thickness={1.8} />
                    </TouchableOpacity>
                </View>

                <View
                    style={[
                        styles.card_shell,
                        {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                        },
                    ]}>
                    {programExercises.length === 0 && (
                        <View style={styles.pr_empty}>
                            <ThemedText setColor={theme.quietText}>
                                No exercises in this program yet.
                            </ThemedText>
                        </View>
                    )}

                    {programExercises.length > 0 && selectedProgramBestExercises.length === 0 && (
                        <View style={styles.pr_empty}>
                            <ThemedText setColor={theme.quietText}>
                                No exercises selected.
                            </ThemedText>
                        </View>
                    )}

                    {selectedProgramBestExercises.map((exerciseName, index) => {
                        const programBest = programExerciseBestMap[exerciseName];
                        const hasCompletedSet = Boolean(programBest);
                        const setDisplay = programBest?.setDisplayValue
                            ? programBest.setDisplayValue.replace(" x ", " × ")
                            : null;

                        return (
                            <View key={exerciseName}>
                                {index > 0 && (
                                    <View
                                        style={[
                                            styles.pr_divider,
                                            { backgroundColor: theme.hairline },
                                        ]}
                                    />
                                )}

                                <View style={styles.pr_row}>
                                    <View
                                        style={[
                                            styles.pr_star_tile,
                                            { backgroundColor: "rgba(242, 193, 78, 0.12)" },
                                        ]}>
                                        <Star width={18} height={18} color={theme.planned} filled />
                                    </View>

                                    <View style={styles.pr_info}>
                                        <ThemedText
                                            style={styles.pr_name}
                                            setColor={theme.title}
                                            numberOfLines={1}>
                                            {exerciseName}
                                        </ThemedText>
                                        <ThemedText
                                            style={styles.pr_subtitle}
                                            setColor={theme.quietText}
                                            numberOfLines={1}>
                                            {hasCompletedSet
                                                ? `Best set ${setDisplay} · ${programBest.performedDate}`
                                                : "No completed sets."}
                                        </ThemedText>
                                    </View>

                                    <View style={styles.pr_value_group}>
                                        <ThemedText
                                            style={styles.pr_value}
                                            setColor={hasCompletedSet ? theme.primary : theme.quietText}>
                                            {programBest?.rmDisplayValue ?? "--"}
                                        </ThemedText>
                                        <ThemedText
                                            style={styles.pr_value_label}
                                            setColor={theme.quietText}>
                                            Est. 1RM
                                        </ThemedText>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* 1 rm estimates. */}
            <View style={styles.section}>
                <ThemedText
                    style={styles.section_header_eyebrow}
                    setColor={theme.quietText}>
                    Estimated 1RM's
                </ThemedText>

                <View
                    style={[
                        styles.card_shell,
                        styles.rm_container,
                        {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                        },
                    ]}>
                    <Rm_List
                        program_id={program_id}
                        refreshKey={refreshKey}
                        refresh={refresh}
                        programExerciseBestMap={programExerciseBestMap}
                        onAddPress={() => set_AddEstimatedSet_visible(true)} />

                    <AddEstimatedSet
                        visible={addEstimatedSet_visible}
                        onClose={() => set_AddEstimatedSet_visible(false)}
                        onSubmit={handleAdd}
                        programExerciseBestMap={programExerciseBestMap}/>
                </View>
            </View>

            {/* Program setting and status */}
            <View style={styles.section}>
                <ThemedText
                    style={styles.section_header_eyebrow}
                    setColor={theme.quietText}>
                    Settings
                </ThemedText>

                <View
                    style={[
                        styles.card_shell,
                        {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.cardBorder,
                        },
                    ]}>
                    <View style={styles.settings_status_label_wrap}>
                        <ThemedText
                            style={styles.settings_status_label}
                            setColor={theme.quietText}>
                            Program status
                        </ThemedText>
                    </View>

                    {statusOptions.map((option) => {
                        const isSelected = status === option.value;

                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.settings_status_row,
                                    isSelected && {
                                        backgroundColor: withAlpha(theme.primary, 0.06),
                                    },
                                ]}
                                onPress={() => handleStatusChange(option.value)}>
                                <View
                                    style={[
                                        styles.settings_radio,
                                        {
                                            borderColor: isSelected
                                                ? theme.primary
                                                : radioBorderColor,
                                        },
                                    ]}>
                                    {isSelected && (
                                        <View
                                            style={[
                                                styles.settings_radio_dot,
                                                { backgroundColor: theme.primary },
                                            ]}
                                        />
                                    )}
                                </View>

                                <View style={styles.settings_status_text}>
                                    <ThemedText
                                        style={styles.settings_status_title}
                                        setColor={theme.title}>
                                        {option.label}
                                    </ThemedText>
                                    <ThemedText
                                        style={styles.settings_status_description}
                                        setColor={theme.quietText}>
                                        {option.description}
                                    </ThemedText>
                                </View>
                            </TouchableOpacity>
                        );
                    })}

                    <View
                        style={[
                            styles.settings_divider,
                            { backgroundColor: theme.hairline },
                        ]}
                    />

                    <View style={styles.settings_name_block}>
                        <ThemedText
                            style={styles.settings_name_label}
                            setColor={theme.quietText}>
                            Program name
                        </ThemedText>

                        <View
                            style={[
                                styles.settings_name_field,
                                {
                                    backgroundColor: theme.uiBackground,
                                    borderColor: theme.border,
                                },
                            ]}>
                            <View style={styles.settings_name_value}>
                                <ThemedEditableCell
                                    value={program_name ?? ""}
                                    keyboardType="default"
                                    textAlign="left"
                                    onCommit={async (v) => {
                                        set_program_name(v);
                                        await programService.updateProgramName(db, {
                                            programId: program_id,
                                            programName: v,
                                        });
                                    }}
                                />
                            </View>
                            <Pencil width={15} height={15} color={theme.quietText} thickness={1.8} />
                        </View>
                    </View>

                    <View
                        style={[
                            styles.settings_divider,
                            { backgroundColor: theme.hairline },
                        ]}
                    />

                    <View style={styles.settings_period_block_wrap}>
                        <ThemedText
                            style={styles.settings_name_label}
                            setColor={theme.quietText}>
                            Period
                        </ThemedText>

                        <View
                            style={[
                                styles.settings_period_row,
                                {
                                    backgroundColor: theme.uiBackground,
                                    borderColor: theme.border,
                                },
                            ]}>
                            <View style={styles.settings_period_block}>
                                <ThemedText
                                    style={styles.settings_period_label}
                                    setColor={theme.quietText}>
                                    Start
                                </ThemedText>
                                <ThemedText
                                    style={styles.settings_period_value}
                                    setColor={theme.title}>
                                    {status === "NOT_STARTED" ? "Not scheduled" : start_date}
                                </ThemedText>
                            </View>

                            <View
                                style={[
                                    styles.settings_period_divider,
                                    { backgroundColor: theme.border },
                                ]}
                            />

                            <View style={styles.settings_period_block}>
                                <ThemedText
                                    style={styles.settings_period_label}
                                    setColor={theme.quietText}>
                                    End
                                </ThemedText>
                                <ThemedText
                                    style={styles.settings_period_value}
                                    setColor={theme.title}>
                                    {status === "NOT_STARTED" ? "Not scheduled" : end_date || "-"}
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    <View
                        style={[
                            styles.settings_divider,
                            { backgroundColor: theme.hairline },
                        ]}
                    />

                    <View style={styles.settings_period_block_wrap}>
                        <ThemedText
                            style={styles.settings_name_label}
                            setColor={theme.quietText}>
                            Export
                        </ThemedText>

                        <TouchableOpacity
                            style={[
                                styles.settings_export_row,
                                {
                                    backgroundColor: theme.uiBackground,
                                    borderColor: isExportingProgram
                                        ? theme.primary
                                        : theme.border,
                                    opacity: isExportingProgram ? 0.68 : 1,
                                },
                            ]}
                            disabled={isExportingProgram}
                            onPress={exportProgram}>
                            <View
                                style={[
                                    styles.settings_export_icon,
                                    { backgroundColor: withAlpha(theme.primary, 0.12) },
                                ]}>
                                <Copy width={16} height={16} />
                            </View>

                            <View style={styles.settings_export_content}>
                                <ThemedText
                                    style={styles.settings_export_title}
                                    setColor={theme.title}>
                                    {isExportingProgram ? "Exporting..." : "Export program"}
                                </ThemedText>
                                <ThemedText
                                    style={styles.settings_export_description}
                                    setColor={theme.quietText}>
                                    FitApp program file
                                </ThemedText>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

        </ScrollView>
    </ThemedView>

        <ThemedBottomSheet
            visible={OptionsBottomsheet_visible}
            onClose={() => set_OptionsBottomsheet_visible(false)} >

            <View style={styles.bottomsheet_title}>
                <ThemedTitle type={"h3"} style={{flex: 10}}>
                    Program actions
                </ThemedTitle>


            </View>

            <View style={styles.bottomsheet_body}>

                {/* Delete Program */}
                <TouchableOpacity
                    style={styles.option}
                    onPress={() => {
                        set_OptionsBottomsheet_visible(false);
                        set_DeleteConfirmModal_visible(true);
                    }}>

                    <Delete
                        width={24}
                        height={24}/>
                    <ThemedText style={styles.option_text}>
                        Delete program.
                    </ThemedText>

                </TouchableOpacity>
            </View>


        </ThemedBottomSheet>

        <ThemedModal
            visible={deleteConfirmModal_visible}
            onClose={() => {
                if (isDeletingProgram) {
                    return;
                }

                set_DeleteConfirmModal_visible(false);
            }}
            dismissOnBackdropPress={!isDeletingProgram}
            style={styles.confirm_modal}>

            <View style={styles.confirm_sheet_header}>
                <ThemedTitle type={"h3"} style={styles.confirm_sheet_title}>
                    Delete program?
                </ThemedTitle>

                <ThemedText style={styles.confirm_sheet_description}>
                    Are you sure you want to delete this program? This will remove the full program structure and cannot be undone.
                </ThemedText>
            </View>

            <View style={styles.confirm_sheet_actions}>
                <TouchableOpacity
                    style={[
                        styles.confirm_action,
                        styles.confirm_action_secondary,
                        {
                            borderColor: theme.cardBorder,
                            opacity: isDeletingProgram ? 0.6 : 1,
                        },
                    ]}
                    disabled={isDeletingProgram}
                    onPress={() => set_DeleteConfirmModal_visible(false)}>
                    <ThemedText style={styles.confirm_action_secondary_text}>
                        Cancel
                    </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.confirm_action,
                        styles.confirm_action_danger,
                        {
                            backgroundColor: theme.danger,
                            opacity: isDeletingProgram ? 0.7 : 1,
                        },
                    ]}
                    disabled={isDeletingProgram}
                    onPress={deleteProgram}>
                    <ThemedText style={styles.confirm_action_danger_text}>
                        {isDeletingProgram ? "Deleting..." : "Delete program"}
                    </ThemedText>
                </TouchableOpacity>
            </View>

        </ThemedModal>

        <StartProgramModal
            visible={startProgramModal_visible}
            onClose={() => {
                if (!isStartingProgram) {
                    setStartProgramModalVisible(false);
                }
            }}
            onStart={startProgram}
            isStarting={isStartingProgram}
        />

        <ThemedBottomSheet
            visible={prSettingsBottomsheet_visible}
            onClose={() => set_prSettingsBottomsheet_visible(false)}>

            <View style={styles.bottomsheet_title}>
                <ThemedTitle type={"h3"} style={{flex: 10}}>
                    Filter exercises
                </ThemedTitle>
            </View>

            <View style={styles.bottomsheet_body}>
                {programExercises.length === 0 && (
                    <ThemedText>
                        No exercises in this program yet.
                    </ThemedText>
                )}

                {programExercises.map((exerciseName, index) => (
                    <TouchableOpacity
                        key={exerciseName}
                        style={[
                            styles.option,
                            styles.filter_option,
                            index < programExercises.length - 1 && styles.filter_option_divider,
                            index < programExercises.length - 1 && {
                                borderBottomColor: theme.hairline,
                            },
                            !(visibleProgramBestExercises[exerciseName] ?? true) &&
                                styles.filter_option_unselected,
                        ]}
                        onPress={() => toggleProgramBestExercise(exerciseName)}>
                        <ThemedText
                            style={[
                                styles.filter_option_text,
                                (visibleProgramBestExercises[exerciseName] ?? true)
                                    ? styles.filter_option_text_selected
                                    : styles.filter_option_text_unselected,
                            ]}>
                            {exerciseName}
                        </ThemedText>

                        {(visibleProgramBestExercises[exerciseName] ?? true) && (
                            <Checkmark
                                width={24}
                                height={24} />
                        )}
                    </TouchableOpacity>
                ))}
            </View>

        </ThemedBottomSheet>
        </>
  );
};

export default ProgramOverviewPage;
