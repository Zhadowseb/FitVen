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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 16,
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
    borderRadius: 18,
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
  cardEyebrow: {
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  settingList: {
    marginTop: 18,
    gap: 10,
  },
  settingListCompact: {
    gap: 10,
  },
  loadingRow: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceRow: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  choiceCopy: {
    flex: 1,
    minWidth: 0,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  scopeNote: {
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  groupNote: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  previewFrame: {
    marginTop: 8,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  previewBody: {
    gap: 5,
  },
  previewStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  previewStat: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  previewTopSetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  previewStarSlot: {
    width: 11,
    alignItems: "center",
  },
  previewTopSetName: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  previewTopSetValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  previewEmptyText: {
    fontSize: 12,
    lineHeight: 16,
  },
  choiceControl: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  settingsButton: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsButtonContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsButtonCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingsButtonTitle: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  settingsButtonBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
});
