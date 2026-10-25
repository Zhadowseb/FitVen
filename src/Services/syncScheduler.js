let activeSyncQueue = Promise.resolve();

// How long the queue waits for one task. Every upload, the centre match and a
// workout post run one after another here, so a task that never finishes - a
// request that stalled, a permission dialog nobody can see - used to hold up
// all of them for the rest of the session. Past this the queue goes on without
// it, and whoever was waiting for the task is told it took too long. The task
// itself cannot be cancelled and may still finish behind the scenes.
export const SYNC_TASK_TIMEOUT_MS = 150000;

function withDeadline(task, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;

        const error = new Error("The upload took too long. Try again.");

        error.code = "sync-timeout";
        reject(error);
      }
    }, timeoutMs);

    Promise.resolve()
      .then(task)
      .then(
        (value) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(value);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        }
      );
  });
}

export function enqueueSync(task, { timeoutMs = SYNC_TASK_TIMEOUT_MS } = {}) {
  const run = () => withDeadline(task, timeoutMs);
  const nextSync = activeSyncQueue.then(run, run);

  activeSyncQueue = nextSync.catch(() => {});

  return nextSync;
}

export function startBackgroundSync(task, errorLabel) {
  void enqueueSync(task).catch((error) => {
    console.error(errorLabel, error);
  });
}
