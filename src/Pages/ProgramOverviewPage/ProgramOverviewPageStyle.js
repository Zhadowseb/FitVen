import { StyleSheet } from 'react-native';

export default StyleSheet.create({

    headerCircleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
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
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.4,
        textTransform: "uppercase",
    },
    section_header_icon: {
        padding: 2,
    },
    card_shell: {
        borderWidth: 1,
        borderRadius: 18,
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
        borderRadius: 10,
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
        fontSize: 11,
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

    //BottomSheet Styling:

    bottomsheet_title: {
        flexDirection: "row",
        borderBottomWidth: 1,
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
        fontSize: 15,
    },
    filter_option_text_selected: {
        fontWeight: "700",
    },
    filter_option_text_unselected: {
        fontWeight: "400",
    },

});
