import { StyleSheet } from "react-native";

export default StyleSheet.create({
  panel: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  box: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  // Dashed and unfilled: it is read, not written, and it is not this session.
  previousBox: {
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  overlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 28,
  },
  overline: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  spacer: {
    flex: 1,
  },
  doneButton: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    fontSize: 12,
    fontWeight: "800",
  },
  noteText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  input: {
    minHeight: 96,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    borderWidth: 1,
    borderRadius: 8,
    paddingTop: 10,
  },
  previousDate: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  previousText: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
  },
});
