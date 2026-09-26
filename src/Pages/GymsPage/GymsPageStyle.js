import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    lineHeight: 13,
    textTransform: "uppercase",
  },
  topTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 27,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 28,
    gap: 14,
  },
  searchField: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
  },
  levelHeader: {
    gap: 4,
    marginTop: 2,
  },
  levelTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 31,
    marginTop: 4,
  },
  levelSubtitle: {
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 15,
  },
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
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionHint: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "700",
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  cards: {
    gap: 12,
  },
  // The cards of the gender before, while the new ones load.
  refreshing: {
    opacity: 0.55,
  },
  footnote: {
    paddingHorizontal: 4,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
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
  notice: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  noticeBody: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
    marginTop: 4,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  stateBlock: {
    paddingVertical: 28,
  },
});
