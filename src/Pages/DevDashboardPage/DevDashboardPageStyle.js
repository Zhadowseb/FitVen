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
  // On the title's baseline, at the right.
  updated: {
    alignSelf: "flex-end",
    marginBottom: 5,
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  error: {
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 12,
  },
  loading: {
    marginTop: 40,
  },
  feedbackList: {
    gap: 8,
  },
  feedbackError: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginBottom: 8,
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
