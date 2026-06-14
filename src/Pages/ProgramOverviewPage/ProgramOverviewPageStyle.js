import { StyleSheet } from 'react-native';

export default StyleSheet.create({

    //Main type styling.

    container_header:{
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        minHeight: 50,
        padding: 16,
        backgroundColor: "#d7d7d7ff",
        borderColor: "#000000ff",
        borderWidth: 1,
        borderBottomWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    //Main containers flex
    container: {
        padding: 16,
        paddingBottom: 100,
    },
    day_container: {
        padding: 0,
        minHeight: 120,
        marginBottom: 12,
    },
    rm_container: {
        padding: 0,
        minHeight: 400,
        marginBottom: 12,
    },
    mesocycle_container: {
        padding: 0,
        minHeight: 50,
        marginBottom: 4,
    },
    pr_scroll: {
        marginBottom: 12,
    },
    pr_body: {
        paddingTop: 8,
        paddingLeft: 2,
        paddingRight: 16,
        flexGrow: 1,
    },
    pr_feature_card: {
        width: 236,
        minHeight: 176,
        padding: 0,
        overflow: "hidden",
        borderWidth: 1.5,
        marginRight: 12,
    },
    pr_feature_header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
    },
    pr_feature_rank: {
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 10,
    },
    pr_feature_rank_text: {
        fontWeight: "700",
        letterSpacing: 0.8,
    },
    pr_feature_name: {
        fontWeight: "700",
        lineHeight: 24,
    },
    pr_feature_body: {
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 10,
        justifyContent: "flex-start",
    },
    pr_feature_set_panel: {
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    pr_feature_set_label: {
        letterSpacing: 0.8,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    pr_feature_set_value: {
        lineHeight: 18,
    },
    pr_feature_set_empty: {
        lineHeight: 18,
    },
    pr_feature_footer: {
        marginTop: 6,
    },
    pr_feature_rm_value: {
        fontWeight: "700",
    },
    pr_feature_estimated_badge: {
        alignSelf: "flex-start",
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 4,
    },
    pr_feature_estimated_text: {
        fontWeight: "700",
    },
    pr_feature_rm_label: {
        marginTop: 4,
    },
    pr_exercise_tile_name: {
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 4,
    },
    pr_exercise_tile_set: {
        textAlign: "center",
        lineHeight: 16,
    },
    pr_exercise_tile_empty: {
        textAlign: "center",
        lineHeight: 16,
    },
    pr_exercise_tile_rm_label: {
        textAlign: "center",
        marginTop: 4,
    },
    pr_exercise_tile_rm_value: {
        textAlign: "center",
        fontWeight: "700",
    },
    pr_header: {
        alignItems: "flex-end",
        borderBottomWidth: 1,
        borderBottomColor: "#2e2e2eff",
        paddingBottom: 8,
        marginBottom: 4,
    },
    pr_header_value: {
        textAlign: "right",
    },
    stats_section: {
        marginBottom: 18,
    },
    stats_section_label: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "800",
        letterSpacing: 3,
        textTransform: "uppercase",
        marginBottom: 12,
    },
    stats_grid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    stats_card: {
        width: "48.5%",
        minHeight: 120,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    stats_card_left: {
        marginRight: "3%",
    },
    stats_card_header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    stats_card_label: {
        flex: 1,
        minWidth: 0,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: "800",
        letterSpacing: 1.8,
        textTransform: "uppercase",
        marginLeft: 7,
    },
    stats_card_value: {
        fontSize: 24,
        lineHeight: 29,
        fontWeight: "800",
        marginBottom: 4,
    },
    stats_card_detail: {
        fontSize: 13,
        lineHeight: 17,
        fontWeight: "600",
    },
    delete_button_container: {
        minHeight: 50,
        marginBottom: 12,
        backgroundColor: "#fff",
        paddingHorizontal: 20,
        padding: 16,
    },

    //RM containers
    rm_body: {
        flex: 300,
    },

    rm_footer: {
        padding: 16,
        alignItems: 'center',
        flex: 1,
    },

    //Mesocycle containers


    //PR containers
    section_header: {
        flexDirection: "row",
        alignItems: "center",
    },
    section_header_icon: {
        marginLeft: "auto",
        marginRight: 8,
    },
    settings_card: {
        padding: 18,
    },
    settings_section: {
        marginBottom: 18,
    },
    settings_section_last: {
        marginBottom: 4,
    },
    settings_section_header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    settings_section_eyebrow: {
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    settings_status_tile: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 16,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "flex-start",
    },
    settings_status_marker: {
        width: 10,
        height: 10,
        borderRadius: 999,
        marginTop: 6,
        marginRight: 12,
        flexShrink: 0,
    },
    settings_status_content: {
        flex: 1,
        paddingRight: 10,
    },
    settings_status_title: {
        fontWeight: "700",
        marginBottom: 4,
    },
    settings_status_description: {
        lineHeight: 18,
    },
    settings_period_panel: {
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    settings_period_row: {
        flexDirection: "row",
        alignItems: "center",
    },
    settings_period_block: {
        flex: 1,
    },
    settings_period_label: {
        fontWeight: "700",
        letterSpacing: 0.8,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    settings_period_value: {
        fontWeight: "700",
    },
    settings_period_divider: {
        width: 1,
        alignSelf: "stretch",
        marginHorizontal: 14,
    },
    settings_name_editor: {
        minHeight: 58,
        borderWidth: 1,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 14,
        justifyContent: "center",
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
