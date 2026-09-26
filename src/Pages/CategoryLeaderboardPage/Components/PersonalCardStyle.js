import { StyleSheet } from "react-native";

// Layout only: radius 18, padding 13/14, three fields on radius 13.
export default StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 11,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 30,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  valueGroup: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  valueShape: {
    width: 72,
    height: 22,
    borderRadius: 7,
  },
  fields: {
    flexDirection: "row",
    gap: 8,
  },
  field: {
    flex: 1,
    minWidth: 0,
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 2,
  },
  fieldName: {
    fontSize: 11,
    fontWeight: "800",
  },
  numberGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    minWidth: 0,
  },
  number: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    fontVariant: ["tabular-nums"],
  },
  numberUnit: {
    flexShrink: 0,
    fontSize: 10.5,
    fontWeight: "700",
  },
  numberShape: {
    width: "70%",
    height: 16,
    borderRadius: 6,
    marginVertical: 3.5,
  },
  foot: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    fontVariant: ["tabular-nums"],
  },
});
