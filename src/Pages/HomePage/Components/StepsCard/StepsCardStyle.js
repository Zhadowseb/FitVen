import { StyleSheet } from "react-native";

// Layout only; the card's colours are set inline from the theme (a Style.js is
// read once, before the accent is applied - see src/Pages/AGENTS.md).
export default StyleSheet.create({
  card: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    minHeight: 44,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walked: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  training: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 12,
    fontWeight: "700",
  },
  spacer: {
    flex: 1,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  askText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "700",
  },
  askButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  askButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
