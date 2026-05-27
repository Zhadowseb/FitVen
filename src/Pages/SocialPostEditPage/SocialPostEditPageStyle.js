import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitle: {
    textAlign: "center",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  postTitle: {
    marginTop: 6,
    marginBottom: 16,
  },
  loadingRow: {
    minHeight: 152,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  noteInput: {
    minHeight: 150,
    borderRadius: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  characterCount: {
    alignSelf: "flex-end",
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  footerButton: {
    flex: 1,
  },
});
