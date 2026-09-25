import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  // The chain's initials beside a centre: the same 32 px box as the review
  // icon on the centre page, squared off rather than round.
  chainTile: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chainTileText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sheetBody: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  sheetCheck: {
    width: 22,
    alignItems: "center",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 2,
  },
  sheetRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetRowMeta: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  sheetRowTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  sheetSearch: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    paddingVertical: 0,
  },
  sheetSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
});
