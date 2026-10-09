import { StyleSheet } from "react-native";

// Layout only. Every colour is applied inline from the theme, so light, dark
// and the accent themes all reach it.
export default StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // Header: back, "Your exercise", the name
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  // Level with the name's first line, and still at the top when it wraps.
  back: {
    width: 36,
    height: 36,
    marginTop: 3,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 23,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // Sections
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    minHeight: 16,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionLabel: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionMeta: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  helper: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },

  // What it is
  textArea: {
    minHeight: 76,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "600",
    textAlignVertical: "top",
  },

  // Equipment
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "800",
  },

  // Weight
  segmented: {
    alignSelf: "flex-start",
  },

  // Loading, not found, failed
  stateCard: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // Save. The app's navigation is a sibling below this screen, not something
  // drawn over it, so the bar sits on top of it and needs no inset of its own.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  footerError: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
