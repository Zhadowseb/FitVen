import { StyleSheet } from "react-native";

export default StyleSheet.create({
  bar: {
    marginHorizontal: 20,
    marginTop: 10,
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    gap: 2,
  },
  text: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  reason: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  action: {
    fontSize: 12.5,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
