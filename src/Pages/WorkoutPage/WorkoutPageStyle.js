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
    borderBottomColor: "#2e2e2eff",
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
    fontSize: 16,
  },
  filterOption: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 0,
  },
  filterOptionText: {
    fontWeight: 600,
    fontSize: 16,
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
