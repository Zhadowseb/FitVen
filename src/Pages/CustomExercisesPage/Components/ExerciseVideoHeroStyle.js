import { StyleSheet } from "react-native";

// Measured from the top of the screen: the hero runs under the status bar.
export const VIDEO_HERO_HEIGHT = 270;
export const NO_VIDEO_HERO_HEIGHT = 150;

// Layout only. Colours come from `theme` in the component - or from the dark
// palette over the clip, which is dark whatever the theme.
export default StyleSheet.create({
  // Only seen when iOS bounces the page down past its top: the colour the
  // hero starts with, instead of a band of page colour above the clip.
  overscroll: {
    position: "absolute",
    top: -1000,
    left: 0,
    right: 0,
    height: 1000,
  },

  frame: {
    width: "100%",
    height: VIDEO_HERO_HEIGHT,
    overflow: "hidden",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    minHeight: 30,
    maxWidth: 280,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  noteText: {
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "center",
  },

  // No clip: a card-coloured block where it would have been.
  block: {
    width: "100%",
    height: NO_VIDEO_HERO_HEIGHT,
    borderBottomWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
  },

  titleBlock: {
    paddingHorizontal: 20,
  },
  // Under the clip, tucked a few dp into the last of the gradient - where it
  // has all but become the page colour, so the name can be the theme's own
  // title colour in light mode as well as dark.
  titleBlockAtVideo: {
    marginTop: -6,
  },
  titleBlockOnSurface: {
    marginTop: 16,
  },
  name: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 29,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tag: {
    minHeight: 24,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
});
