import { StyleSheet } from "react-native";

// Layout only. Colours are read from `theme` in the component body:
// applyAccentTheme() mutates Colors at runtime, and StyleSheet.create runs once.
export default StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 32,
  },
  // Room under the list for your pinned row, so the "···" that ends the
  // list comes to rest just above it.
  listContentPinned: {
    paddingBottom: 108,
  },
  listHeader: {
    gap: 14,
  },
  listHeaderSpaced: {
    marginBottom: 14,
  },
  stack: {
    gap: 14,
  },
  // A list that is being replaced: still there, visibly not the answer yet.
  dimmed: {
    opacity: 0.5,
  },
  stateCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 5,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBody: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  bannerAction: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  pinned: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 12,
  },
});
