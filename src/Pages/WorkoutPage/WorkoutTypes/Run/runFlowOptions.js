// The four run workout flows offered on the empty run screen.
// The id is stored (run_focus_type); the texts are translation keys, looked up
// when the screen renders so they follow a language switch.

export const RUN_WORKOUT_FLOW_OPTIONS = [
  {
    id: "endurance-base",
    titleKey: "run.flows.enduranceBase.title",
    gridTitleKey: "run.flows.enduranceBase.gridTitle",
    subtitleKey: "run.flows.enduranceBase.subtitle",
    image: require("./Assets/Endurance&base.jpg"),
  },
  {
    id: "speed-structure",
    titleKey: "run.flows.speedStructure.title",
    gridTitleKey: "run.flows.speedStructure.gridTitle",
    subtitleKey: "run.flows.speedStructure.subtitle",
    image: require("./Assets/Speed&structure.jpg"),
  },
  {
    id: "performance-threshold",
    titleKey: "run.flows.performanceThreshold.title",
    gridTitleKey: "run.flows.performanceThreshold.gridTitle",
    subtitleKey: "run.flows.performanceThreshold.subtitle",
    image: require("./Assets/Performance&threshold.jpg"),
  },
  {
    id: "custom",
    titleKey: "run.flows.custom.title",
    gridTitleKey: "run.flows.custom.gridTitle",
    subtitleKey: "run.flows.custom.subtitle",
    image: require("./Assets/Custom.jpg"),
  },
];

export function getRunFlowOption(optionId) {
  return (
    RUN_WORKOUT_FLOW_OPTIONS.find((option) => option.id === optionId) ?? null
  );
}
