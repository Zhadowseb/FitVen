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
    paddingTop: 12,
    paddingBottom: 18,
  },
  relationshipStat: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  relationshipStatPressed: {
    opacity: 0.68,
  },
  relationshipStatText: {
    fontSize: 13,
    fontWeight: "700",
  },
  relationshipStatValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  relationshipStats: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 14,
  },
  storiesSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    padding: 0,
    marginBottom: 2,
    fontSize: 22,
    lineHeight: 28,
  },
  storiesRail: {
    marginHorizontal: -20,
  },
  // The artwork is 4:3 and carries its own label, so the box takes the image's
  // proportions instead of a fixed height - cover then fills it without
  // cropping anything away.
  // One shared set for both hero cards on this page. Only the aspect ratio is
  // per card, because the two images have different proportions.
  heroCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 14,
  },
  heroCardPosts: {
    aspectRatio: 1200 / 885,
  },
  heroCardFriends: {
    aspectRatio: 1200 / 786,
  },
  heroImage: {
    flex: 1,
  },
  heroContent: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 8, 12, 0.42)",
  },
  heroActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  heroActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 15, 18, 0.52)",
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  heroCopy: {
    alignItems: "flex-start",
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 1,
  },
  heroTitle: {
    padding: 0,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    color: "#ffffff",
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
    fontSize: 13,
    lineHeight: 20,
  },
  relationshipAction: {
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
  },
  relationshipActionPressed: {
    opacity: 0.7,
  },
  relationshipActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  relationshipFooter: {
    paddingTop: 12,
    alignItems: "center",
  },
  relationshipFooterLink: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  relationshipFooterText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  relationshipCloseButton: {
    marginTop: 8,
  },
});
