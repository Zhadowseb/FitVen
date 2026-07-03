import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  listHeader: {
    marginBottom: 6,
  },
  heroCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  searchBox: {
    minHeight: 48,
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
  },
  summaryRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  exerciseRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  exerciseRowLast: {
    borderBottomWidth: 0,
  },
  exerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  exerciseStatus: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
  },
  switchWrap: {
    width: 54,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  emptyState: {
    paddingVertical: 42,
    alignItems: "center",
  },
  emptyTitle: {
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 8,
    maxWidth: 280,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
