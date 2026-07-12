import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
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
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 11.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statusPill: {
    flexShrink: 0,
  },
  startButton: {
    flexShrink: 0,
    minHeight: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  startButtonText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
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
    fontSize: 9,
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
