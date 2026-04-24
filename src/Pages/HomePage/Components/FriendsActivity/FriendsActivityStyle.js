import { StyleSheet } from "react-native";

export default StyleSheet.create({
  section: {
    marginTop: 12,
    marginBottom: 10,
  },
  sectionHeader: {
    marginBottom: 12,
    marginHorizontal: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    lineHeight: 26,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    alignItems: "center",
    gap: 12,
  },
  circleCard: {
    width: 76,
    alignItems: "center",
    gap: 8,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  circleName: {
    maxWidth: 76,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    minHeight: 30,
    textAlign: "center",
  },
  circleBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 22,
    justifyContent: "center",
  },
  circleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    textAlign: "center",
  },
  divider: {
    width: 1,
    height: 54,
    marginHorizontal: 2,
    opacity: 0.7,
  },
  emptyCard: {
    minHeight: 116,
    width: 172,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  noticeCard: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});
