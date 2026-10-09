import { StyleSheet } from "react-native";

// The rail snaps to this plus the gap, so it lives here with the card.
export const CARD_WIDTH = 208;

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  card: { width: CARD_WIDTH, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  media: { height: 100, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFillObject },
  body: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 3 },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    lineHeight: 12,
    textTransform: "uppercase",
  },
  // Two lines' room whatever the title, so every card on the rail - and the
  // placeholders before them - is one height, and the lines under line up.
  title: { fontSize: 14, fontWeight: "800", lineHeight: 18, minHeight: 36 },
  meta: { fontSize: 10.5, fontWeight: "700", lineHeight: 14 },

  // The placeholder: the same boxes, with a bar in each line.
  line: { justifyContent: "center" },
  kickerLine: { height: 12 },
  titleLine: { height: 18 },
  metaLine: { height: 14 },
  bar: { borderRadius: 4 },
  kickerBar: { width: 64, height: 7 },
  titleBar: { width: "84%", height: 11 },
  titleBarShort: { width: "56%", height: 11 },
  metaBar: { width: "50%", height: 8 },
});
