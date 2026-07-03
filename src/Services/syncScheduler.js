let activeSyncQueue = Promise.resolve();

export function enqueueSync(task) {
  const nextSync = activeSyncQueue.then(
    () => task(),
    () => task()
  );

  activeSyncQueue = nextSync.catch(() => {});

  return nextSync;
}

export function startBackgroundSync(task, errorLabel) {
  void enqueueSync(task).catch((error) => {
    console.error(errorLabel, error);
  });
}
