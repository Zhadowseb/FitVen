import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component. The reasons and the
// note are measured like the app's other report dialogs.
export default StyleSheet.create({
  header: {
    gap: 4,
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  message: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
  },

  reasons: {
    gap: 8,
  },
  reason: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
  },

  note: {
    marginTop: 12,
  },
  noteInput: {
    minHeight: 84,
    paddingTop: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  count: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  footer: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
  },
  button: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  cancelButton: {
    flex: 1,
  },
  sendButton: {
    flex: 1.6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
