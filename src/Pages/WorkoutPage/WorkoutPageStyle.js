import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },

  pageHeaderTitleEyebrow: {
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 1,
  },

  pageHeaderTitleMain: {
    textAlign: "center",
  },

  pageHeaderTitleMeta: {
    marginTop: 1,
    textAlign: "center",
  },

  pageHeaderTitleMetaPill: {
    marginTop: 3,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },

  bottomsheetTitle: {
    borderBottomWidth: 1,
    paddingBottom: 20,
    alignItems: "center"
  },
  bottomsheetBody: {
    justifyContent: "center",
    padding: 20,
    paddingLeft: 0,
  },
  option: {
    flexDirection: "row",
    paddingTop: 20,
  },
  optionText: {
    paddingLeft: 10,
    fontWeight: 600,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalAction: {
    flex: 1,
  },
});
