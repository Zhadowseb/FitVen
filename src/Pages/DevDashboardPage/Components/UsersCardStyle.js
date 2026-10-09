import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  // 74 | 1fr | 1fr | 1fr
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  dataRow: {
    paddingVertical: 8,
  },
  labelCell: {
    width: 74,
  },
  headCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  swatch: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  headText: {
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "right",
  },
  rowName: {
    // Level with the middle of the 22 pt number beside it.
    paddingTop: 6,
    fontSize: 11.5,
    fontWeight: "800",
  },
  valueCell: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
    gap: 1,
  },
  number: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  noteStrong: {
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "right",
  },
  noteQuiet: {
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "right",
  },
  hairline: {
    height: 1,
  },
  spanNote: {
    flex: 1,
    marginTop: -2,
    marginBottom: 2,
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "right",
  },
  footer: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },
});
