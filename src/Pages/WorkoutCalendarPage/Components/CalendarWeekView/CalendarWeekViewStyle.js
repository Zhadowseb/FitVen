import { StyleSheet } from "react-native";

export const TILE_SIZE = 44;
export const TILE_GAP = 5;

export default StyleSheet.create({
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 14,
  },

  navButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  navButtonOff: {
    opacity: 0.3,
  },

  weekNavCopy: {
    flex: 1,
    alignItems: "center",
  },

  // The handoff asks for 9-9.5 px here; 11 is the floor the app holds itself to.
  weekNavLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },

  weekNavRange: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  progressBlock: {
    paddingTop: 12,
  },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 2,
  },

  progressCopy: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },

  progressDone: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  progressLeft: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  dayRows: {
    paddingTop: 14,
  },

  dayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
  },

  dayRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },

  dateColumn: {
    width: 34,
    flexShrink: 0,
    alignItems: "center",
    paddingTop: 4,
  },

  weekdayLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  dateNumber: {
    marginTop: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  dateNumberToday: {
    fontSize: 19,
    lineHeight: 23,
  },

  countBadge: {
    marginTop: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  countBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  workoutSurface: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
  },

  workoutSurfaceToday: {
    height: 54,
  },

  workoutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  workoutName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  workoutNameToday: {
    fontSize: 15,
    lineHeight: 19,
  },

  workoutMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },

  // Always one tile tall: a week's height must not depend on how many workouts
  // its busiest day holds.
  tileRow: {
    flex: 1,
    minWidth: 0,
    height: TILE_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: TILE_GAP,
  },

  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  tileOverflow: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  restStrip: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  restText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
});
