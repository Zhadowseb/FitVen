import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  // The counter and the quick start share a row and the same height, so the
  // number lines up with the buttons beside it rather than floating above them.
  quickRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 16,
    marginHorizontal: 20,
  },
});
