import { StyleSheet } from "react-native";

// Layout only; the colours are the theme's and are applied in the component.
export default StyleSheet.create({
  // Inside the card's padding: the expanded section bleeds 12 past it on
  // each side, so this takes it back. 10 down to the set table.
  row: {
    height: 30,
    marginHorizontal: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },

  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
  },

  label: {
    fontSize: 12.5,
    flexShrink: 1,
  },

  labelSelected: {
    fontWeight: "800",
  },

  labelIdle: {
    fontWeight: "700",
  },

  value: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // The selected tab's 2 dp line along the bottom.
  underline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
});
