import { StyleSheet } from "react-native";

export default StyleSheet.create({
  modal: {
    width: "94%",
    maxHeight: "90%",
  },
  modalContent: {
    gap: 14,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  stepContent: {
    gap: 18,
  },
  copy: {
    gap: 5,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  muscleStepScroll: {
    flexShrink: 1,
  },
  muscleStepContent: {
    gap: 16,
    paddingBottom: 4,
  },
  bodyMapRow: {
    minHeight: 185,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  bodyMapFigure: {
    width: 100,
    alignItems: "center",
    gap: 7,
  },
  bodyMapLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  bodyMap: {
    width: 70,
    maxWidth: 70,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
