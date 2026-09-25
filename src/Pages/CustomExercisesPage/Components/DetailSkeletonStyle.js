import { StyleSheet } from "react-native";

import { VIDEO_HERO_HEIGHT } from "./ExerciseVideoHeroStyle";

// Layout only; colours come from `theme` in the component. The shapes stand
// where the page's own will: the hero, the name and tags, the owner row, the
// three numbers and the first lines of the steps.
export default StyleSheet.create({
  hero: {
    width: "100%",
    height: VIDEO_HERO_HEIGHT,
    borderBottomWidth: 1,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  titleBlock: {
    marginTop: 16,
    marginHorizontal: 20,
    gap: 10,
  },
  name: {
    width: "62%",
    height: 24,
    borderRadius: 7,
  },
  tags: {
    flexDirection: "row",
    gap: 6,
  },
  tag: {
    height: 24,
    borderRadius: 7,
  },
  card: {
    marginTop: 14,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  ownerCopy: {
    flex: 1,
    gap: 6,
  },
  lineStrong: {
    width: "42%",
    height: 11,
    borderRadius: 5,
  },
  lineQuiet: {
    width: "66%",
    height: 9,
    borderRadius: 5,
  },
  statsCard: {
    flexDirection: "row",
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statDivided: {
    borderLeftWidth: 1,
  },
  statValue: {
    width: 34,
    height: 16,
    borderRadius: 5,
  },
  statLabel: {
    width: 56,
    height: 8,
    borderRadius: 4,
  },
  rows: {
    marginTop: 26,
    marginHorizontal: 20,
    gap: 10,
  },
  eyebrow: {
    width: 92,
    height: 9,
    borderRadius: 4,
    marginBottom: 2,
  },
  row: {
    height: 12,
    borderRadius: 6,
  },
});
