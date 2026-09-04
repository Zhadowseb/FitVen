import { StyleSheet } from "react-native";

export default StyleSheet.create({
  modal: {
    maxHeight: 520,
  },

  content: {
    gap: 14,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },

  scrollArea: {
    flexGrow: 1,
    minHeight: 0,
  },

  scrollContent: {
    gap: 14,
    paddingBottom: 2,
  },

  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sectionLabel: {
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },

  exerciseName: {
    fontWeight: "700",
    lineHeight: 24,
  },

  estimatedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  estimatedBadgeText: {
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  suggestedWeight: {
    fontWeight: "700",
    lineHeight: 28,
  },

  useBestButton: {
    marginTop: 2,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  inputContainer: {
    flex: 1,
  },

  unitBadge: {
    minWidth: 54,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },

  actionButton: {
    flex: 1,
  },
});
