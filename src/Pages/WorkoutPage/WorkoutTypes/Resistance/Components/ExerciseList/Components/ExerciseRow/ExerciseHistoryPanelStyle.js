import { StyleSheet } from "react-native";

// Exported so the component and the style agree on the snap interval: the
// scroll lands on a cell edge only if it moves by exactly one cell and a gap.
export const HISTORY_CELL_WIDTH = 68;
export const HISTORY_CELL_GAP = 6;
export const HISTORY_FADE_WIDTH = 16;

const DATE_COLUMN_WIDTH = 68;
const HEADER_HEIGHT = 26;
const ROW_HEIGHT = 50;

export default StyleSheet.create({
  panel: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  bar: {
    height: 36,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  barMeta: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: "700",
  },
  // Expand points down; the bar closes the panel, so it points up.
  barChevron: {
    transform: [{ rotate: "180deg" }],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  message: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    fontSize: 12.5,
    fontWeight: "700",
  },
  table: {
    flexDirection: "row",
    paddingLeft: 14,
    paddingVertical: 8,
  },
  dateColumn: {
    width: DATE_COLUMN_WIDTH,
  },
  headerRow: {
    height: HEADER_HEIGHT,
    justifyContent: "center",
  },
  setHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: HISTORY_CELL_GAP,
  },
  headerText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  setHeaderText: {
    width: HISTORY_CELL_WIDTH,
    textAlign: "center",
  },
  dateCell: {
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  dateRelative: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "700",
  },
  scrollArea: {
    flex: 1,
    minWidth: 0,
  },
  setRow: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: HISTORY_CELL_GAP,
    paddingRight: 14,
  },
  cell: {
    width: HISTORY_CELL_WIDTH,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    paddingTop: 7,
    gap: 3,
  },
  cellEmpty: {
    borderStyle: "dashed",
    alignItems: "center",
    paddingTop: 0,
  },
  cellEmptyRule: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
  },
  cellWeight: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  cellReps: {
    fontSize: 10,
    fontWeight: "700",
  },
  fade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
  },
  recordsRow: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordsLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "800",
  },
  recordsValue: {
    fontSize: 11.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
