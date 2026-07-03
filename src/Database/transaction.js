const SQLITE_LOCK_RETRY_DELAY_MS = 50;
const SQLITE_LOCK_MAX_RETRIES = 8;
const databaseTransactionStates = new Map();

function isDatabaseLockedError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("database is locked");
}

function isNestedTransactionError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return message.includes("cannot start a transaction within a transaction");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function execAsyncWithLockRetry(db, sql) {
  let attempt = 0;

  while (true) {
    try {
      return await db.execAsync(sql);
    } catch (error) {
      if (!isDatabaseLockedError(error) || attempt >= SQLITE_LOCK_MAX_RETRIES) {
        throw error;
      }

      attempt += 1;
      await delay(SQLITE_LOCK_RETRY_DELAY_MS * attempt);
    }
  }
}

function getDatabaseStateKey(db) {
  return db?.databasePath ?? db;
}

function getTransactionState(db) {
  const databaseKey = getDatabaseStateKey(db);
  const existingState = databaseTransactionStates.get(databaseKey);

  if (existingState) {
    return existingState;
  }

  const nextState = {
    queue: Promise.resolve(),
    depth: 0,
  };

  databaseTransactionStates.set(databaseKey, nextState);
  return nextState;
}

async function isDatabaseAlreadyInTransaction(db) {
  try {
    return await db.isInTransactionAsync();
  } catch {
    return false;
  }
}

async function beginTransactionIfNeeded(db) {
  let attempt = 0;

  while (true) {
    try {
      await db.execAsync("BEGIN IMMEDIATE");
      return true;
    } catch (error) {
      if (isNestedTransactionError(error)) {
        return false;
      }

      if (!isDatabaseLockedError(error) || attempt >= SQLITE_LOCK_MAX_RETRIES) {
        throw error;
      }

      attempt += 1;
      await delay(SQLITE_LOCK_RETRY_DELAY_MS * attempt);
    }
  }
}

export async function withTransaction(db, callback) {
  const state = getTransactionState(db);

  if (state.depth > 0) {
    state.depth += 1;
    try {
      return await callback();
    } finally {
      state.depth -= 1;
    }
  }

  const runTransaction = async () => {
    const alreadyInTransaction = await isDatabaseAlreadyInTransaction(db);
    state.depth = 1;

    if (alreadyInTransaction) {
      try {
        return await callback();
      } finally {
        state.depth = 0;
      }
    }

    const startedTransaction = await beginTransactionIfNeeded(db);

    if (!startedTransaction) {
      try {
        return await callback();
      } finally {
        state.depth = 0;
      }
    }

    try {
      const result = await callback();
      await execAsyncWithLockRetry(db, "COMMIT");
      return result;
    } catch (error) {
      await execAsyncWithLockRetry(db, "ROLLBACK");
      throw error;
    } finally {
      state.depth = 0;
    }
  };

  const transactionPromise = state.queue.then(
    () => runTransaction(),
    () => runTransaction()
  );

  state.queue = transactionPromise.catch(() => {});
  return transactionPromise;
}
