import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  headerBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Two documents on one scroll, so each needs a heading that separates them.
  sectionHeading: {
    marginTop: 20,
    marginBottom: 8,
  },
  termsSection: {
    marginBottom: 14,
    gap: 4,
  },
  termsTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  termsBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
