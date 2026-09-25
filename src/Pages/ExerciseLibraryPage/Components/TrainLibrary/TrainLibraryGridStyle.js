import { StyleSheet } from "react-native";

export default StyleSheet.create({
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },

  // A bar a week, standing on a common floor. The height and the gap come
  // from the component, which needs the height for its sums.
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bar: {
    flex: 1,
  },

  // Exercises: the muscle-group bar and its legend.
  exercisesBody: {
    gap: 10,
  },
  muscleBar: {
    flexDirection: "row",
    height: 8,
    gap: 2,
  },
  muscleSegment: {
    height: 8,
    minWidth: 3,
    borderRadius: 2,
  },
  legend: {
    gap: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "800",
  },

  // Programs: a bar a program, and the empty slot beside a lone one.
  programBars: {
    gap: 5,
  },
  programSlot: {
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: "dashed",
  },

  // Your form.
  formCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingTop: 15,
    paddingRight: 16,
    paddingBottom: 14,
    paddingLeft: 16,
    gap: 14,
  },
  formTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  formIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  formCopy: {
    flex: 1,
    minWidth: 0,
  },
  formStreakRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  formStreakValue: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  formStreakLabel: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  formThreshold: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  formAverage: {
    alignItems: "flex-end",
  },
  formAverageValue: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  formAverageLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
