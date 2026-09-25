import { StyleSheet } from "react-native";

// Layout only: colours are applied inline from `theme` (src/Pages/AGENTS.md).
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
  // The overview and "Go deeper" under it, spaced like the overview's own
  // sections.
  stack: {
    gap: 22,
  },
});
