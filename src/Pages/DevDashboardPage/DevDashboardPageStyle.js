import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  periodPicker: {
    marginBottom: 16,
  },
  error: {
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 12,
  },
  loading: {
    marginTop: 40,
  },
  opsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 10,
  },
  opsBox: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
  },
  opsValue: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  opsLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  unreadBadge: {
    height: 18,
    minWidth: 18,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  spacer: {
    flex: 1,
  },
  seeAll: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  feedbackList: {
    gap: 8,
  },
  emptyFeedback: {
    fontSize: 12.5,
    fontWeight: "700",
    paddingVertical: 12,
  },
  loadMore: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  loadMoreText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  notAdmin: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  notAdminText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
  },
});
