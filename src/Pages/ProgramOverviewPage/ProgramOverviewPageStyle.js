import { StyleSheet } from 'react-native';

export default StyleSheet.create({

    //Header
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerCircleButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    headerCenter: {
        flex: 1,
        alignItems: "center",
        gap: 1,
    },
    headerEyebrow: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.8,
        textTransform: "uppercase",
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "800",
    },

    //Main containers flex
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 18,
        gap: 22,
    },

    section: {
        gap: 12,
    },
    section_header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    section_header_eyebrow: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.8,
        textTransform: "uppercase",
    },
    section_header_icon: {
        padding: 2,
    },
    card_shell: {
        borderWidth: 1,
        borderRadius: 20,
        overflow: "hidden",
    },

    //Program bests
    pr_row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 18,
        paddingVertical: 15,
    },
    pr_star_tile: {
        width: 38,
        height: 38,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
    },
    pr_info: {
        flex: 1,
        minWidth: 0,
        gap: 1,
    },
    pr_name: {
        fontSize: 15,
        fontWeight: "800",
    },
    pr_subtitle: {
        fontSize: 11,
        fontWeight: "600",
    },
    pr_value_group: {
        alignItems: "flex-end",
    },
    pr_value: {
        fontSize: 17,
        fontWeight: "800",
        fontVariant: ["tabular-nums"],
    },
    pr_value_label: {
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    pr_divider: {
        height: 1,
        marginHorizontal: 18,
    },
    pr_empty: {
        paddingHorizontal: 18,
        paddingVertical: 18,
    },

    //RM containers
    rm_container: {
        padding: 0,
    },

    //Settings
    settings_status_label_wrap: {
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 4,
    },
    settings_status_label: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    settings_status_row: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingHorizontal: 18,
        paddingVertical: 11,
    },
    settings_radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
        flexShrink: 0,
    },
    settings_radio_dot: {
        width: 9,
        height: 9,
        borderRadius: 5,
    },
    settings_status_text: {
        flex: 1,
        gap: 1,
    },
    settings_status_title: {
        fontSize: 13.5,
        fontWeight: "800",
    },
    settings_status_description: {
        fontSize: 11,
        lineHeight: 15,
        fontWeight: "500",
    },
    settings_divider: {
        height: 1,
        marginTop: 4,
        marginHorizontal: 18,
    },
    settings_name_block: {
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 16,
        gap: 6,
    },
    settings_name_label: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    settings_name_field: {
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
    },
    settings_name_value: {
        flex: 1,
        fontSize: 14,
        fontWeight: "700",
    },

    //Period / export (kept, restyled to card language; not in mock)
    settings_period_block_wrap: {
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 16,
        gap: 8,
    },
    settings_period_row: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    settings_period_block: {
        flex: 1,
    },
    settings_period_label: {
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 4,
    },
    settings_period_value: {
        fontSize: 13,
        fontWeight: "700",
    },
    settings_period_divider: {
        width: 1,
        alignSelf: "stretch",
        marginHorizontal: 14,
    },
    settings_export_row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    settings_export_icon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    settings_export_content: {
        flex: 1,
        minWidth: 0,
    },
    settings_export_title: {
        fontSize: 13.5,
        fontWeight: "700",
    },
    settings_export_description: {
        fontSize: 11,
        marginTop: 2,
    },

    //BottomSheet Styling:

    bottomsheet_title: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#2e2e2eff",
        paddingBottom: 30,
    },
    bottomsheet_body: {
        justifyContent: "center",
        padding: 20,
        paddingLeft: 0,
    },

    option: {
        flexDirection: "row",
        paddingTop: 20,
    },
    option_text: {
        paddingLeft: 10,
        fontWeight: 600,
        fontSize: 16,
    },
    filter_option: {
        justifyContent: "space-between",
        alignItems: "center",
    },
    filter_option_divider: {
        borderBottomWidth: 1,
        paddingBottom: 14,
        marginBottom: 4,
    },
    filter_option_unselected: {
        opacity: 0.8,
    },
    filter_option_text: {
        fontWeight: 600,
        fontSize: 16,
    },
    filter_option_text_selected: {
        fontWeight: "700",
    },
    filter_option_text_unselected: {
        fontWeight: "400",
    },
    confirm_sheet_header: {
        gap: 10,
        alignItems: "center",
    },
    confirm_sheet_title: {
        textAlign: "center",
    },
    confirm_modal: {
        width: "88%",
        maxWidth: 420,
        borderRadius: 24,
        paddingTop: 22,
        paddingHorizontal: 18,
    },
    confirm_sheet_description: {
        fontSize: 14,
        lineHeight: 21,
        textAlign: "center",
    },
    confirm_sheet_actions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 24,
    },
    confirm_action: {
        flex: 1,
        minHeight: 52,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    confirm_action_secondary: {
        borderWidth: 1,
    },
    confirm_action_danger: {
        borderWidth: 1,
        borderColor: "transparent",
    },
    confirm_action_secondary_text: {
        fontSize: 15,
        fontWeight: "700",
        textAlign: "center",
    },
    confirm_action_danger_text: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
    },

});
