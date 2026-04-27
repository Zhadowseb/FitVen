import { StyleSheet } from "react-native";

const EXERCISE_ROW_HEIGHT = 64;
const EXERCISE_ROW_GAP = 10;
const VISIBLE_EXERCISE_COUNT = 10;
const LIST_VIEWPORT_HEIGHT =
  EXERCISE_ROW_HEIGHT * VISIBLE_EXERCISE_COUNT +
  EXERCISE_ROW_GAP * (VISIBLE_EXERCISE_COUNT - 1);

export default StyleSheet.create({
  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    lineHeight: 26,
  },
  countBadge: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  description: {
    lineHeight: 20,
  },
  divider: {
    height: 1,
    opacity: 0.55,
    marginTop: 16,
    marginBottom: 16,
  },
  listScroll: {
    height: LIST_VIEWPORT_HEIGHT,
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: EXERCISE_ROW_HEIGHT,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: EXERCISE_ROW_GAP,
  },
  exerciseRowLast: {
    marginBottom: 0,
  },
  exerciseIndex: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  exerciseIndexText: {
    fontSize: 12,
    fontWeight: "800",
  },
  exerciseBody: {
    flex: 1,
    justifyContent: "center",
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  exerciseMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  exerciseMetaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 4,
  },
  exerciseMetaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 12,
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
