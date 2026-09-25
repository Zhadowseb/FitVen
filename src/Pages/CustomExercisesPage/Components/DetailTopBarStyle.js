import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` (or the dark palette over the clip)
// in the component.
export default StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
