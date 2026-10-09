import { StyleSheet } from "react-native";

// Layout only. The card is drawn in slices - same 20 radius and 1 border as
// the exercise board's list - because the rows are FlatList items.
export default StyleSheet.create({
  slice: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
  },
  sliceFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sliceLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingLeft: 13,
    paddingRight: 16,
    // Room for your row's 3 dp edge on every row, so the columns line up.
    borderLeftWidth: 3,
  },
  rowPlain: {
    borderLeftColor: "transparent",
  },
  rank: {
    minWidth: 28,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
  },
  // A word unit under the number: "træninger" beside "16" took the room the
  // line under the name needs at 375 pt, and the stack is no taller than the
  // name and its line. kg and % stay beside it (unitBesideValue).
  valueGroup: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  valueGroupInline: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  value: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  dots: {
    height: 30,
    lineHeight: 30,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  dotsStandalone: {
    marginTop: 4,
  },
});
