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
  storiesSection: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    marginBottom: 2,
  },
  sectionTitle: {
    padding: 0,
    fontSize: 22,
    lineHeight: 28,
  },
  storiesRail: {
    marginHorizontal: -20,
  },
  findFriendsCard: {
    height: 168,
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
  },
  findFriendsImage: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 15,
  },
  findFriendsImageRadius: {
    borderRadius: 24,
  },
  findFriendsScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 8, 12, 0.42)",
  },
  findFriendsActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  findFriendsActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 15, 18, 0.52)",
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  findFriendsCopy: {
    alignItems: "flex-start",
  },
  findFriendsEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  findFriendsTitle: {
    padding: 0,
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 29,
  },
  searchSection: {
    marginBottom: 14,
  },
  searchInputWrapper: {
    marginBottom: 10,
  },
  searchHint: {
    fontSize: 13,
    lineHeight: 19,
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
    gap: 12,
  },
  resultCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  resultAvatar: {
    marginTop: 2,
  },
  resultCopy: {
    flex: 1,
  },
  resultDisplayName: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 2,
  },
  resultUsername: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  resultBio: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  followButton: {
    marginTop: 0,
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
