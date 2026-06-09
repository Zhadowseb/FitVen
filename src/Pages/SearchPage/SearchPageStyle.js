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
  headerRelationshipStats: {
    width: 132,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  headerRelationshipStat: {
    minWidth: 52,
    alignItems: "center",
    paddingVertical: 4,
  },
  headerRelationshipStatPressed: {
    opacity: 0.68,
  },
  headerRelationshipValue: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 15,
  },
  headerRelationshipLabel: {
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    marginTop: 1,
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
  relationshipModal: {
    maxHeight: 520,
  },
  relationshipModalContent: {
    minHeight: 0,
  },
  relationshipList: {
    maxHeight: 320,
  },
  relationshipListContent: {
    paddingBottom: 4,
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  relationshipCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  relationshipDisplayName: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  relationshipUsername: {
    fontSize: 13,
    lineHeight: 18,
  },
  relationshipStateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  relationshipCloseButton: {
    marginTop: 8,
  },
});
