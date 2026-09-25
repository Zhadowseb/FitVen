import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  // A row in the library: a square beside the name.
  row: {
    width: 86,
    height: 86,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // A card on Explore's rail: the full width of the card, which clips it.
  rail: {
    width: "100%",
    height: 104,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: { ...StyleSheet.absoluteFillObject },

  // No video
  dashed: { borderWidth: 1, borderStyle: "dashed", gap: 6, paddingHorizontal: 6 },
  noVideo: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    lineHeight: 11,
    textTransform: "uppercase",
    textAlign: "center",
  },
  railNoVideo: { marginTop: 6, fontSize: 10.5, fontWeight: "800", lineHeight: 13 },

  // A video
  play: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playLarge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  duration: {
    position: "absolute",
    right: 7,
    bottom: 5,
    fontSize: 9.5,
    fontWeight: "800",
    lineHeight: 12,
    fontVariant: ["tabular-nums"],
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  durationPill: {
    position: "absolute",
    right: 8,
    bottom: 8,
    height: 18,
    borderRadius: 5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  durationPillText: { fontSize: 10, fontWeight: "800", lineHeight: 12, fontVariant: ["tabular-nums"] },

  // Already in your exercises
  badge: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
