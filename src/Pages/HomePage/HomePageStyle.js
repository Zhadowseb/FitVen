import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  contentContainer: {
    paddingBottom: 28,
  },
  feedFooter: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  socialSectionSpacer: {
    marginTop: 8,
  },
  postOptionsTitle: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2e2e2e",
    paddingBottom: 18,
  },
  postOptionsTitleText: {
    fontSize: 16,
    fontWeight: "700",
  },
  postOptionsBody: {
    paddingVertical: 18,
  },
  postOption: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postOptionText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
