import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageHeaderTitleEyebrow: {
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  pageHeaderTitleMain: {
    textAlign: "center",
    lineHeight: 26,
  },
  card: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardTitleText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  cardBodyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  loadingRow: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  optionList: {
    paddingBottom: 12,
  },
  optionRow: {
    minHeight: 66,
    borderRadius: 22,
    marginHorizontal: 8,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    opacity: 0.76,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginBottom: 3,
  },
  optionBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  customPanel: {
    paddingTop: 18,
  },
  selectedBlock: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  selectedLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  searchBox: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingVertical: 0,
  },
  peopleList: {
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: "hidden",
  },
  personRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  initialsAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  initialsText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  personUsername: {
    fontSize: 11,
    lineHeight: 15,
  },
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyPeopleState: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPeopleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
