import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    marginBottom: 12,
    gap: 12,
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
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
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 10,
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
    lineHeight: 12,
    letterSpacing: 0,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  emptyDate: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "800",
    textAlign: "center",
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
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  emptyTitle: {
    padding: 0,
    fontSize: 30,
    lineHeight: 23,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  quickStartButton: {
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  quickStartButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  programSection: {
    marginBottom: 0,
  },
});
