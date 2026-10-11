// Steps: the card on Home, the Steps page and the zones. Keep in step with
// ../da/steps.js.
export default {
  title: "Steps",
  eyebrow: "Activity",
  noData: "No steps in this period yet.",
  // Where the phone's own count is read.
  healthApp: {
    ios: "Health",
    android: "Health Connect",
  },
  // A zone is never told by its colour alone; these are the names.
  zones: {
    inactive: "Inactive",
    moving: "Moving",
    active: "Active",
    sweetSpot: "Sweet spot",
    bonus: "Bonus",
  },
  access: {
    ask: "See your daily steps next to your workouts.",
    askButton: "Allow",
    blocked: "FitVen needs to read your steps in {app}.",
    openApp: "Open {app}",
  },
  card: {
    steps: "steps",
    a11y: "Steps today: {total} steps. {zone} zone. Open steps",
    a11yWithTraining:
      "Steps today: {walked} walked plus {training} from training, {total} in total. {zone} zone. Open steps",
  },
  periods: {
    day: "Day",
    week: "Week",
    month: "Month",
  },
  hero: {
    today: "Today · {range}",
    dailyAverage: "Daily average · {range}",
    activeSteps: "active steps",
    walked: "{count} walked",
    fromTraining: "{count} from training",
  },
  chart: {
    today: "Today",
    walking: "Walking",
    training: "Training as steps",
    target: "{zone} {steps}",
    summary: {
      day: "Active steps per day over the last week: walking in green, training converted to steps in orange. Today {average}, {zone} zone.",
      week: "Active steps per day this week: walking in green, training converted to steps in orange. {sweet} of {days} days reached the sweet spot. Average {average}, {zone} zone.",
      month:
        "Average active steps per day, per week this month: walking in green, training converted to steps in orange. {sweet} of {days} days reached the sweet spot. Average {average}, {zone} zone.",
    },
  },
  tiles: {
    total: "Total",
    totalWithTraining: "incl. {count} from training",
    sweetSpotDays: "Sweet spot days",
    ofDays: "{count} of {total}",
    sweetSpotRule: "{steps} or more",
    bestDay: "Best day",
    bestDetail: "{weekday} · {workout}",
    distance: "Distance",
    km: "km",
    walkedDistance: "walked",
  },
  sources: {
    title: "Where your activity came from",
    period: {
      day: "Today",
      week: "This week",
      month: "This month",
    },
    walks: "Walks",
    everyday: "Everyday",
    training: "Training",
    a11y: "{walks} percent from logged walks, {everyday} percent from everyday activity, {training} percent from training",
  },
  trainingCounts: {
    title: "Training counts too",
    subtitle: "Workouts are added as step equivalents",
    switch: "Count training as steps",
    minutes: "{minutes} min strength",
    empty: "No strength workouts in this period.",
  },
  target: {
    label: "Your target",
    change: "Change",
    title: "Your target",
    from: "{steps}+",
  },
};
