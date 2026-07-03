const quickWorkoutMenuListeners = new Set();

export function requestOpenQuickWorkoutMenu(target = null) {
  quickWorkoutMenuListeners.forEach((listener) => {
    listener(target);
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
