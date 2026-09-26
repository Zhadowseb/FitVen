import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardSpaced: {
    marginTop: 8,
  },
  header: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    flexShrink: 0,
    fontSize: 14.5,
    fontWeight: "800",
  },
  ids: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  summary: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "right",
  },
  toggle: {
    width: 14,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    borderTopWidth: 1,
  },
});
