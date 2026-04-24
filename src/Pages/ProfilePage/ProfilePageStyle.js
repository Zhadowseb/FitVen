import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 28,
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
  profileCard: {
    marginHorizontal: 0,
    marginVertical: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  accountCard: {
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderRadius: 24,
  },
  cardEyebrow: {
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  cardTitle: {
    marginBottom: 8,
  },
  accountValue: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardBody: {
    lineHeight: 20,
  },
  identityList: {
    marginTop: 16,
    gap: 14,
  },
  identityGroup: {
    gap: 4,
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  identityValue: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  formSection: {
    marginTop: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputWrapper: {
    marginTop: 0,
  },
  bioInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 18,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackBanner: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBannerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    marginTop: 24,
  },
  primaryButton: {
    marginTop: 0,
    borderRadius: 18,
    height: 52,
  },
  logoutButton: {
    marginTop: 0,
  },
  errorText: {
    marginTop: 12,
    textAlign: "center",
  },
});
