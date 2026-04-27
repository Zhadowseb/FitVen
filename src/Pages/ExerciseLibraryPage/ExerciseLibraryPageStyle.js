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
    paddingTop: 20,
    paddingBottom: 16,
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
  quickAccessSection: {
    marginBottom: 18,
  },
  quickAccessGrid: {
    gap: 12,
  },
  quickAccessCard: {
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    overflow: "hidden",
  },
  quickAccessAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  quickAccessCardHeader: {
    marginBottom: 10,
  },
  quickAccessCardEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  quickAccessCardTitle: {
    lineHeight: 28,
  },
  quickAccessCardDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
  quickAccessMetricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  quickAccessMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 74,
  },
  quickAccessMetricValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  quickAccessMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
    lineHeight: 12,
    textTransform: "uppercase",
    marginTop: 4,
    textAlign: "center",
  },
  quickAccessFooter: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickAccessFooterText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  quickAccessFooterAccent: {
    width: 28,
    height: 8,
    borderRadius: 999,
  },
  quickAccessEmbeddedCatalog: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
  },
});
