import { StyleSheet } from "react-native";

export default StyleSheet.create({
  shortcutCard: {
    minHeight: 118,
    padding: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 0,
  },

  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  cardButton: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },

  cardButtonDisabled: {
    opacity: 0.78,
  },

  playButton: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },

  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 5,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 17,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },

  mainContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },

  eyebrowRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
    minWidth: 0,
  },

  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.9,
    textTransform: "uppercase",
    flexShrink: 0,
  },

  eyebrowDetail: {
    flex: 1,
    minWidth: 0,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginLeft: 5,
  },

  title: {
    padding: 0,
    marginBottom: 8,
    lineHeight: 25,
  },

  metaRow: {
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  metaType: {
    maxWidth: 116,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },

  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 9,
    opacity: 0.72,
  },
});
