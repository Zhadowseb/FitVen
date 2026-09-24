import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    width: 104,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    // The moods behind the content are cut to the card's rounded shape.
    overflow: "hidden",
  },
  // The flame's 20 dp, whatever stands in it, so the number never moves when
  // a crown or a bolt takes the flame's place.
  iconSlot: {
    width: 44,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // The crown's box is 44 x 30 with the crown drawn down to 27: lifted so its
  // band sits where the flame's foot was.
  crown: {
    left: 0,
    top: -9,
  },
  value: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.1,
    lineHeight: 32,
    // Tabular, so 7 and 11 do not move the box between two days.
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    lineHeight: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
