import { StyleSheet } from "react-native";

// The Quick start block while a workout is running. Layout only: every colour
// comes from the theme in the component body (src/Pages/AGENTS.md).
export const SET_BAR_HEIGHT = 5;
export const COUNT_MIN_WIDTH = 62;

export default StyleSheet.create({
  // One panel filling the block, the way the empty workout does when it
  // stands alone.
  panel: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    borderRadius: 13,
    borderWidth: 1.5,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 11,
    gap: 6,
  },
  // The rest draining out of the panel, from its left edge.
  drain: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: "left",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotRing: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  eyebrow: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  clock: {
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  body: {
    flex: 1,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 11.5,
  },
  pill: {
    fontSize: 11.5,
    fontWeight: "800",
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 999,
    overflow: "hidden",
    fontVariant: ["tabular-nums"],
  },
  chevron: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  count: {
    minWidth: COUNT_MIN_WIDTH,
    alignItems: "center",
  },
  countNumber: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  countLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  finish: {
    fontSize: 12,
    fontWeight: "800",
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    overflow: "hidden",
  },
  bars: {
    flexDirection: "row",
    gap: 3,
    height: SET_BAR_HEIGHT,
    marginTop: 4,
    marginBottom: 3,
  },
  bar: {
    flex: 1,
    height: SET_BAR_HEIGHT,
  },
  // The glow round the set that is next: a little larger than its bar,
  // behind it.
  barGlow: {
    position: "absolute",
    top: -2,
    bottom: -2,
    left: -2,
    right: -2,
    borderRadius: 4.5,
  },
  barTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    transformOrigin: "left",
  },
  setLine: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 26,
    fontVariant: ["tabular-nums"],
  },
  setUnit: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  // The shine across a record's name: a band that shows the name again in
  // the light colour, moving across it.
  shineBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  confetti: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 4,
    height: 7,
    marginLeft: -2,
    marginTop: -3.5,
    borderRadius: 1,
  },
});
