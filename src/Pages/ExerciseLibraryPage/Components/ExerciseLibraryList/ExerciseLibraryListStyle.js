import { StyleSheet } from "react-native";

const EXERCISE_ROW_HEIGHT = 62;
const EXERCISE_PREVIEW_GAP = 14;
const EXERCISE_PREVIEW_WIDTH = Math.round(EXERCISE_ROW_HEIGHT * (503 / 647));
const VISIBLE_EXERCISE_COUNT = 10;
const LIST_VIEWPORT_HEIGHT = EXERCISE_ROW_HEIGHT * VISIBLE_EXERCISE_COUNT;

export default StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  eyebrow: {
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    lineHeight: 26,
  },
  countBadge: {
    minWidth: 92,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  countBadgeNumber: {
    fontSize: 12,
    fontWeight: "900",
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    maxWidth: 280,
  },
  divider: {
    height: 1,
    opacity: 0.55,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchBox: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
  },
  searchInput: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 9,
    paddingVertical: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  filterButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterSections: {
    gap: 13,
    paddingBottom: 14,
  },
  filterSection: {
    gap: 7,
  },
  filterSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
  },
  filterSectionAccent: {
    width: 14,
    height: 2,
    borderRadius: 999,
  },
  filterSectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  filterContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  groupFilter: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  groupFilterText: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  muscleRoleLegend: {
    marginHorizontal: 14,
    marginBottom: 6,
    gap: 8,
  },
  muscleRoleLegendItem: {
    borderLeftWidth: 3,
    paddingLeft: 9,
    paddingVertical: 1,
    gap: 1,
  },
  muscleRoleLegendText: {
    fontSize: 10,
    lineHeight: 14,
  },
  muscleRoleLegendLabel: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase",
  },
  customExerciseAction: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  tableHeaderPreview: {
    width: EXERCISE_PREVIEW_WIDTH + EXERCISE_PREVIEW_GAP,
  },
  tableHeaderExercise: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  listScroll: {
    height: LIST_VIEWPORT_HEIGHT,
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 0,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: EXERCISE_ROW_HEIGHT,
    borderTopWidth: 1,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 0,
    overflow: "hidden",
  },
  exerciseRowLast: {
    borderBottomWidth: 0,
  },
  exerciseRowSelected: {
    opacity: 0.58,
  },
  exercisePreviewBodyMap: {
    width: EXERCISE_PREVIEW_WIDTH,
    maxWidth: EXERCISE_PREVIEW_WIDTH,
    height: EXERCISE_ROW_HEIGHT,
    alignSelf: "center",
    marginRight: EXERCISE_PREVIEW_GAP,
  },
  exerciseBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingRight: 0,
    paddingVertical: 8,
  },
  exerciseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: 0,
  },
  exerciseName: {
    flex: 1,
    flexShrink: 1,
    marginRight: 6,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  exerciseStatusBadge: {
    minHeight: 18,
    borderRadius: 999,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  exerciseStatusBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11,
    includeFontPadding: false,
    textTransform: "uppercase",
  },
  muscleBadgeRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 5,
    marginTop: 4,
  },
  muscleBadge: {
    minHeight: 16,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  primaryMuscleBadge: {
    minWidth: 58,
  },
  secondaryMuscleBadge: {
    minWidth: 74,
  },
  muscleBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11,
    includeFontPadding: false,
    textAlign: "center",
    flexShrink: 0,
  },
  exerciseBodyMapModal: {
    width: "94%",
    maxHeight: "92%",
    paddingHorizontal: 18,
  },
  exerciseBodyMapModalBody: {
    flexGrow: 0,
    gap: 14,
  },
  exerciseBodyMapModalBadges: {
    justifyContent: "center",
    marginTop: 0,
  },
  exerciseBodyMapModalFigures: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 16,
    minWidth: 0,
  },
  exerciseBodyMapModalFigure: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  exerciseBodyMapModalFigureLabel: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  exerciseBodyMapModalPreview: {
    width: "100%",
    maxWidth: 138,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 18,
    minHeight: LIST_VIEWPORT_HEIGHT,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  emptyBody: {
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
});
