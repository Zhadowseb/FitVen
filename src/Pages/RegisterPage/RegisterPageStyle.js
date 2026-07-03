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

  title: {
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "800",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },

  registerCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 28,
  },

  cardLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    marginBottom: 10,
  },

  cardBody: {
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 280,
  },

  formSection: {
    marginTop: 14,
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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

  connectionStatus: {
    marginTop: 12,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 19,
  },
});
