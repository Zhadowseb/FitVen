import { StyleSheet } from "react-native";

export const TILE_SIZE = 40;
export const REGION_TILE_SIZE = 36;

export default StyleSheet.create({
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
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
  // Under the copy, not under the tile.
  divider: {
    height: 1,
    marginLeft: 16 + TILE_SIZE + 12,
  },
  dividerRegion: {
    marginLeft: 16 + REGION_TILE_SIZE + 12,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  regionTile: {
    width: REGION_TILE_SIZE,
    height: REGION_TILE_SIZE,
    borderRadius: 10,
  },
  tileImage: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  countryCode: {
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  initials: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
