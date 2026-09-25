import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 14,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { height: 20, borderRadius: 6, paddingHorizontal: 7, justifyContent: "center" },
  badgeText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  titleBlock: { gap: 3 },
  name: { fontSize: 21, fontWeight: "800", lineHeight: 25 },
  blockLine: { fontSize: 12, fontWeight: "700", lineHeight: 16 },

  progress: { gap: 7 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  progressText: { fontSize: 11, fontWeight: "700", lineHeight: 14 },
  segments: { flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  segmentFill: { height: 6, borderRadius: 3 },

  days: { flexDirection: "row", justifyContent: "space-between" },
  dayColumn: { alignItems: "center", gap: 5 },
  day: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  restDash: { width: 8, height: 2, borderRadius: 1, opacity: 0.5 },
  dayInitial: { fontSize: 10, fontWeight: "800", lineHeight: 12 },

  today: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 13,
  },
  todayCopy: { flex: 1, minWidth: 0, gap: 2 },
  todayEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  todayName: { fontSize: 16, fontWeight: "800", lineHeight: 20 },
  todayMeta: { fontSize: 11.5, fontWeight: "700", lineHeight: 15 },
  start: {
    height: 44,
    minWidth: 84,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  startText: { fontSize: 14, fontWeight: "800" },
});
