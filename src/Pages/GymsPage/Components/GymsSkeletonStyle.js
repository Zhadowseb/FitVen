import { StyleSheet } from "react-native";

export default StyleSheet.create({
  list: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  rowCopy: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    width: "55%",
    height: 13,
    borderRadius: 6,
  },
  rowMeta: {
    width: "35%",
    height: 10,
    borderRadius: 5,
  },
  header: {
    gap: 8,
  },
  crumbs: {
    width: 150,
    height: 11,
    borderRadius: 5,
  },
  title: {
    width: 170,
    height: 24,
    borderRadius: 8,
  },
  subtitle: {
    width: 110,
    height: 10,
    borderRadius: 5,
  },
});
