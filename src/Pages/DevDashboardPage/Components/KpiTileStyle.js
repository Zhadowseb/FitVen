import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  rowSpaced: {
    marginTop: 8,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  // The padding sits on an inner layer so an alarm's tint covers the card
  // surface instead of replacing it.
  body: {
    flexGrow: 1,
    padding: 12,
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  side: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  detail: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  window: {
    fontSize: 10,
    fontWeight: "700",
  },
  status: {
    marginTop: "auto",
    paddingTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: "800",
  },
});
