import { StyleSheet } from "react-native";

// Layout only. Every colour is applied inline from the theme, so light, dark
// and the accent themes all reach it.
export default StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header: Cancel, the title, Save
  header: {
    height: 44,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Equal sides keep the title centred between a Cancel and a Save of
  // different widths; the minimum keeps a long title from squeezing them.
  headerSide: {
    flex: 1,
    minWidth: 64,
    flexDirection: "row",
    alignItems: "center",
  },
  headerSideEnd: {
    justifyContent: "flex-end",
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  headerTitle: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  savePill: {
    height: 34,
    minWidth: 64,
    borderRadius: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: "800",
  },

  feedbackBanner: {
    marginHorizontal: 20,
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBannerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  // Photo
  avatarBlock: {
    marginTop: 22,
    alignItems: "center",
    gap: 10,
  },
  changePhotoText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  avatarHint: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    textAlign: "center",
  },

  // Fields
  fields: {
    marginTop: 22,
    gap: 18,
  },
  field: {
    gap: 7,
  },
  fieldLabelRow: {
    minHeight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldLabel: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  fieldCounter: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  fieldAction: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  fieldHelper: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  inputBox: {
    height: 48,
    borderRadius: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    padding: 0,
  },
  bioBox: {
    minHeight: 84,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bioInput: {
    minHeight: 60,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    padding: 0,
    textAlignVertical: "top",
  },
  usernameValue: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  birthYearValue: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  agePill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  agePillText: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  sexControl: {
    alignSelf: "flex-start",
  },
  locked: {
    opacity: 0.5,
  },
});
