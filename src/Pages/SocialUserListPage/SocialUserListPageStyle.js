import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageHeaderTitleEyebrow: {
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  pageHeaderTitleMain: {
    textAlign: "center",
    lineHeight: 26,
  },
  searchSection: {
    marginBottom: 14,
  },
  searchInputWrapper: {
    marginBottom: 0,
  },
  noticeCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
  },
  loadingLabel: {
    marginTop: 10,
    fontSize: 13,
  },
  resultsList: {
    marginTop: 2,
  },
  resultCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  resultDisplayName: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  resultUsername: {
    fontSize: 13,
    lineHeight: 18,
  },
  followButton: {
    marginTop: 0,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  emptyStateCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyStateBody: {
    fontSize: 14,
    lineHeight: 21,
  },
});
