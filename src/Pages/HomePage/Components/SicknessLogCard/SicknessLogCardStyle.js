import { StyleSheet } from "react-native";

export default StyleSheet.create({
  modal: {
    maxHeight: 460,
  },
  modalContent: {
    gap: 14,
  },
  modalSummary: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalEyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  symptomGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  symptomChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  symptomChipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  modalButton: {
    flex: 1,
  },
});
