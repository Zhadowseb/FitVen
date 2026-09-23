import { StyleSheet } from "react-native";

export default StyleSheet.create({

    container: {
        flexDirection: "row",
        width: "100%",
    },

    wrapper: {
        width: "100%",
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 0,
        borderRadius: 14,
        borderWidth: 1,
        position: "relative",
        overflow: "hidden",
    },

    titleRow: {
        minHeight: 30,
        borderBottomWidth: 1,
    },

    setRow: {
        minHeight: 48,
        borderBottomWidth: 1,
        position: "relative",
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

    titleCell: {
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 2,
    },
    titleText: {
        fontWeight: "800",
        fontSize: 11,
        letterSpacing: 0.8,
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
        borderRadius: 6,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    restDividerOverlayRow: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 4,
    },
    restDividerOverlayCell: {
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    restDividerBubble: {
        width: 64,
        height: 32,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 5,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    restDividerValuePill: {
        width: "100%",
        height: "100%",
        borderRadius: 999,
    },
    restCountdownPill: {
        justifyContent: "center",
        alignItems: "center",
    },
    restCountdownText: {
        fontSize: 12,
        lineHeight: 15,
        fontWeight: "900",
        fontVariant: ["tabular-nums"],
        textAlign: "center",
    },

    note_button: {
        justifyContent: "center",
        alignItems: "center",
        width: 30,
        height: 30,
        borderRadius: 6,
    },
    set_chip: {
        width: 28,
        height: 30,
        borderRadius: 6,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    // A set's type, behind its row: a tint to the card's edges and a 3 dp
    // stripe down the left. Reaches past the table's 8 dp padding, which the
    // card's rounded, clipped edge then trims.
    rowTone: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: -8,
        right: -8,
        borderLeftWidth: 3,
    },
    set_chip_amrap: {
        position: "absolute",
        top: -5,
        right: -6,
    },
    // AMRAP's "/6+" and a drop set's "-17,5".
    typeNote: {
        fontSize: 9.5,
        fontWeight: "800",
    },
    dropDifference: {
        marginLeft: 3,
    },
    // Joins a drop set to the set above it, through the rest column.
    dropConnector: {
        position: "absolute",
        top: "-50%",
        bottom: "50%",
        left: "50%",
        width: 2,
        marginLeft: -1,
        borderRadius: 1,
    },
    // Same inset as the table, so a row's tint can still reach the edges.
    warmupBlock: {
        overflow: "hidden",
        marginHorizontal: -8,
        paddingHorizontal: 8,
    },
    warmupHeader: {
        height: 28,
        borderBottomWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 6,
        position: "relative",
    },
    warmupHeaderText: {
        flex: 1,
        fontSize: 9.5,
        fontWeight: "800",
        letterSpacing: 1.4,
        textTransform: "uppercase",
    },
    // Expand points down; this folds them up, so it points up. Sits over the
    // done column, where the folded row's chevron will be.
    warmupHeaderChevron: {
        width: 33,
        alignItems: "center",
        transform: [{ rotate: "180deg" }],
    },
    foldedWarmups: {
        position: "absolute",
        top: 0,
        left: 8,
        right: 8,
    },
    foldedBadgeStack: {
        width: 28,
        height: 30,
    },
    // The card behind: there is more than the one row shows.
    foldedBadgeBehind: {
        position: "absolute",
        top: -4,
        left: 4,
    },
    foldedValue: {
        fontSize: 13,
        fontWeight: "700",
    },
    foldedUnit: {
        fontSize: 11,
        fontWeight: "600",
    },
    undoToast: {
        marginTop: 8,
        minHeight: 42,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    undoToastText: {
        flex: 1,
        fontSize: 13,
        fontWeight: "700",
    },
    undoToastAction: {
        fontSize: 13,
        fontWeight: "900",
    },
    set_chip_record: {
        backgroundColor: "transparent",
        borderColor: "transparent",
    },
    set_chip_star: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    set_chip_text: {
        fontWeight: "800",
        fontSize: 13,
    },
    set_chip_text_record: {
        fontSize: 12,
        marginTop: -1,
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
    restUnitModal: {
        width: "82%",
        maxWidth: 340,
    },
    restUnitModalContent: {
        flexGrow: 0,
    },
    restSettingsSection: {
        gap: 8,
    },
    restSettingsLabel: {
        fontSize: 11,
        lineHeight: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 1.4,
    },
    restUnitToggle: {
        height: 44,
        borderRadius: 6,
        borderWidth: 1,
        padding: 4,
        flexDirection: "row",
        overflow: "hidden",
    },
    restUnitOption: {
        flex: 1,
        minWidth: 0,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    restUnitOptionText: {
        fontSize: 13,
        lineHeight: 16,
        fontWeight: "800",
    },
    restMirrorButton: {
        minHeight: 58,
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 9,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    restMirrorTextGroup: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    restMirrorTitle: {
        fontSize: 13,
        lineHeight: 17,
        fontWeight: "800",
    },
    restMirrorDescription: {
        marginTop: 3,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: "600",
    },
    restMirrorSwitch: {
        width: 42,
        height: 24,
        borderRadius: 999,
        padding: 3,
        justifyContent: "center",
    },
    restMirrorSwitchThumb: {
        width: 18,
        height: 18,
        borderRadius: 999,
    },
    restMirrorSwitchThumbActive: {
        alignSelf: "flex-end",
    },

});
