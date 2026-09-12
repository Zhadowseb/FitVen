import { StyleSheet } from "react-native";

// Colours are read from `theme` in the component body, never here:
// applyAccentTheme() mutates Colors at runtime, so a colour captured in
// StyleSheet.create is the colour from whenever the module first loaded.
export default StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    overflow: "hidden",
  },
  headRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statValueLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  statValue: {
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 25,
    fontVariant: ["tabular-nums"],
  },
  statUnit: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  // A hairline between the stats, so three numbers in a row read as three
  // things rather than one long number.
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 2,
  },

  caption: {
    fontSize: 12,
    lineHeight: 17,
  },
});
