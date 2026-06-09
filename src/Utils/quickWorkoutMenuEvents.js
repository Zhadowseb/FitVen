const quickWorkoutMenuListeners = new Set();

export function requestOpenQuickWorkoutMenu() {
  quickWorkoutMenuListeners.forEach((listener) => {
    listener();
  });
}

export function subscribeQuickWorkoutMenu(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  quickWorkoutMenuListeners.add(listener);

  return () => {
    quickWorkoutMenuListeners.delete(listener);
  };
}
