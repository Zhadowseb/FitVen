import { StyleSheet } from "react-native";

export default StyleSheet.create({

    container: {
        flexDirection: "row",
        width: "100%",
    },

    wrapper: {
        marginHorizontal: 0,
        marginVertical: 0,
        width: "100%",
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 0,
        borderRadius: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderWidth: 1,
        overflow: "hidden",
    },

    titleRow: {
        minHeight: 30,
        borderBottomWidth: 1,
    },

    setRow: {
        minHeight: 48,
        borderBottomWidth: 1,
    },

    padding: {
        paddingHorizontal: 3,
    },
    note: {
        flex: 9,
        minWidth: 0,
    },
    pause: {
        flex: 20,
    },
    set:    {
        flex: 6,
        maxWidth: 34,
        paddingTop: 0,
        paddingBottom: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    reps:   {flex: 13},
    weight: {flex: 20},
    rpe:    {flex: 9},
    rm_percentage: {flex: 14},
    done:   {flex: 10, maxWidth: 33},

    override: {
        borderLeftWidth: 0,
        borderBottomColor: "#555555ff",
        borderBottomWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    titleCell: {
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 2,
    },

    titleText: {
        fontWeight: "800",
        fontSize: 9,
        letterSpacing: 0.8,
    },


    editableInput: {
        borderWidth: 1,
        paddingVertical: 1,
        textAlign: "center",
        fontSize: 14,
    },

    input: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 7,
    },
    widthPause: {
        minWidth: 35,
    },
    widthReps: {
        minWidth: 35,
    },
    widthRPE: {
        minWidth: 35,
    },
    widthWeight: {
        minWidth: 45,
    },

    editable_cell: {
        justifyContent: "center",
        alignItems: "center",
    },
    lastGrid: {
        borderBottomWidth: 0,
    },
    valuePill: {
        width: "94%",
        height: 30,
        borderRadius: 9,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },

    bottomsheet_title: {
        borderBottomWidth: 1,
        borderBottomColor: "#2e2e2eff",
        paddingBottom: 20,
    },
    bottomsheet_body: {
        justifyContent: "center",
        padding: 20,
        paddingLeft: 0,
    },
    option: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 20,
    },
    option_text: {
        paddingLeft: 10,
        fontWeight: 600,
        fontSize: 16,
    },
    note_button: {
        justifyContent: "center",
        alignItems: "center",
        width: 30,
        height: 30,
        borderRadius: 9,
    },
    set_chip: {
        width: 28,
        height: 30,
        borderRadius: 9,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    set_chip_text: {
        fontWeight: "800",
        fontSize: 13,
    },
    addSetRow: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        minHeight: 36,
    },
    addSetIconCell: {
        width: 28,
        height: 30,
        justifyContent: "center",
        alignItems: "center",
    },
    addSetActions: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    note_input: {
        minHeight: 100,
        textAlignVertical: "top",
    },
    note_section: {
        paddingBottom: 12,
    },
    restUnitModal: {
        width: "82%",
        maxWidth: 340,
    },
    restUnitModalContent: {
        flexGrow: 0,
    },
    restUnitToggle: {
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        padding: 4,
        flexDirection: "row",
        overflow: "hidden",
    },
    restUnitOption: {
        flex: 1,
        minWidth: 0,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
    },
    restUnitOptionText: {
        fontSize: 13,
        lineHeight: 16,
        fontWeight: "800",
    },


});
