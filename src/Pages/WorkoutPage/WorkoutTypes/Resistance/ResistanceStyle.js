import { StyleSheet } from "react-native";

export default StyleSheet.create({
  heroShell: {
    width: "95%",
    alignSelf: "center",
    marginTop: 2,
    marginBottom: 12,
  },

  heroCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 0,
  },

  heroStatusInline: {
    flexDirection: "row",
    alignItems: "center",
  },

  heroStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 9,
  },

  heroStatusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },

  heroStartedBlock: {
    position: "absolute",
    right: 0,
    alignItems: "flex-end",
  },

  heroStartedLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  heroStartedValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  heroWorkoutInstanceLabel: {
    flex: 1,
    maxWidth: "58%",
    paddingRight: 12,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: "800",
  },

  heroTimerValue: {
    fontSize: 48,
    lineHeight: 54,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  heroTimerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginTop: 4,
  },

  heroSetsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 0,
    marginBottom: 9,
  },

  heroSetsBlock: {
    alignItems: "flex-end",
  },

  heroSetsLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginLeft: 8,
  },

  heroSetsCount: {
    flexDirection: "row",
    alignItems: "baseline",
  },

  heroSetsCountDone: {
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  heroSetsCountTotal: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  heroProgressTrack: {
    width: "100%",
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
  },

  heroProgressFill: {
    height: "100%",
    minWidth: 0,
    borderRadius: 999,
  },

  heroActionsRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },

  heroActionButton: {
    flex: 1,
    flexBasis: 0,
    minHeight: 52,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  heroActionPrimary: {},

  heroActionSecondary: {},

  heroPlayIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 12,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginRight: 12,
  },

  heroPauseIcon: {
    width: 14,
    height: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    marginRight: 12,
  },

  heroPauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },

  heroActionText: {
    fontSize: 15,
    fontWeight: "800",
  },

  toolbar: {
    alignSelf: "center",
    width: "95%",
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
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
