import { StyleSheet } from "react-native";

// Tile geometry. 148 wide, 8 apart, so the slider snaps every 156. The band
// is 58 high with the 56 avatar sunk 30 into it, which puts every avatar on
// the same horizontal line whether or not a tile has music.
export const TILE_WIDTH = 148;
export const TILE_GAP = 8;
export const BAND_HEIGHT = 58;
export const AVATAR_SIZE = 56;
export const AVATAR_OVERLAP = 30;
export const AVATAR_RING_WIDTH = 2.5;
export const TILE_MIN_HEIGHT = 165;
// The fire and ice drawn around the avatar: wider than it, centred on it, and
// outside the layout - nothing moves to make room.
export const AURA_SIZE = 92;

export default StyleSheet.create({
  section: {
    marginTop: 18,
    gap: 12,
  },
  headerRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headerSpacer: {
    flex: 1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  livePillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  livePillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 4,
    gap: TILE_GAP,
    alignItems: "stretch",
  },

  /* ------------------------------------------------------------- tile -- */
  tile: {
    width: TILE_WIDTH,
    minHeight: TILE_MIN_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  band: {
    height: BAND_HEIGHT,
    width: "100%",
    overflow: "hidden",
  },
  bandTextRow: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 10,
    paddingRight: 10,
  },
  bandIconSlot: {
    width: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bandTextClip: {
    flex: 1,
    height: 14,
    overflow: "hidden",
    justifyContent: "center",
  },
  bandText: {
    fontSize: 9.5,
    fontWeight: "800",
    lineHeight: 12,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tickerCopy: {
    paddingRight: 18,
  },
  tickerMeasure: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
  },
  edgeFadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
  },
  edgeFadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 10,
  },
  equalizer: {
    width: 12,
    height: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
  },
  equalizerBar: {
    width: 2,
    borderRadius: 1,
  },

  avatarSlot: {
    position: "absolute",
    top: BAND_HEIGHT - AVATAR_OVERLAP,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  avatarShell: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 999,
  },
  aura: {
    position: "absolute",
    width: AURA_SIZE,
    height: AURA_SIZE,
    left: (AVATAR_SIZE - AURA_SIZE) / 2,
    top: (AVATAR_SIZE - AURA_SIZE) / 2,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: AVATAR_RING_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  tileBody: {
    paddingTop: AVATAR_SIZE - AVATAR_OVERLAP + 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tileName: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center",
  },
  factBlock: {
    marginTop: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    gap: 3,
    width: "100%",
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 13,
  },
  factIconSlot: {
    width: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  factDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  factStatusText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 13,
  },
  factGymText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
  },
  factSpacer: {
    height: 13,
  },

  /* --------------------------------------------------------- wallpaper -- */
  // The days since the last workout, big enough to be a texture rather than
  // a label, and pushed past the bottom-right corner so the tile crops it.
  wallpaperMark: {
    position: "absolute",
    right: 6,
    bottom: -26,
    fontSize: 96,
    lineHeight: 110,
    fontWeight: "900",
    letterSpacing: -4,
    includeFontPadding: false,
  },
  wallpaperUnit: {
    fontSize: 34,
    letterSpacing: 0,
  },

  /* ------------------------------------------------------- add friends -- */
  addTile: {
    width: TILE_WIDTH,
    minHeight: TILE_MIN_HEIGHT,
    alignSelf: "stretch",
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  addCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* ---------------------------------------------- loading, empty, error -- */
  loadingTile: {
    width: TILE_WIDTH,
    minHeight: TILE_MIN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  ringLoadingShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    minHeight: TILE_MIN_HEIGHT,
    width: 172,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  noticeCard: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});
