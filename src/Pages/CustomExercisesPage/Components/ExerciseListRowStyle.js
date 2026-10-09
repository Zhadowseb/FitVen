import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  column: { flex: 1, minWidth: 0, gap: 6 },
  name: { fontSize: 15, fontWeight: "800", lineHeight: 19 },
  description: { fontSize: 11.5, fontWeight: "600", lineHeight: 15 },
  owner: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 },
  ownerName: { flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: "700", lineHeight: 14 },
  users: { fontSize: 10.5, fontWeight: "800", lineHeight: 14, fontVariant: ["tabular-nums"] },

  // The skeleton: the same geometry, in blocks.
  skeletonThumb: { width: 86, height: 86, borderRadius: 14 },
  skeletonName: { width: "62%", height: 14, borderRadius: 6 },
  skeletonDescription: { width: "88%", height: 10, borderRadius: 5 },
  skeletonTags: { flexDirection: "row", gap: 5 },
  skeletonTagShort: { width: 52, height: 20, borderRadius: 6 },
  skeletonTagLong: { width: 66, height: 20, borderRadius: 6 },
  skeletonAvatar: { width: 20, height: 20, borderRadius: 10 },
  skeletonOwner: { width: "42%", height: 10, borderRadius: 5 },
});
