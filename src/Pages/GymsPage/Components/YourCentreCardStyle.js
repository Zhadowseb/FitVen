import { StyleSheet } from "react-native";

export const CARD_HEIGHT = 156;
// The veil the name sits on: the bottom 120 dp of the photo.
export const VEIL_HEIGHT = 120;

export default StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  // No photo: the chain's initials in the space the photo would fill, clear
  // of the name at the bottom - the centre page's hero does the same.
  fallback: {
    ...StyleSheet.absoluteFillObject,
    bottom: VEIL_HEIGHT - 30,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 2,
  },
  veil: {
    top: CARD_HEIGHT - VEIL_HEIGHT,
  },
  pill: {
    position: "absolute",
    top: 12,
    left: 12,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  bottom: {
    position: "absolute",
    left: 16,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chain: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  members: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  go: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
