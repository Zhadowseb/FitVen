import { StyleSheet } from "react-native";

// Layout only: the tabs, then the pills in a row that wraps before it clips.
export default StyleSheet.create({
  filters: {
    gap: 10,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
