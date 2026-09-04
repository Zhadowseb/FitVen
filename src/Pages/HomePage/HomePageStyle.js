import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 28,
  },
  errorBanner: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  errorBannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  errorBannerAction: {
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  feedEmptyCard: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    alignItems: "center",
  },
  feedEmptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  feedEmptyBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  feedEmptyAction: {
    marginTop: 4,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  feedEmptyActionText: {
    fontSize: 13,
    fontWeight: "800",
  },

  feedFooter: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  postOptionsTitle: {
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: 18,
  },
  postOptionsTitleText: {
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: "700",
  },
});
