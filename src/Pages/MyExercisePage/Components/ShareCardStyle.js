import { StyleSheet } from "react-native";

// Layout only; every colour is applied inline from the theme.
export default StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 8,
  },
  headRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  body: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginTop: 4,
    marginBottom: 2,
  },
  statusRow: {
    minHeight: 32,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 2,
  },
  status: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  link: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkAlone: {
    alignSelf: "flex-start",
  },
  linkText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "800",
  },
  helper: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  nudge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  nudgeIcon: {
    marginTop: 1,
  },
  nudgeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
