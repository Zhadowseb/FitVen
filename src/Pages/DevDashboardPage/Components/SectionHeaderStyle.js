import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  first: {
    marginTop: 4,
  },
  normal: {
    marginTop: 22,
  },
  wide: {
    marginTop: 26,
  },
  title: {
    // The title keeps its width; the detail on the right gives way first.
    flexShrink: 0,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  detail: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
});
