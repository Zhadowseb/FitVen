import { StyleSheet } from "react-native";

export default StyleSheet.create({
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: "700",
    flexShrink: 1,
  },
  errorRetry: {
    fontSize: 12.5,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    // The bottom bar is a sibling in the layout, not something floating over
    // the content, so nothing here has to make room for it. 120 was that
    // clearance written down anyway, and it left about ninety points of empty
    // scroll under the last block. 28 is what the feed uses.
    paddingBottom: 28,
  },
  // The counter and the quick start share a row and the same height, so the
  // number lines up with the buttons beside it rather than floating above them.
  quickRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 16,
    marginHorizontal: 20,
  },
});
