import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  statDivided: {
    borderLeftWidth: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    lineHeight: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
