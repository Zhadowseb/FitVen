import { StyleSheet } from "react-native";

export default StyleSheet.create({
  form: {
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  fields: {
    flexDirection: "row",
    gap: 6,
  },
  field: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  label: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  input: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  message: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  button: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
});
