import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },

  heroAccentPrimary: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -96,
    right: -72,
    opacity: 0.18,
  },

  heroAccentSecondary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -88,
    left: -42,
    opacity: 0.1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 32,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  heroBlock: {
    marginBottom: 22,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },

  registerCard: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 28,
  },

  formSection: {
    marginTop: 14,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  inputWrapper: {
    marginTop: 0,
  },

  fieldHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },

  actions: {
    marginTop: 18,
  },

  primaryButton: {
    borderRadius: 18,
    height: 52,
  },


  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
  },

  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  doneIconRow: {
    marginBottom: 10,
  },

  doneTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    marginBottom: 8,
  },

  doneBody: {
    fontSize: 14,
    lineHeight: 21,
  },

  doneButton: {
    marginTop: 20,
  },

  privacyLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  privacyLinkText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
