import { StyleSheet } from "react-native";

export default StyleSheet.create({
  shortcutCard: {
    minHeight: 178,
    padding: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 22,
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 0,
  },

  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },

  cardButton: {
    minHeight: 178,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },

  cardButtonDisabled: {
    opacity: 0.78,
  },

  headerRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  eyebrowRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
  },

  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 1.9,
    textTransform: "uppercase",
    flexShrink: 0,
  },

  eyebrowDetail: {
    flex: 1,
    minWidth: 0,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginLeft: 5,
  },

  statusPill: {
    minWidth: 58,
    maxWidth: 124,
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  statusPillText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  playButton: {
    width: 62,
    height: 62,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },

  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 5,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },

  mainContent: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    padding: 0,
    marginBottom: 8,
    lineHeight: 25,
  },

  metaRow: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  metaType: {
    maxWidth: 116,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },

  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 9,
    opacity: 0.72,
  },

  previewList: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
  },

  previewItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 7,
    justifyContent: "center",
  },

  previewDot: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  previewLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    paddingLeft: 11,
  },

  previewDetail: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    paddingLeft: 11,
  },

  previewMore: {
    width: 42,
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  previewMoreText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },

  progressFooter: {
    marginTop: 15,
  },

  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  footerTextRow: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 9,
  },

  progressLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },

  actionLabel: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
