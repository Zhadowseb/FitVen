import { StyleSheet } from "react-native";

export default StyleSheet.create({
  // No surface and no outline. Every button in here draws its own border, so
  // the card's was a border around a border, and it made the screen's main
  // action read as a widget sitting on the page rather than as part of it.
  card: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: 8,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    paddingLeft: 2,
  },
  primaryButton: {
    height: 44,
    borderRadius: 13,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  primaryLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    fontWeight: "800",
  },
  // A triangle drawn with borders: one view instead of an icon file for a
  // shape that is three lines of style.
  chevron: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  secondaryButton: {
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
});
