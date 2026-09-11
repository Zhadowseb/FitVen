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
  // The Done button carries a word and a count, so it cannot be the 38 px
  // square the custom-exercise plus uses.
  headerDoneAction: {
    width: "auto",
    minWidth: 64,
    paddingHorizontal: 12,
  },
  headerDoneText: { fontSize: 14, fontWeight: "700" },
  // The Done button is absolutely positioned on the right, so the centred
  // title has to be kept out from under it.
  headerTitleGroupWithAction: {
    paddingRight: 92,
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
