import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  body: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eyebrow: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  topStatus: {
    flexShrink: 1,
  },
  columns: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  platform: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  daysRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  days: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "700",
  },
  detail: {
    fontSize: 10,
    fontWeight: "700",
  },
  hairline: {
    height: 1,
  },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 6,
    rowGap: 6,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  majorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  majorText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  hint: {
    marginTop: -4,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
});
