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
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  search: {
    marginHorizontal: 20,
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    fontSize: 15,
  },

  chips: {
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "800",
  },

  featured: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    gap: 10,
  },
  featuredTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featuredLabel: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  featuredTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  featuredSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
  },

  pill: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  list: {
    marginHorizontal: 20,
    marginTop: 18,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  row: {
    minHeight: 64,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
  },
  rowTexts: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  category: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  rowTitle: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "800",
  },
  rowMeta: {
    fontSize: 11.5,
    fontWeight: "600",
  },

  empty: {
    marginHorizontal: 20,
    marginTop: 24,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
