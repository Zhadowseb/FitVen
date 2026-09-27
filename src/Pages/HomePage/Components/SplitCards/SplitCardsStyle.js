import { StyleSheet } from "react-native";

export default StyleSheet.create({
  // Over the cards and over the week the split waits for alike, so the block
  // is named before there is anything in it. Its bottom margin is the gap to
  // either.
  eyebrow: {
    marginTop: 18,
    marginHorizontal: 20,
    marginBottom: 9,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginHorizontal: 20,
  },
  scrollRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: 20,
  },
  // The first week: seven dots and a word on one line, the explanation on
  // its own line under them. Not a card - nothing opens yet. The explanation
  // used to share the dots' line and was cut off on a phone; under them it
  // has the whole width and wraps.
  forming: {
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  formingTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  formingDots: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 5,
  },
  formingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  formingDotEmpty: {
    borderWidth: 1.5,
  },
  formingStatus: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "800",
  },
  formingText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
  },
  card: {
    // stretch on the row keeps every card as tall as the tallest, so a group
    // with no settled weekday does not make its neighbour look wrong.
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
  },
  cardFlex: {
    flex: 1,
  },
  allCard: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  weekdays: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  meta: {
    fontSize: 10.5,
    fontWeight: "700",
  },
});
