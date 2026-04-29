import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "../../Resources/GlobalStyling/colors";

import styles from './ProgramOverviewPageStyle';
import {
  programService,
  weightliftingService,
} from "../../Services";
import Rm_List from './Components/rm_list/rm_list';

import AddEstimatedSet from './Components/rm_list/Components/AddEstimatedSet/AddEstimatedSet';
import MesocycleList from "./Components/MesocycleList/MesocycleList";
import ThreeDots from "../../Resources/Icons/UI-icons/ThreeDots"
import Cogwheel from "../../Resources/Icons/UI-icons/Cogwheel";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Fire from "../../Resources/Icons/UI-icons/Fire";
import TradeUp from "../../Resources/Icons/UI-icons/TradeUp";
import Info from "../../Resources/Icons/UI-icons/Info";

import { ThemedTitle, 
        ThemedCard, 
        ThemedView, 
        ThemedText, 
        ThemedButton, 
        ThemedHeader,
        ThemedBottomSheet, 
        ThemedModal,
        ThemedEditableCell} 
  from "../../Resources/ThemedComponents";
import Delete from '../../Resources/Icons/UI-icons/Delete';
import { formatDate, parseCustomDate } from '../../Utils/dateUtils';

const emptyProgramStats = {
    totalVolume: 0,
    avgSessionMinutes: 0,
    completionPercent: 0,
    completedWorkouts: 0,
    totalWorkouts: 0,
    streakWeeks: 0,
};

