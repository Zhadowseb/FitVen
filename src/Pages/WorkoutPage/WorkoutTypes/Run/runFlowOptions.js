// The four run workout flows offered on the empty run screen.

export const RUN_WORKOUT_FLOW_OPTIONS = [
  {
    id: "endurance-base",
    title: "Endurance & Base",
    gridTitle: "Endurance & Base",
    subtitle: "Base Run · Long Run · Recovery Run",
    image: require("./Assets/Endurance&base.jpg"),
  },
  {
    id: "speed-structure",
    title: "Speed & Structure",
    gridTitle: "Speed & Structure",
    subtitle: "Interval · Fartlek · Hill Repeats",
    image: require("./Assets/Speed&structure.jpg"),
  },
  {
    id: "performance-threshold",
    title: "Performance & Threshold",
    gridTitle: "Performance",
    subtitle: "Tempo Run · Progression Run",
    image: require("./Assets/Performance&threshold.jpg"),
  },
  {
    id: "custom",
    title: "Custom",
    gridTitle: "Custom",
    subtitle: "Build from blank",
    image: require("./Assets/Custom.jpg"),
  },
];

export function getRunFlowOption(optionId) {
  return (
    RUN_WORKOUT_FLOW_OPTIONS.find((option) => option.id === optionId) ?? null
  );
}
