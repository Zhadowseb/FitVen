import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  headerTitle: {
    marginBottom: 0,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  updated: {
    fontSize: 12,
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
  },
});
