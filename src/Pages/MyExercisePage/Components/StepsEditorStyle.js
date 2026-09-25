import { StyleSheet } from "react-native";

// Layout only; every colour is applied inline from the theme.
export default StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  // Lined up with the first line of the field beside it: the field has 12 of
  // padding above a 20-high line.
  number: {
    width: 18,
    marginTop: 12,
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlignVertical: "top",
  },
  counter: {
    marginTop: 4,
    alignSelf: "flex-end",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  remove: {
    width: 36,
    height: 36,
    marginTop: 4,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  full: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
});
