import { StyleSheet } from "react-native";

export default StyleSheet.create({
  modal: {
    width: "94%",
    maxHeight: 520,
    borderRadius: 26,
  },
  content: {
    minHeight: 0,
  },
  inputShell: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    minHeight: 154,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    fontSize: 11,
    fontWeight: "700",
  },
  feedbackBanner: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBannerText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 18,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 18,
  },
});
