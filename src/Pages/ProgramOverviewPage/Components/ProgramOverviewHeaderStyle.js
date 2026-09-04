import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statusPill: {
    flexShrink: 0,
  },
  // Full-width primary action, not a corner pill: starting the program is the
  // whole point of this screen while the program is still a draft.
  startButton: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  progressGroup: {
    gap: 7,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  progressLeft: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  weekOfLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  caption: {
    fontSize: 11,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    fontSize: 19,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "800",
  },
});
