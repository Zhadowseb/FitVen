import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  headerAction: {
    position: "absolute",
    right: 0,
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    textAlign: "center",
  },
});