function formatStatNumber(value) {
    const numberValue = Number(value) || 0;

    return Math.round(numberValue)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const ProgramOverviewPage = ( {route} ) => {
    const db = useSQLiteContext();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? Colors.light;

    const program_id = route.params.program_id;
    const start_date = route.params.start_date;
    const initialProgramName = route.params.program_name ?? "";

    const [addEstimatedSet_visible, set_AddEstimatedSet_visible] = useState(false);
    const [refreshKey, set_refreshKey] = useState(0);
    const [status, set_status] = useState("NOT_STARTED");
    const [program_name, set_program_name] = useState(initialProgramName);
    const [end_date, set_end_date] = useState("");
    const [programExercises, set_programExercises] = useState([]);
    const [visibleProgramBestExercises, set_visibleProgramBestExercises] = useState({});
    const [programExerciseBests, set_programExerciseBests] = useState([]);
    const [programStats, setProgramStats] = useState(emptyProgramStats);

    const [OptionsBottomsheet_visible, set_OptionsBottomsheet_visible] = useState(false);
    const [prSettingsBottomsheet_visible, set_prSettingsBottomsheet_visible] = useState(false);
    const [deleteConfirmModal_visible, set_DeleteConfirmModal_visible] = useState(false);
    const [isDeletingProgram, set_IsDeletingProgram] = useState(false);

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
                ]);
                const nextEndDate = await calculateEndDay();
                set_end_date(nextEndDate);
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

    const changeStatus = async (new_status) => {
        await programService.updateProgramStatus(db, {
            programId: program_id,
            status: new_status,
        });
        set_status(new_status);
    }

    const calculateEndDay = async () => {
        const result = await programService.getProgramDayCount(db, program_id);

        const start = parseCustomDate(start_date);
        const end = new Date(start);
        end.setDate(end.getDate() + result.total_days);
        return formatDate(end)
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
    const accentSoft = theme.primaryLight ?? "rgba(247, 116, 46, 0.18)";
    const successSoft = theme.secondaryLight ?? "rgba(96, 218, 172, 0.18)";
    const emptyTileBackground = theme.uiBackground ?? "rgba(255, 255, 255, 0.04)";
    const tileTextColor = theme.cardBackground ?? theme.textInverted ?? theme.text;
    const badgeBackground = theme.cardBackground ?? "#1b1918";
    const badgeTextColor = theme.text ?? "#d4d4d4";
    const emptyBorder = theme.cardBorder ?? theme.iconColor ?? "#383838";
    const estimatedBadgeBackground = theme.primary ?? accentSoft;
    const estimatedBadgeText = theme.cardBackground ?? theme.textInverted ?? "#201e2b";
    const detailPanelBackground =
        colorScheme === "dark"
            ? "rgba(14, 15, 18, 0.18)"
            : "rgba(255, 255, 255, 0.65)";
    const filterDividerColor =
        colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.08)";
    const settingsLabelColor =
        theme.quietText ??
        (colorScheme === "dark"
            ? "rgba(212, 212, 212, 0.72)"
            : "rgba(32, 30, 43, 0.66)");
    const quietText = theme.iconColor ?? settingsLabelColor;
    const titleColor = theme.title ?? theme.text ?? "#fff";
    const settingsOutlineColor =
        theme.cardBorder ??
        (colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.08)");
    const settingsPanelBackground =
        colorScheme === "dark"
            ? "rgba(255, 255, 255, 0.04)"
            : "rgba(255, 255, 255, 0.68)";
    const settingsEditorBackground =
        colorScheme === "dark"
            ? "rgba(14, 15, 18, 0.56)"
            : "rgba(255, 255, 255, 0.84)";
    const settingsSelectedTextColor =
        colorScheme === "dark"
            ? theme.cardBackground ?? theme.textInverted ?? "#1b1918"
            : theme.title ?? "#201e2b";
    const statusOptions = [
        {
            value: "NOT_STARTED",
            label: "Not started",
            description: "Keep the program staged until you are ready to begin.",
            color: theme.NOT_STARTED ?? "#9E9E9E",
            surface:
                colorScheme === "dark"
                    ? "rgba(158, 158, 158, 0.20)"
                    : "rgba(158, 158, 158, 0.14)",
        },
        {
            value: "ACTIVE",
            label: "Active",
            description: "Use this while the program is active and sessions are in progress.",
            color: theme.ACTIVE ?? theme.primary ?? "#f7742e",
            surface: accentSoft,
        },
        {
            value: "COMPLETE",
            label: "Complete",
            description: "Mark the cycle as finished when the final week is done.",
            color: theme.COMPLETE ?? theme.secondary ?? "#60daac",
            surface: successSoft,
        },
    ];
    const currentStatusOption =
        statusOptions.find((option) => option.value === status) ?? statusOptions[0];
    const headerTitle = (program_name ?? "").trim() || "Program";
    const statsCardBackground =
        colorScheme === "dark"
            ? "#171a21"
            : settingsPanelBackground;
    const statsCards = [
        {
            label: "Total volume",
            value: formatStatNumber(programStats.totalVolume),
            detail: "kg lifted",
            Icon: TradeUp,
            color: theme.primary ?? "#f7742e",
        },
        {
            label: "Avg session",
            value: String(programStats.avgSessionMinutes),
            detail: "min per workout",
            Icon: Info,
            color: quietText,
        },
        {
            label: "Completion",
            value: `${programStats.completionPercent}%`,
            detail: `${programStats.completedWorkouts} of ${programStats.totalWorkouts}`,
            Icon: Checkmark,
            color: quietText,
        },
        {
            label: "Streak",
            value: String(programStats.streakWeeks),
            detail: `${programStats.streakWeeks === 1 ? "week" : "weeks"} active`,
            Icon: Fire,
            color: theme.primary ?? "#f7742e",
        },
    ];

  return (
    <>
    <ThemedView safe={["top", "left", "right"]}>
        <ThemedHeader
            right={
                <TouchableOpacity onPress={() => {
                    set_OptionsBottomsheet_visible(true) }}>
                    <ThreeDots width={20} height={20} />
                </TouchableOpacity> } >
            <View style={styles.page_header_title_group}>
                <ThemedText
                    size={10}
                    style={[
                        styles.page_header_title_eyebrow,
                        { color: settingsLabelColor },
                    ]}>
                    Program overview
                </ThemedText>

                <ThemedTitle
                    type="h3"
                    style={styles.page_header_title_main}
                    numberOfLines={1}>
                    {headerTitle}
                </ThemedTitle>
            </View>
        
        </ThemedHeader>

        <ScrollView 
            style={styles.container}
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: insets.bottom + 15}}>

            <View style={styles.stats_section}>
                <ThemedText
                    style={styles.stats_section_label}
                    setColor={quietText}>
                    Stats
                </ThemedText>

                <View style={styles.stats_grid}>
                    {statsCards.map((stat, index) => {
                        const Icon = stat.Icon;

                        return (
                            <View
                                key={stat.label}
                                style={[
                                    styles.stats_card,
                                    index % 2 === 0 && styles.stats_card_left,
                                    index > 1 && styles.stats_card_second_row,
                                    {
                                        backgroundColor: statsCardBackground,
                                        borderColor: settingsOutlineColor,
                                    },
                                ]}>
                                <View style={styles.stats_card_header}>
                                    <Icon
                                        width={14}
                                        height={14}
                                        color={stat.color}
                                        stroke={stat.color}
                                        thickness={1.7}
                                    />
                                    <ThemedText
                                        style={styles.stats_card_label}
                                        setColor={quietText}
                                        numberOfLines={1}>
                                        {stat.label}
                                    </ThemedText>
                                </View>

                                <ThemedText
                                    style={styles.stats_card_value}
                                    setColor={titleColor}
                                    numberOfLines={1}>
                                    {stat.value}
                                </ThemedText>
                                <ThemedText
                                    style={styles.stats_card_detail}
                                    setColor={quietText}
                                    numberOfLines={1}>
                                    {stat.detail}
                                </ThemedText>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Mesocycle list */}
            <ThemedView style={styles.mesocycle_container}>
                    <MesocycleList 
                        program_id = {program_id}
                        start_date={start_date}
                        refreshKey= {refreshKey} 
                        refresh={refresh}/>
            </ThemedView>

            {/* Program PR's */}
            <View style={styles.section_header}>
                <ThemedTitle type="h2"> Program bests </ThemedTitle>

                <TouchableOpacity
                    style={styles.section_header_icon}
                    onPress={() => set_prSettingsBottomsheet_visible(true)}>
                    <Cogwheel
                        width={24}
                        height={24} />
                </TouchableOpacity>
            </View>
            {programExercises.length === 0 && (
                <ThemedText>
                    No exercises in this program yet.
                </ThemedText>
            )}

            {programExercises.length > 0 && selectedProgramBestExercises.length === 0 && (
                <ThemedText>
                    No exercises selected.
                </ThemedText>
            )}

            {selectedProgramBestExercises.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.pr_scroll}
                    contentContainerStyle={styles.pr_body}>
                    {selectedProgramBestExercises.map((exerciseName, index) => {
                        const programBest = programExerciseBestMap[exerciseName];
                        const hasCompletedSet = Boolean(programBest);
                        const cardBackground = hasCompletedSet
                            ? index % 2 === 0
                                ? accentSoft
                                : successSoft
                            : emptyTileBackground;

                        return (
                            <ThemedCard
                                key={exerciseName}
                                style={[
                                    styles.pr_feature_card,
                                    {
                                        backgroundColor: cardBackground,
                                        borderColor: hasCompletedSet ? "transparent" : emptyBorder,
                                    },
                                ]}>
                                <View style={styles.pr_feature_header}>
                                    <View
                                        style={[
                                            styles.pr_feature_rank,
                                            { backgroundColor: badgeBackground },
                                        ]}>
                                        <ThemedText
                                            size={10}
                                            style={styles.pr_feature_rank_text}
                                            setColor={badgeTextColor}>
                                            {programBest?.performedDate
                                                ? `achieved on ${programBest.performedDate}`
                                                : "No PR"}
                                        </ThemedText>
                                    </View>

                                    <ThemedText
                                        size={20}
                                        style={styles.pr_feature_name}
                                        numberOfLines={2}
                                        setColor={hasCompletedSet ? tileTextColor : undefined}>
                                        {exerciseName}
                                    </ThemedText>
                                </View>

                                <View style={styles.pr_feature_body}>
                                    <View
                                        style={[
                                            styles.pr_feature_set_panel,
                                            { backgroundColor: detailPanelBackground },
                                        ]}>
                                        <ThemedText
                                            size={10}
                                            style={styles.pr_feature_set_label}
                                            setColor={hasCompletedSet ? tileTextColor : theme.quietText}>
                                            Best set
                                        </ThemedText>
                                        <ThemedText
                                            size={12}
                                            style={
                                                hasCompletedSet
                                                    ? styles.pr_feature_set_value
                                                    : styles.pr_feature_set_empty
                                            }
                                            setColor={hasCompletedSet ? tileTextColor : theme.quietText}>
                                            {programBest?.setDisplayValue ?? "No completed sets."}
                                        </ThemedText>
                                    </View>

                                    <View style={styles.pr_feature_footer}>
                                        <ThemedText
                                            size={30}
                                            style={styles.pr_feature_rm_value}
                                            setColor={hasCompletedSet ? tileTextColor : theme.quietText}>
                                            {programBest?.rmDisplayValue ?? "--"}
                                        </ThemedText>
                                        {programBest?.isEstimated && (
                                            <View
                                                style={[
                                                    styles.pr_feature_estimated_badge,
                                                    { backgroundColor: estimatedBadgeBackground },
                                                ]}>
                                                <ThemedText
                                                    size={10}
                                                    style={styles.pr_feature_estimated_text}
                                                    setColor={estimatedBadgeText}>
                                                    {programBest.estimatedLabel}
                                                </ThemedText>
                                            </View>
                                        )}
                                        <ThemedText
                                            size={10}
                                            style={styles.pr_feature_rm_label}
                                            setColor={hasCompletedSet ? tileTextColor : theme.quietText}>
                                            1 Rep Max
                                        </ThemedText>
                                    </View>
                                </View>
                            </ThemedCard>
                        );
                    })}
                </ScrollView>
            )}

            {/* 1 rm estimates. */}
            <ThemedTitle type="h2"> Estimated 1 RM's </ThemedTitle>
            <ThemedCard style={styles.rm_container}>

                <View style={styles.rm_body}>
                    <Rm_List
                        program_id = {program_id}
                        refreshKey = {refreshKey}
                        refresh = {refresh}
                        programExerciseBestMap={programExerciseBestMap} />
                </View>

                <View style={styles.rm_footer}>
                    <ThemedButton 
                        title="Add 1 RM" 
                        onPress={() => set_AddEstimatedSet_visible(true)}/>

                    <AddEstimatedSet 
                        visible={addEstimatedSet_visible}
                        onClose={() => set_AddEstimatedSet_visible(false)}
                        onSubmit={handleAdd}
                        programExerciseBestMap={programExerciseBestMap}/>
                </View>
            </ThemedCard>

            {/* Program setting and status */}
            <ThemedTitle type="h2"> Settings </ThemedTitle>
            <ThemedCard style={styles.settings_card}>
                <View style={styles.settings_section}>
                    <View style={styles.settings_section_header}>
                        <ThemedText
                            size={11}
                            style={[
                                styles.settings_section_eyebrow,
                                { color: settingsLabelColor },
                            ]}>
                            Program status
                        </ThemedText>
                    </View>

                    {statusOptions.map((option) => {
                        const isSelected = status === option.value;

                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.settings_status_tile,
                                    {
                                        backgroundColor: isSelected
                                            ? option.surface
                                            : settingsPanelBackground,
                                        borderColor: isSelected
                                            ? option.color
                                            : settingsOutlineColor,
                                    },
                                ]}
                                onPress={() => changeStatus(option.value)}>
                                <View
                                    style={[
                                        styles.settings_status_marker,
                                        { backgroundColor: option.color },
                                    ]}
                                />

                                <View style={styles.settings_status_content}>
                                    <ThemedText
                                        size={16}
                                        style={styles.settings_status_title}
                                        setColor={
                                            isSelected
                                                ? settingsSelectedTextColor
                                                : theme.title
                                        }>
                                        {option.label}
                                    </ThemedText>

                                    <ThemedText
                                        size={12}
                                        style={styles.settings_status_description}
                                        setColor={
                                            isSelected
                                                ? settingsSelectedTextColor
                                                : settingsLabelColor
                                        }>
                                        {option.description}
                                    </ThemedText>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.settings_section}>
                    <View style={styles.settings_section_header}>
                        <ThemedText
                            size={11}
                            style={[
                                styles.settings_section_eyebrow,
                                { color: settingsLabelColor },
                            ]}>
                            Period
                        </ThemedText>
                    </View>

                    <View
                        style={[
                            styles.settings_period_panel,
                            {
                                backgroundColor: settingsPanelBackground,
                                borderColor: settingsOutlineColor,
                            },
                        ]}>
                        <View style={styles.settings_period_row}>
                            <View style={styles.settings_period_block}>
                                <ThemedText
                                    size={10}
                                    style={styles.settings_period_label}
                                    setColor={settingsLabelColor}>
                                    Start
                                </ThemedText>
                                <ThemedText
                                    size={14}
                                    style={styles.settings_period_value}
                                    setColor={theme.title}>
                                    {start_date}
                                </ThemedText>
                            </View>

                            <View
                                style={[
                                    styles.settings_period_divider,
                                    { backgroundColor: settingsOutlineColor },
                                ]}
                            />

                            <View style={styles.settings_period_block}>
                                <ThemedText
                                    size={10}
                                    style={styles.settings_period_label}
                                    setColor={settingsLabelColor}>
                                    End
                                </ThemedText>
                                <ThemedText
                                    size={14}
                                    style={styles.settings_period_value}
                                    setColor={theme.title}>
                                    {end_date || "-"}
                                </ThemedText>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.settings_section_last}>
                    <View style={styles.settings_section_header}>
                        <ThemedText
                            size={11}
                            style={[
                                styles.settings_section_eyebrow,
                                { color: settingsLabelColor },
                            ]}>
                            Program name
                        </ThemedText>
                        <ThemedText
                            size={12}
                            style={{ color: settingsLabelColor }}>
                            Click to rename
                        </ThemedText>
                    </View>

                    <View
                        style={[
                            styles.settings_name_editor,
                            {
                                backgroundColor: settingsEditorBackground,
                                borderColor: settingsOutlineColor,
                            },
                        ]}>
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
                </View>
            </ThemedCard>

            
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
                            borderColor: settingsOutlineColor,
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
                            backgroundColor: theme.danger ?? "#ba0000",
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
                                borderBottomColor: filterDividerColor,
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
