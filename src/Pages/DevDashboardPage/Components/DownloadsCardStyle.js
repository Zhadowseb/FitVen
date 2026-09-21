import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  box: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  platformRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  platformKey: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  platformName: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  count: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  changeArrow: {
    fontSize: 11,
    fontWeight: "800",
  },
  changeValue: {
    fontSize: 11,
    fontWeight: "800",
  },
  changeLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  chart: {
    marginTop: 10,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  chartTotal: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  chartTotalValue: {
    fontSize: 11.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  chartTotalLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 12,
  },
  emptyBars: {
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "stretch",
    gap: 4,
  },
  track: {
    justifyContent: "flex-end",
  },
  stack: {
    // A 1 dp gap between the two platforms, drawn as a border rather than a
    // margin so it does not change the bar's height.
    overflow: "hidden",
    borderRadius: 2,
  },
  segmentTop: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginBottom: 1,
  },
  segmentBottom: {
    minHeight: 0,
  },
  bucketLabel: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendKey: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },
});
