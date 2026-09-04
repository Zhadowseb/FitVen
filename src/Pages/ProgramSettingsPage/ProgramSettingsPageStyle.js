import { StyleSheet } from "react-native";

export default StyleSheet.create({
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerBack: {
        width: 38,
        height: 38,
        alignItems: "flex-start",
        justifyContent: "center",
        flexShrink: 0,
    },
    headerCenter: {
        flex: 1,
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "800",
        lineHeight: 28,
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 38,
    },

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
    section_header_eyebrow: {
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.4,
        textTransform: "uppercase",
    },
    card_shell: {
        borderWidth: 1,
        borderRadius: 18,
        overflow: "hidden",
    },

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
        fontSize: 13,
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
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
    },
    settings_name_value: {
        flex: 1,
        fontSize: 13,
        fontWeight: "700",
    },
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
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    settings_period_block: {
        flex: 1,
    },
    settings_period_label: {
        fontSize: 11,
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
    delete_row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    settings_export_row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderRadius: 10,
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
        fontSize: 13,
        fontWeight: "700",
    },
    settings_export_description: {
        fontSize: 11,
        marginTop: 2,
    },
});
