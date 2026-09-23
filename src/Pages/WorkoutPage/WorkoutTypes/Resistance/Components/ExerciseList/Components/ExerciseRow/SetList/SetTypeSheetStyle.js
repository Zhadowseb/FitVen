import { StyleSheet } from "react-native";

export default StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  overline: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  deleteButton: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deleteText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  rows: {
    gap: 8,
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  // The same 28 x 30 badge the row itself carries, so the sheet reads as a
  // choice between the marks you will see in the list.
  mark: {
    width: 28,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    fontSize: 13,
    fontWeight: "900",
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  rowDetail: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    gap: 8,
    paddingTop: 18,
  },
  lastSection: {
    paddingBottom: 24,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  targetInputWrap: {
    width: 76,
  },
  targetInput: {
    textAlign: "center",
    fontWeight: "800",
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
});
