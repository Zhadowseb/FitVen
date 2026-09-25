import { StyleSheet } from "react-native";

// Layout only: colours are applied inline from `theme` (src/Pages/AGENTS.md).
// The section head and card are the overview's, so the two read as one page.
export default StyleSheet.create({
  section: { gap: 12 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  overline: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },

  card: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    minHeight: 60,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  teaser: { fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
});
