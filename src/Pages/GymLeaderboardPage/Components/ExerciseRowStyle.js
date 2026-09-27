import { StyleSheet } from "react-native";

// Layout only; the colours are the theme's, applied in ExerciseRow.js. The
// same row as the centre lists on the Centres screens (GymsPage's LevelRow),
// so an exercise here reads like a centre there.
const TILE_SIZE = 40;

export default StyleSheet.create({
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 19,
  },
  meta: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  rank: {
    flexShrink: 0,
    fontSize: 12.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  // Under the copy, not under the tile.
  divider: {
    height: 1,
    marginLeft: 16 + TILE_SIZE + 12,
  },
});
