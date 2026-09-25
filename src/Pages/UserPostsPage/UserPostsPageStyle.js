import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component. The cards carry
// the feed's own 14 either side, and the header the page's 20, as on the feed.
export default StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 2,
    paddingHorizontal: 20,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  title: { fontSize: 23, fontWeight: "800", letterSpacing: -0.5, lineHeight: 27 },
  stateBlock: { minHeight: 320, justifyContent: "center" },
  footer: { paddingVertical: 18, alignItems: "center" },
  empty: {
    marginTop: 14,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", lineHeight: 20, textAlign: "center" },
  emptyBody: { fontSize: 13, fontWeight: "600", lineHeight: 18, textAlign: "center" },
});
