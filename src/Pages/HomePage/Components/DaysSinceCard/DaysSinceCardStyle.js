import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    width: 104,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  value: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.1,
    lineHeight: 32,
    // Tabular, so 7 and 11 do not move the box between two days.
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    lineHeight: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
