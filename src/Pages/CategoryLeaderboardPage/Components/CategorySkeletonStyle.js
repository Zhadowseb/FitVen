import { StyleSheet } from "react-native";

// Layout only; the shapes stand where CategoryPodium and RankRow draw.
export default StyleSheet.create({
  stack: {
    gap: 14,
  },
  podiumCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 20,
    paddingHorizontal: 12,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    borderRadius: 999,
  },
  podiumName: {
    width: "58%",
    height: 10,
    borderRadius: 5,
  },
  podiumValue: {
    width: "42%",
    height: 14,
    borderRadius: 6,
  },
  plinth: {
    width: "100%",
    marginTop: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  rank: {
    width: 20,
    height: 10,
    borderRadius: 5,
  },
  rowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  rowCopy: {
    flex: 1,
    gap: 7,
  },
  rowName: {
    height: 11,
    borderRadius: 5,
  },
  rowMeta: {
    width: "38%",
    height: 8,
    borderRadius: 4,
  },
  rowValue: {
    width: 44,
    height: 14,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
