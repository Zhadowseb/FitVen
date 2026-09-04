import { StyleSheet } from "react-native";

export default StyleSheet.create({
  postNoteInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },


























  statusBarStrip: {
    width: "100%",
  },

  topArea: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },

  topGlow: {
    position: "absolute",
    top: -140,
    right: -90,
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  navButton: {
    width: 40,
    height: 40,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  navTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "800",
  },

  navDate: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },

  timerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
    paddingHorizontal: 16,
    marginTop: 16,
  },

  timerValue: {
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: -1,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  timerMeta: {
    gap: 4,
    paddingBottom: 6,
  },

  timerMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },

  timerMetaLabel: {
    minWidth: 32,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },

  timerMetaValue: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  timerMetaTotal: {
    fontSize: 12,
    fontWeight: "700",
  },

  timerSpacer: {
    flex: 1,
  },

  timerActions: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 3,
  },

  timerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  timerPauseIcon: {
    flexDirection: "row",
    gap: 4,
  },

  timerPauseBar: {
    width: 3,
    height: 14,
    borderRadius: 1,
  },

  timerPlayIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginLeft: 3,
  },

  topAreaSpacer: {
    height: 20,
  },

  progressTrack: {
    width: "100%",
    height: 4,
  },

  progressFill: {
    height: 4,
  },

  toolbar: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  toolbarLabel: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingLeft: 2,
  },

  toolbarLabelText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },

  toolbarLabelNumber: {
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  workingSets: {
    width: "100%",
    // The cards carry marginHorizontal: 6, so 10 here lines them up with the
    // 16dp inset used by the header and the toolbar.
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
});
