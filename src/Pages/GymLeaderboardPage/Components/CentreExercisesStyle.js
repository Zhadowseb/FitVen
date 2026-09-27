import { StyleSheet } from "react-native";

// Layout only; the colours are the theme's, applied in CentreExercises.js.
// The section head and the card are the Centres screens' (GymsPageStyle).
export default StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionLabel: {
    flexShrink: 0,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionHint: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  emptyLine: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  allRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  allTile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  allCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  allTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 19,
  },
  allDetail: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
});
