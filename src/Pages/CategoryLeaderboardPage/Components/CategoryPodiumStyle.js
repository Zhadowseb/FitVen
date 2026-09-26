import { StyleSheet } from "react-native";

// Layout only; the exercise board's podium card, with the category page's
// measures - avatars 56 and 46, plinths 58, 42 and 32.
export default StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 20,
    paddingHorizontal: 12,
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
  },
  // The picture and the name: what opens the profile. The column's own
  // spacing, so the podium looks the same with the link or without.
  person: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 6,
  },
  name: {
    maxWidth: "100%",
    fontSize: 12.5,
    fontWeight: "800",
    textAlign: "center",
  },
  valueGroup: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 3,
  },
  value: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  valueFirst: {
    fontSize: 19,
  },
  unit: {
    flexShrink: 0,
    fontSize: 10.5,
    fontWeight: "700",
  },
  plinth: {
    width: "100%",
    marginTop: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  plinthText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
