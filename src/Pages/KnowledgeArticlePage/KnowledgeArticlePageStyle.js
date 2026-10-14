import { StyleSheet } from "react-native";

// Layout only; colours are set inline from the theme (see src/Pages/AGENTS.md).
export default StyleSheet.create({
  content: {
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  body: {
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 2,
  },
  category: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  meta: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  h1: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
  },
  inShort: {
    marginTop: 4,
    padding: 16,
    gap: 10,
  },
  inShortTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  bullet: {
    flexDirection: "row",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    marginTop: 8,
    borderRadius: 3,
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
  },

  h2: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  paragraph: {
    fontSize: 14.5,
    lineHeight: 22,
  },
  footnote: {
    fontSize: 11,
  },

  block: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  zoneRows: {
    paddingHorizontal: 16,
  },
  zoneRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  zoneDot: {
    width: 10,
    height: 10,
    marginTop: 4,
    borderRadius: 3,
  },
  zoneTexts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  zoneHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  zoneName: {
    fontSize: 14,
    fontWeight: "800",
  },
  zoneRange: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  zoneNote: {
    fontSize: 13,
    lineHeight: 19,
  },

  sources: {
    marginTop: 10,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  source: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  sourceNumber: {
    width: 20,
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  sourceTexts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sourceTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  sourceByline: {
    fontSize: 11.5,
    lineHeight: 16,
  },

  aiBox: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  aiText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  aiStrong: {
    fontWeight: "800",
  },
  footer: {
    fontSize: 11.5,
    lineHeight: 17,
    paddingBottom: 8,
  },

  missing: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
  },
});
