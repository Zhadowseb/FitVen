import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 12,
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
  },
  emptyShortcutRow: {
    minHeight: 168,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  emptyTodayCard: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
  },
  stateAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  stateEyebrow: {
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  loadingState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
  },
  loadingCopy: {
    marginTop: 10,
    textAlign: "center",
  },
  emptyState: {
    minHeight: 110,
    justifyContent: "center",
  },
  emptyCopy: {
    marginTop: 10,
    lineHeight: 20,
  },
  programSection: {
    marginBottom: 0,
  },
});
