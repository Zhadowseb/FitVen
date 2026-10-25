// Ask FitVen: the AI chat about your own training - Home's bar, the chat, the
// first-use consent and the switch in Profile. Keep in step with the other
// languages in ../*/ask.js.
export default {
  title: "Ask FitVen",
  placeholder: "Ask about your training…",
  // The one button on Home.
  openLabel: "Ask FitVen about your training",
  badge: "Only your data",
  badgeHint: "Opens an explanation of what the AI can see",
  badgeSheet: {
    title: "Only your data",
    body: "FitVen's AI can read your own workouts, records, programs and steps when you ask a question. It can't see other people's data, and it can't change anything without you.",
  },
  menu: {
    open: "Chat menu",
    newChat: "New chat",
  },
  empty: {
    title: "Ask anything about your training",
    intro: "FitVen reads your own workouts, records, programs and steps to answer. Never anyone else's.",
  },
  // The four rows on the empty screen. The first three are made from your own
  // data where there is any, and the fixed ones stand in where there is not.
  suggest: {
    stuck: "Why is my {exercise} stuck?",
    stuckAny: "Which of my lifts is stuck?",
    next: "How should I approach my next {workout}?",
    today: "What should I train today?",
    month: "How did {month} go?",
    recent: "How have my last few weeks gone?",
    volume: "Is my weekly volume balanced?",
  },
  disclaimer: "AI can make mistakes. General guidance, not medical advice.",
  input: {
    label: "Ask FitVen",
    send: "Send",
    speak: "Speak your question",
  },
  typing: "FitVen is thinking…",
  answered: "FitVen has answered",
  chart: {
    a11y: "{title}, {range}. {summary}",
    a11yNoRange: "{title}. {summary}",
  },
  suggestion: {
    eyebrow: "Suggested change · {workout}",
    add: "Add to next {workout}",
    notNow: "Not now",
    group: "Suggested change for {workout}: {text}",
    added: "Added to {workout}",
    undo: "Undo",
    undone: "Change undone",
    dismissed: "Not added",
    line: "{exercise}: {sets}",
    setPart: "{count} × {reps} at {weight} kg",
    noWorkout: "You have no planned {workout} coming up, so there is nothing to add this to.",
    failed: "Could not add that. Try again in a moment.",
    undoFailed: "Could not undo the change.",
  },
  sources: {
    line: {
      one: "Based on {count} session · {range}",
      other: "Based on {count} sessions · {range}",
    },
    lineNoRange: {
      one: "Based on {count} session",
      other: "Based on {count} sessions",
    },
    see: "See them",
    seeHint: "Opens the sessions this answer is based on",
  },
  // The model to ask, and how many questions each has left this month.
  tier: {
    haiku: "Haiku",
    sonnet: "Sonnet",
    opus: "Opus",
    left: {
      one: "{count} left",
      other: "{count} left",
    },
    recommended: "Recommended",
    a11y: {
      one: "{name}, {count} question left this month",
      other: "{name}, {count} questions left this month",
    },
    a11yUnknown: "{name}",
    pickerLabel: "Choose a model to answer with",
  },
  quota: {
    reached: "You've used all your {tier} questions this month.",
    reachedAll: "You've used all your questions this month. They start over next month.",
    pickAnother: "Ask with another model instead:",
    use: "Use {tier}",
  },
  error: {
    offline: "You're offline. Ask again when you're connected.",
    generic: "Something went wrong. Please try again.",
    provider: "FitVen's AI could not answer just now. Please try again.",
    unavailable: "Ask FitVen isn't available right now. Please try again later.",
    unauthorized: "Please sign in again to ask a question.",
    consent: "Say yes to sharing your training data to ask a question.",
  },
  consent: {
    title: "Before you ask",
    intro: "To answer, FitVen's AI has to read your own training data.",
    what: {
      title: "What is shared",
      body: "Your question and the FitVen training data it needs for this question: workouts, records, programs and steps.",
    },
    who: {
      title: "Who gets it",
      body: "The AI provider that writes the answer. It is used to answer you, nothing else.",
    },
    others: {
      title: "Other people",
      body: "Nothing is shared with other users. Your chat stays on this phone.",
    },
    change: "You can turn this off at any time in your profile.",
    continue: "Continue",
    notNow: "Not now",
    failed: "Could not save your choice. Check your connection and try again.",
  },
  settings: {
    title: "Ask FitVen",
    body: "Let FitVen's AI read your training data when you ask it a question. Turn this off and Ask FitVen disappears from Home.",
    failed: "Could not change this. Check your connection and try again.",
  },
};
