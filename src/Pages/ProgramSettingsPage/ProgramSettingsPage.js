import { Alert, TouchableOpacity, View, useColorScheme } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./ProgramSettingsPageStyle";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import ArrowLeft from "../../Resources/Icons/UI-icons/ArrowLeft";
import Copy from "../../Resources/Icons/UI-icons/Copy";
import Delete from "../../Resources/Icons/UI-icons/Delete";
import Pencil from "../../Resources/Icons/UI-icons/Pencil";
import StartProgramModal from "../ProgramOverviewPage/Components/StartProgramModal";
import {
    ThemedConfirmModal,
    ThemedEditableCell,
    ThemedKeyboardProtection,
    ThemedText,
    ThemedView,
} from "../../Resources/ThemedComponents";
import { programService, programTransferService } from "../../Services";
import { formatDate } from "../../Utils/dateUtils";
import { getProgramEndDate } from "../../Utils/programUtils";

const STATUS_OPTIONS = [
    {
        value: "NOT_STARTED",
        label: "Draft",
        description: "Build the program without a start date.",
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

/**
 * Program settings on their own screen. These used to sit at the bottom of the
 * overview next to the stats, where the status radios were one stray tap away
 * from putting an active program back into draft.
 */
const ProgramSettingsPage = ({ route }) => {
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

    const [status, set_status] = useState("NOT_STARTED");
    const [program_name, set_program_name] = useState(
        route.params.program_name ?? ""
    );
    const [start_date, set_start_date] = useState(route.params.start_date ?? "");
    const [end_date, set_end_date] = useState("");
    const [programDayCount, setProgramDayCount] = useState(0);
    const [startProgramModal_visible, setStartProgramModalVisible] = useState(false);
    const [isStartingProgram, setIsStartingProgram] = useState(false);
    const [isExportingProgram, setIsExportingProgram] = useState(false);
    const [deleteConfirmModal_visible, set_DeleteConfirmModal_visible] = useState(false);
    const [isDeletingProgram, set_IsDeletingProgram] = useState(false);

    const loadStatus = async () => {
        try {
            const result = await programService.getProgramStatus(db, program_id);
            set_status(result.status);
        } catch (error) {
            console.error(error);
        }
    };

    const loadName = async () => {
        try {
            const result = await programService.getProgramName(db, program_id);
            set_program_name(result.program_name);
        } catch (error) {
            console.error(error);
        }
    };

    const loadPeriod = async () => {
        try {
            const [dayCount, metadata] = await Promise.all([
                programService.getProgramDayCount(db, program_id),
                programService.getProgramMetadata(db, program_id),
            ]);
            const totalDays = Math.max(
                0,
                Math.trunc(Number(dayCount?.total_days) || 0)
            );
            const nextStartDate = metadata?.start_date ?? start_date;

            setProgramDayCount(totalDays);
            set_start_date(nextStartDate);
            set_end_date(getProgramEndDate(nextStartDate, totalDays));
        } catch (error) {
            console.error(error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const load = async () => {
                await Promise.all([loadStatus(), loadName(), loadPeriod()]);
            };

            load();
        }, [])
    );

    const changeStatus = async (new_status) => {
        try {
            await programService.updateProgramStatus(db, {
                programId: program_id,
                status: new_status,
            });
            set_status(new_status);
        } catch (error) {
            console.error("updateProgramStatus failed:", error);
        }
    };

    const handleStatusChange = (new_status) => {
        if (status === new_status) {
            return;
        }

        if (status === "NOT_STARTED" && new_status === "ACTIVE") {
            setStartProgramModalVisible(true);
            return;
        }

        changeStatus(new_status);
    };

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
        } catch (error) {
            console.error("startProgram failed:", error);
        } finally {
            setIsStartingProgram(false);
        }
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

    const deleteProgram = async () => {
        try {
            set_IsDeletingProgram(true);
            await programService.deleteProgram(db, program_id);
        } catch (error) {
            console.error("deleteProgram failed:", error);
            set_IsDeletingProgram(false);
            return;
        }

        set_IsDeletingProgram(false);
        set_DeleteConfirmModal_visible(false);
        navigation.replace("ProgramPage");
    };

    const isNotStarted = status === "NOT_STARTED";

    return (
        <>
            <ThemedView safe={["top", "left", "right"]}>
                <View
                    style={[
                        styles.headerRow,
                        { borderBottomColor: theme.hairline },
                    ]}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        hitSlop={12}
                        style={styles.headerBack}
                        onPress={() => navigation.goBack()}>
                        <ArrowLeft width={24} height={24} />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <ThemedText
                            style={styles.headerTitle}
                            setColor={theme.title}
                            numberOfLines={1}>
                            Program settings
                        </ThemedText>
                    </View>

                    <View style={styles.headerSpacer} />
                </View>

                <ThemedKeyboardProtection
                    scroll
                    bottomOffset={64}
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: insets.bottom + 15 },
                    ]}
                    scrollViewProps={{
                        style: styles.container,
                    }}>

                    <View style={styles.section}>
                        <ThemedText
                            style={styles.section_header_eyebrow}
                            setColor={theme.text}
                            numberOfLines={1}>
                            {(program_name ?? "").trim() || "Program"}
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

                            {STATUS_OPTIONS.map((option) => {
                                const isSelected = status === option.value;

                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: isSelected }}
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
                                    <Pencil
                                        width={15}
                                        height={15}
                                        color={theme.quietText}
                                        thickness={1.8}
                                    />
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
                                            {isNotStarted ? "Not scheduled" : start_date}
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
                                            {isNotStarted ? "Not scheduled" : end_date || "-"}
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
                                            FitVen program file
                                        </ThemedText>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <ThemedText
                            style={styles.section_header_eyebrow}
                            setColor={theme.danger}>
                            Danger zone
                        </ThemedText>

                        <TouchableOpacity
                            accessibilityRole="button"
                            style={[
                                styles.delete_row,
                                {
                                    backgroundColor: theme.cardBackground,
                                    borderColor: withAlpha(theme.danger, 0.35),
                                },
                            ]}
                            onPress={() => set_DeleteConfirmModal_visible(true)}>
                            <View
                                style={[
                                    styles.settings_export_icon,
                                    { backgroundColor: withAlpha(theme.danger, 0.14) },
                                ]}>
                                <Delete width={17} height={17} color={theme.danger} />
                            </View>

                            <View style={styles.settings_export_content}>
                                <ThemedText
                                    style={styles.settings_export_title}
                                    setColor={theme.danger}>
                                    Delete program
                                </ThemedText>
                                <ThemedText
                                    style={styles.settings_export_description}
                                    setColor={theme.quietText}>
                                    Removes the full program structure
                                </ThemedText>
                            </View>
                        </TouchableOpacity>
                    </View>

                </ThemedKeyboardProtection>
            </ThemedView>

            <ThemedConfirmModal
                visible={deleteConfirmModal_visible}
                title="Delete program?"
                message="This removes the full program structure and cannot be undone."
                confirmLabel={isDeletingProgram ? "Deleting..." : "Delete program"}
                tone="danger"
                isWorking={isDeletingProgram}
                onConfirm={deleteProgram}
                onClose={() => {
                    if (!isDeletingProgram) {
                        set_DeleteConfirmModal_visible(false);
                    }
                }}
            />

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
        </>
    );
};

export default ProgramSettingsPage;
