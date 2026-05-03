import { StyleSheet } from "react-native";

export default StyleSheet.create({
  heroShell: {
    width: "95%",
    alignSelf: "center",
    marginBottom: 14,
  },

  heroCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 26,
    paddingVertical: 26,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },

  heroAccentPrimary: {
    position: "absolute",
    width: 410,
    height: 380,
    top: -204,
    right: -170,
  },

  heroAccentSecondary: {
    position: "absolute",
    width: 390,
    height: 350,
    bottom: -180,
    left: -168,
  },

  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  heroStatusCluster: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 30,
  },

  heroStatusDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginRight: 10,
    opacity: 0.78,
  },

  heroStatusText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 4,
  },

  heroTopPill: {
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  heroTopPillIcon: {
    fontSize: 12,
    fontWeight: "800",
    marginRight: 7,
  },

  heroTopPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
  },

  heroMetricGrid: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 22,
  },

  heroMetricCard: {
    flex: 1,
    minHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
    justifyContent: "center",
  },

  heroMetricLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 3.4,
    marginBottom: 14,
  },

  heroMetricValue: {
    fontSize: 39,
    lineHeight: 43,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  heroDistanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  heroMetricUnit: {
    marginLeft: 8,
    marginBottom: 5,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },

  heroSmallMetricRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 24,
  },

  heroSmallMetricCard: {
    flex: 1,
    minHeight: 82,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    justifyContent: "center",
  },

  heroSmallMetricLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 2.7,
    marginBottom: 13,
  },

  heroSmallMetricValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  heroSmallMetricUnit: {
    marginLeft: 5,
    marginBottom: 2,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  heroInlineValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  heroStartedValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },

  heroPrimaryButton: {
    height: 62,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff7a2b",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },

  heroPlayIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginRight: 14,
  },

  heroPauseIcon: {
    width: 12,
    height: 15,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRadius: 2,
  },

  heroPrimaryButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },

  sectionShell: {
    width: "95%",
    alignSelf: "center",
    marginBottom: 12,
  },

  sectionCard: {
    width: "100%",
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  sectionTitleBlock: {
    flex: 1,
  },

  sectionBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },

  sectionBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  sectionTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
  },

  sectionAddButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  tableShell: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 2,
    paddingTop: 6,
    paddingBottom: 2,
    overflow: "visible",
  },

  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyStateText: {
    fontSize: 12,
    fontWeight: "700",
  },

  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 4,
  },

  grid: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  sharedGrid: {
    borderColor: "#4b4b4bff",
    borderBottomWidth: 0.2,
  },

  lastGrid: {
    borderBottomWidth: 0,
  },

  title: {
    borderRightWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  set: {
    width: "20%",
    borderRightWidth: 0.2,
  },

  distance: {
    width: "20%",
    borderRightWidth: 0.2,
    justifyContent: "center",
    alignItems: "center",
  },

  pace: {
    width: "20%",
    borderRightWidth: 0.2,
    justifyContent: "center",
    alignItems: "center",
  },

  time: {
    width: "20%",
    borderRightWidth: 0.2,
    justifyContent: "center",
    alignItems: "center",
  },

  zone: {
    width: "20%",
    justifyContent: "center",
    alignItems: "center",
  },

  headerCellLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },

  headerCellUnit: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },

  timeRunning: {
    borderWidth: 0.6,
    borderColor: "#f0ff21",
    borderRadius: 5,
  },

  set_number_button: {
    justifyContent: "center",
    alignItems: "center",
    width: 24,
    height: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    backgroundColor: "rgb(32, 30, 29)",
    borderTopColor: "rgb(106, 100, 98)",
    borderLeftColor: "rgb(106, 100, 98)",
    borderBottomColor: "rgb(8, 7, 7)",
    borderRightColor: "rgb(8, 7, 7)",
  },

  set_number_button_text: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  setCellButton: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },

  setNumberBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  setNumberText: {
    fontWeight: "800",
  },

  pausePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  pauseText: {
    fontSize: 11,
    fontWeight: "700",
  },

  activeTimePill: {
    minWidth: 74,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  activeTimeText: {
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  zoneButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },

  zonePill: {
    minWidth: 34,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  zoneText: {
    fontWeight: "800",
  },

  bottomsheet_title: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2e2e2eff",
    paddingBottom: 30,
  },

  togglepauseorworking: {
    borderWidth: 2,
    borderRadius: 15,
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    width: 120,
  },

  bottomsheet_body: {
    justifyContent: "center",
    padding: 20,
    paddingLeft: 0,
  },

  option: {
    flexDirection: "row",
    paddingTop: 20,
  },

  option_text: {
    paddingLeft: 10,
    fontWeight: "600",
    fontSize: 16,
  },

  zone_dropdown_container: {
    position: "absolute",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    elevation: 6,
    zIndex: 10,
  },

  zone_dropdown_container_down: {
    top: 28,
  },

  zone_dropdown_container_up: {
    bottom: 28,
  },
});
