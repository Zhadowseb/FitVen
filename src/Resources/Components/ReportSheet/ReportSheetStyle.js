import { StyleSheet } from "react-native";

// Colours are read from `theme` in the component body, never here:
// applyAccentTheme() mutates Colors at runtime, so a colour captured in
// StyleSheet.create is the colour from whenever the module first loaded.
export default StyleSheet.create({
  body: {
    gap: 14,
    paddingBottom: 6,
  },
  heading: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },

  reasonList: {
    gap: 8,
  },
  reason: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reasonLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "600",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  noteInput: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  noteCounter: {
    alignSelf: "flex-end",
    fontSize: 11,
  },

  blockRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  blockCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  blockDetail: {
    fontSize: 11,
    lineHeight: 15,
  },

  feedback: {
    fontSize: 13,
    lineHeight: 18,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
