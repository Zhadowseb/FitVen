import { StyleSheet } from "react-native";

export default StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  head: {
    gap: 6,
  },
  title: {
    width: "42%",
    height: 16,
    borderRadius: 6,
  },
  line: {
    width: "58%",
    height: 10,
    borderRadius: 5,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  // The card's MedalAvatar: a 40 picture with its gap and ring around it.
  avatar: {
    width: 49,
    height: 49,
    borderRadius: 24.5,
  },
  topCopy: {
    flex: 1,
    gap: 6,
  },
  name: {
    width: "62%",
    height: 13,
    borderRadius: 6,
  },
  meta: {
    width: "40%",
    height: 10,
    borderRadius: 5,
  },
  value: {
    width: 56,
    height: 22,
    borderRadius: 7,
  },
  me: {
    width: "48%",
    height: 11,
    borderRadius: 5,
  },
});
