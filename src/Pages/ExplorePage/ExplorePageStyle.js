import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  pressed: { opacity: 0.7 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  title: { flex: 1, fontSize: 28, fontWeight: "800", letterSpacing: -0.5, lineHeight: 32 },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "900", lineHeight: 12 },

  // Search
  search: {
    marginTop: 14,
    marginHorizontal: 20,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchPlaceholder: { flex: 1, fontSize: 13.5, fontWeight: "600" },

  // Tiles
  tiles: { flexDirection: "row", gap: 8, marginTop: 14, marginHorizontal: 20 },
  tile: {
    flex: 1,
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileCopy: { gap: 1 },
  tileTitle: { fontSize: 15, fontWeight: "800", lineHeight: 19 },
  tileDetail: { fontSize: 10.5, fontWeight: "700", lineHeight: 14 },

  // Rows
  sectionHead: {
    marginTop: 22,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sectionAction: { fontSize: 11.5, fontWeight: "800" },

  // Your centre
  gymCard: {
    marginTop: 9,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  gymTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  gymImage: { width: 56, height: 56, borderRadius: 12 },
  gymImageFallback: { alignItems: "center", justifyContent: "center" },
  gymCopy: { flex: 1, minWidth: 0, gap: 3 },
  gymName: { fontSize: 15, fontWeight: "800", lineHeight: 19 },
  gymLine: { fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  latest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  latestCopy: { flex: 1, minWidth: 0, gap: 1 },
  latestName: { fontSize: 13, fontWeight: "800", lineHeight: 17 },
  latestMeta: { fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  latestWeight: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  latestKg: { fontSize: 17, fontWeight: "800", lineHeight: 21, fontVariant: ["tabular-nums"] },
  latestUnit: { fontSize: 10, fontWeight: "800", lineHeight: 16 },
  pickGym: {
    marginTop: 9,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
