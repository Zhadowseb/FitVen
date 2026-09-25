import { StyleSheet } from "react-native";

// Layout only; every colour is applied inline from the theme.
export default StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  groups: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  group: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  tag: {
    minHeight: 24,
    maxWidth: "100%",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  // A secondary muscle's dot is a ring: the same colour, less of it.
  dotRing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.3,
  },
  tagText: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  none: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  maps: {
    flexDirection: "row",
    gap: 6,
  },
  figure: {
    width: 50,
    alignItems: "center",
    gap: 5,
  },
  map: {
    width: 46,
    maxWidth: 46,
  },
  mapLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
