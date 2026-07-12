import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 11,
  },

  metaLeft: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  metaHint: {
    fontSize: 10.5,
    fontWeight: "600",
  },

  dividerFull: {
    height: 1,
  },

  dividerInset: {
    height: 1,
    marginHorizontal: 18,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },

  rowName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
  },

  rowValueGroup: {
    flexDirection: "row",
    alignItems: "baseline",
  },

  rowValue: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  rowUnit: {
    fontSize: 11,
    fontWeight: "800",
  },

  emptyState: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
    gap: 6,
  },

  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 16,
  },

  addButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  addButtonText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
});
