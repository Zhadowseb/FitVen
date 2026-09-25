import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  reasonList: { gap: 8, marginTop: 4 },
  reason: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  reasonText: { fontSize: 14, fontWeight: "600" },
  note: { marginTop: 12, minHeight: 80 },
});
