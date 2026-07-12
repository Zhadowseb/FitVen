import { StyleSheet } from "react-native";

export default StyleSheet.create({
  section: {
    marginTop: 18,
    gap: 12,
  },
  headerRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headerSpacer: {
    flex: 1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  livePillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  livePillText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 4,
    gap: 18,
  },
  circleCard: {
    width: 72,
    alignItems: "center",
    gap: 7,
  },
  youDivider: {
    width: 1,
    height: 68,
    borderRadius: 1,
    alignSelf: "flex-start",
  },
  avatarShell: {
    position: "relative",
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 999,
  },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  addRing: {
    borderStyle: "dashed",
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  nameStatusColumn: {
    alignItems: "center",
    gap: 1,
  },
  circleName: {
    maxWidth: 72,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  addLabel: {
    fontSize: 12,
    fontWeight: "700",
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
  loadingSlot: {
    minHeight: 116,
    width: 172,
    alignItems: "center",
    justifyContent: "center",
  },
  ringLoadingShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  noticeCard: {
    marginHorizontal: 20,
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
