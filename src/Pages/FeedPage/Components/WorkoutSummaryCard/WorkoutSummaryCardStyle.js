import { StyleSheet } from "react-native";

// Left padding for the top-sets block is 11, not 16: the star column has to sit
// close to the card edge so the exercise names line up with the rest.
const STAR_COLUMN_WIDTH = 11;
const STAR_COLUMN_GAP = 6;

const TOP_SET_NAME_OFFSET = STAR_COLUMN_WIDTH + STAR_COLUMN_GAP;

export default StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 14,
    marginTop: 14,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },

  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },

  authorName: {
    fontSize: 15,
    fontWeight: "800",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  metaText: {
    fontSize: 12,
    fontWeight: "700",
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1,
  },

  workoutType: {
    fontSize: 12,
    fontWeight: "800",
  },

  optionsButton: {
    width: 44,
    height: 44,
    marginRight: -12,
    alignItems: "center",
    justifyContent: "center",
  },

  // A separate tray below the card, used by the own-posts list. Inset and on a
  // quieter surface so it reads as a control strip for the post above rather
  // than part of the post itself.
  postedStrip: {
    marginTop: 8,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  // Short stub across the gap, so the tray reads as hanging off the card above
  // it rather than as a loose row between two posts.
  postedStripBridge: {
    position: "absolute",
    left: 22,
    top: -8,
    width: 3,
    height: 9,
    borderRadius: 1,
  },

  postedBadge: {
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
  },

  postedBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  postAction: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  postActionText: {
    fontSize: 12,
    fontWeight: "800",
  },

  manageButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  titleRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  title: {
    flexShrink: 1,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  prBadge: {
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 7,
    paddingRight: 9,
    flexShrink: 0,
  },

  prBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  noteRow: {
    marginTop: 9,
    flexDirection: "row",
    gap: 9,
  },

  noteRule: {
    width: 2,
    borderRadius: 1,
    alignSelf: "stretch",
  },

  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  statsRow: {
    marginTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "baseline",
  },

  statsGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },

  statsSpacer: {
    flex: 1,
  },

  durationValue: {
    fontSize: 19,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  statsUnit: {
    fontSize: 11,
    fontWeight: "700",
  },

  volumeValue: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  divider: {
    height: 1,
  },

  topSetsHeader: {
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 4,
    paddingLeft: STAR_COLUMN_WIDTH,
    flexDirection: "row",
    alignItems: "baseline",
    gap: STAR_COLUMN_GAP,
  },

  // The row aligns its text on the baseline; a plain View has none, so the
  // star would hang off the baseline instead of sitting beside the name.
  starColumn: {
    width: STAR_COLUMN_WIDTH,
    flexShrink: 0,
    alignSelf: "center",
    alignItems: "center",
  },

  topSetsLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },

  topSetsCompareLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  topSetsList: {
    paddingTop: 4,
    paddingRight: 16,
    paddingBottom: 10,
    paddingLeft: STAR_COLUMN_WIDTH,
    gap: 13,
  },

  topSetRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: STAR_COLUMN_GAP,
  },

  topSetName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
  },

  topSetReps: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  topSetWeight: {
    width: 60,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  topSetBarSlot: {
    marginTop: 6,
    marginLeft: TOP_SET_NAME_OFFSET,
  },

  footerRow: {
    paddingTop: 11,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  footerAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  footerSpacer: {
    flex: 1,
  },

  footerText: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
