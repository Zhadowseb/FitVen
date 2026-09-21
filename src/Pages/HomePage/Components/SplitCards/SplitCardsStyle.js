import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 10,
    marginHorizontal: 20,
  },
  scrollRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  card: {
    // stretch on the row keeps every card as tall as the tallest, so a group
    // with no settled weekday does not make its neighbour look wrong.
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
  },
  cardFlex: {
    flex: 1,
  },
  allCard: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    gap: 5,
  },
  emptyTitle: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  emptyMessage: {
    fontSize: 13,
    fontWeight: "700",
  },
  name: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  weekdays: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  meta: {
    fontSize: 10.5,
    fontWeight: "700",
  },
});
