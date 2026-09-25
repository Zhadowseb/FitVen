import { StyleSheet } from "react-native";

// Layout only: colours are applied inline from `theme` (src/Pages/AGENTS.md).
// The header and scroll layout are the Statistics page's own.
export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  headerEyebrow: {
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    textAlign: "center",
    lineHeight: 26,
  },
  loadingState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    gap: 22,
  },
});
