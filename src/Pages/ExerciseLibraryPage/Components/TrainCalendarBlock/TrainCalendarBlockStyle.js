import { StyleSheet } from "react-native";

// Layout only: the colours are applied inline (see src/Pages/AGENTS.md).
export default StyleSheet.create({
  block: {
    borderWidth: 1,
    borderRadius: 16,
    paddingTop: 14,
    paddingRight: 11,
    paddingBottom: 12,
    paddingLeft: 11,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  headerCopy: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },

  // The height is held while the week loads, so the title does not jump.
  subtitle: {
    minHeight: 15,
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },

  // The calendar's Workouts section, under the header.
  workoutsSection: {
    marginTop: 14,
  },

  // ---- copied from WorkoutCalendarPageStyle, so the block reads exactly as
  // the calendar's Workouts section. Change them there as well. ----

  weekListHeader: {
    marginBottom: 4,
    paddingTop: 14,
    borderTopWidth: 1,
  },

  sectionEyebrow: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  weekdayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },

  weekdayHeaderCell: {
    width: "14.2857%",
    paddingHorizontal: 2.5,
    alignItems: "center",
  },

  weekdayHeaderText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },

  weekListRow: {
    paddingTop: 5,
  },
});
