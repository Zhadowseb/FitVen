import { StyleSheet } from "react-native";

export default StyleSheet.create({
  modal: {
    width: "94%",
    borderRadius: 28,
    padding: 18,
  },
  content: {
    gap: 18,
    minHeight: 0,
  },
  hero: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 18,
  },
  actions: {
    gap: 10,
    marginTop: 2,
  },
  primaryAction: {
    borderRadius: 18,
  },
  secondaryAction: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 18,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cancelAction: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
