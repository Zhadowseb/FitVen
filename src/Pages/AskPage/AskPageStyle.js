import { StyleSheet } from "react-native";

// Layout only, for the whole Ask page and its components: every colour is set
// inline from the theme (a Style.js is read once, before the accent is applied
// - see src/Pages/AGENTS.md). Sizes follow design/AskEmpty.dc.html and
// AskAnswer.dc.html; nothing that is tapped is under 44 high, and text sits in
// boxes that grow with it, not in fixed heights.
export default StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerTitleText: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  badgeTouch: {
    minHeight: 44,
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
  },
  badgeText: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  /* the conversation */
  scroll: {
    flex: 1,
  },
  messages: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 14,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 18,
  },
  userText: {
    fontSize: 15,
    lineHeight: 21,
  },
  answerRow: {
    flexDirection: "row",
    gap: 10,
  },
  avatarTile: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  answerBody: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  answerText: {
    fontSize: 15,
    lineHeight: 22,
  },

  /* chart block */
  chartCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  chartTitle: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  chartRange: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
  },
  chartPlot: {
    marginTop: 8,
  },
  chartFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  chartFootText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  chartSummary: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },

  /* suggestion block */
  suggestion: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  suggestionEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  suggestionText: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 19,
  },
  suggestionButtons: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  suggestionStatus: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionStatusText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  /* source line */
  sourceRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  sourceText: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "700",
  },
  sourceLink: {
    minHeight: 44,
    justifyContent: "center",
  },

  /* typing, notices */
  typingRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  typingDots: {
    flexDirection: "row",
    gap: 5,
    paddingVertical: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  notice: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noticeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  /* the empty screen */
  empty: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 18,
  },
  emptyHead: {
    gap: 8,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  emptyIntro: {
    fontSize: 14,
    lineHeight: 21,
  },
  suggestRows: {
    gap: 8,
  },
  suggestRow: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestRowText: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "700",
  },

  /* model picker */
  tiers: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tierChip: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tierName: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
  },
  tierLeft: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  /* input */
  inputBar: {
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  inputField: {
    minHeight: 46,
    paddingLeft: 16,
    paddingRight: 2,
    borderRadius: 23,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 120,
    paddingVertical: 8,
    fontSize: 15,
  },
  inputIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
  },

  /* consent */
  consent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 18,
  },
  consentTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  consentIntro: {
    fontSize: 15,
    lineHeight: 22,
  },
  consentCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  consentCardTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  consentCardBody: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  consentNote: {
    fontSize: 13,
    lineHeight: 19,
  },
  consentButtons: {
    gap: 8,
  },
  consentPrimary: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  consentSecondary: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  consentButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  consentError: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "700",
  },

  /* sheets */
  sheetBody: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
  },
  sheetText: {
    fontSize: 15,
    lineHeight: 22,
  },
  sheetRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetRowText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
});
