import { StyleSheet } from "react-native";

export default StyleSheet.create({
  heroShell: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 18,
    marginBottom: 18,
  },

  heroCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroStatusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  heroStartedValue: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  heroTimerBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
    paddingBottom: 2,
  },

  heroTimerValue: {
    fontSize: 56,
    lineHeight: 56,
    fontWeight: "200",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },

  heroTimerLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },

  heroSetsBlock: {
    gap: 7,
  },

  heroSetsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },

  heroSetsCount: {
    flexDirection: "row",
    alignItems: "baseline",
  },

  heroSetsCountDone: {
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  heroSetsCountTotal: {
    fontSize: 12,
    fontWeight: "700",
  },

  heroWorkoutInstanceLabel: {
    fontSize: 12,
    fontWeight: "800",
  },

  heroSegmentBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  heroSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },

  heroSegmentGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },

  heroActionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  heroActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  heroActionSecondary: {
    borderWidth: 1,
  },

  heroActionPrimary: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 6,
  },

  heroPlayIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },

  heroPauseIcon: {
    width: 11,
    height: 13,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  heroPauseBar: {
    width: 4,
    height: 13,
    borderRadius: 2,
  },

  heroActionText: {
    fontSize: 14,
    fontWeight: "800",
  },

  toolbar: {
    alignSelf: "center",
    width: "95%",
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  toolbarLabel: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingLeft: 2,
  },

  toolbarLabelText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },

  toolbarLabelNumber: {
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  toolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  workingSets: {
    width: "100%",
    paddingBottom: 24,
  },
});
