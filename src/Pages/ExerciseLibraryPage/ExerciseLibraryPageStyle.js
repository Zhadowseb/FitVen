import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the components.
export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    padding: 0,
  },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  library: {
    marginTop: 8,
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
