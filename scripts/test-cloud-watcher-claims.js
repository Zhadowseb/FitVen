// Covers what the app tells the cloud about which records it still holds.
//
// A watcher row means "this device still has a live copy of this entity", and a
// cloud row is only hard deleted once no device watches it any more. The claim
// used to upsert a row for every record in the download on every sync - and each
// upsert fires a per-row trigger that recounts the watchers and writes the total
// back onto the entity, so a full history meant tens of thousands of writes per
// table per sync to restate rows that already said the same thing.
//
// It now reads what the device already watches and claims only the rest. That is
// only safe if the set of rows afterwards is unchanged, because the two ways it
// can go wrong are both silent: claim too few and another device's delete can
// hard-delete a record this one still shows; claim too many and a deleted record
// is never cleaned up.
//
// So the test compares the new behaviour against the old rule - every live
// record in the download is watched afterwards - over the same downloads, and
// counts what was written to get there.
//
// The functions are read out of the source and run against a fake Supabase.

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "src", "Services", "cloudSync", "cloudSyncShared.js"),
  "utf8"
);

/** Reads a top-level declaration out of the module by name. */
function declarationFrom(name) {
  const start = source.search(
    new RegExp(`^(?:export )?(?:async function|function|const) ${name}\\b`, "m")
  );
  assert.ok(start !== -1, `${name} is gone from cloudSyncShared`);

  const isConst = /^(?:export )?const /.test(source.slice(start, start + 20));
  const end = isConst
    ? source.indexOf(";", start) + 1
    : source.indexOf("\n}", start) + 2;

  return source.slice(start, end).replace(/^export /, "");
}

const WATCHERS_TABLE = "sync_local_watchers";
const DEVICE_ID = "device-a";

/* ------------------------------------------------------- fake supabase -- */

/**
 * Enough of the client for these two functions: a filtered, ordered, paged
 * select over one table, and a chunked upsert into it.
 */
function createFakeSupabase(initialRows) {
  const rows = initialRows.map((row) => ({ ...row }));
  const upserts = [];
  const selects = [];

  function from(table) {
    assert.strictEqual(table, WATCHERS_TABLE, "claimed against the wrong table");

    return {
      select() {
        const filters = [];
        let after = null;
        let limit = Infinity;

        const query = {
          eq(column, value) {
            filters.push([column, value]);
            return query;
          },
          gt(column, value) {
            assert.strictEqual(column, "entity_id", "paged on the wrong column");
            after = value;
            return query;
          },
          order(column, options) {
            assert.strictEqual(column, "entity_id", "ordered on the wrong column");
            assert.strictEqual(
              options?.ascending,
              true,
              "keyset paging needs an ascending order"
            );
            return query;
          },
          limit(value) {
            limit = value;
            return query;
          },
          then(resolve, reject) {
            const matched = rows
              .filter((row) =>
                filters.every(([column, value]) => row[column] === value)
              )
              .filter((row) => after === null || row.entity_id > after)
              .sort((left, right) => left.entity_id - right.entity_id)
              .slice(0, limit)
              .map((row) => ({ entity_id: row.entity_id }));

            selects.push({ filters, after, limit, returned: matched.length });

            return Promise.resolve({ data: matched, error: null }).then(
              resolve,
              reject
            );
          },
        };

        return query;
      },
      upsert(newRows, options) {
        assert.strictEqual(
          options?.onConflict,
          "user_id,entity_table,entity_id,device_id",
          "the upsert stopped matching the table's unique key"
        );
        upserts.push(newRows);

        for (const newRow of newRows) {
          const existing = rows.find(
            (row) =>
              row.user_id === newRow.user_id &&
              row.entity_table === newRow.entity_table &&
              row.entity_id === newRow.entity_id &&
              row.device_id === newRow.device_id
          );

          if (existing) {
            Object.assign(existing, newRow);
          } else {
            rows.push({ ...newRow });
          }
        }

        return Promise.resolve({ error: null });
      },
    };
  }

  return { client: { from }, rows, upserts, selects };
}

/** Builds claimCloudWatchers against a fake client. */
function buildClaim(fakeSupabase) {
  const build = new Function(
    "supabase",
    "getStableSyncDeviceId",
    "normalizeOptionalInteger",
    "isCloudSnapshotDeleted",
    "SYNC_WATCHERS_CLOUD_TABLE",
    [
      declarationFrom("WATCHER_PAGE_SIZE"),
      declarationFrom("getWatchedEntityIds"),
      declarationFrom("claimCloudWatchers"),
      "return { claimCloudWatchers, WATCHER_PAGE_SIZE };",
    ].join("\n")
  );

  return build(
    fakeSupabase,
    async () => DEVICE_ID,
    (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && value !== null && value !== ""
        ? Math.trunc(parsed)
        : fallback;
    },
    // The real one reads is_deleting and deleted_at off the sync state.
    (record) => Boolean(record?.is_deleting) || record?.deleted_at != null,
    WATCHERS_TABLE
  );
}

const watcherRow = (entityId, table = "set") => ({
  user_id: "user-1",
  entity_table: table,
  entity_id: entityId,
  device_id: DEVICE_ID,
  last_seen_at: "2026-01-01T00:00:00.000Z",
});

/** What the old code did: every live record in the download is watched. */
function expectedWatchedIds(cloudRecords) {
  return [
    ...new Set(
      cloudRecords
        .filter(
          (record) =>
            record?.id !== null &&
            record?.id !== undefined &&
            !record.is_deleting &&
            record.deleted_at == null
        )
        .map((record) => Math.trunc(Number(record.id)))
    ),
  ].sort((left, right) => left - right);
}

function watchedIdsIn(rows) {
  return rows
    .filter(
      (row) =>
        row.user_id === "user-1" &&
        row.entity_table === "set" &&
        row.device_id === DEVICE_ID
    )
    .map((row) => row.entity_id)
    .sort((left, right) => left - right);
}

async function run() {
  const { WATCHER_PAGE_SIZE } = buildClaim(createFakeSupabase([]).client);

  assert.ok(
    WATCHER_PAGE_SIZE > 0 && WATCHER_PAGE_SIZE <= 1000,
    "the page size must stay inside what one response may carry"
  );

  /* ---- a download always ends with every live record watched ---------- */

  const DOWNLOADS = [
    {
      name: "a fresh device",
      existing: [],
      records: [{ id: 1 }, { id: 2 }, { id: 3 }],
      expectedUpsertedIds: [1, 2, 3],
    },
    {
      name: "the steady state",
      existing: [watcherRow(1), watcherRow(2), watcherRow(3)],
      records: [{ id: 1 }, { id: 2 }, { id: 3 }],
      expectedUpsertedIds: [],
    },
    {
      name: "one new record among known ones",
      existing: [watcherRow(1), watcherRow(2)],
      records: [{ id: 1 }, { id: 2 }, { id: 9 }],
      expectedUpsertedIds: [9],
    },
    {
      name: "deleted records, which nothing should watch",
      existing: [],
      records: [
        { id: 1 },
        { id: 2, is_deleting: true },
        { id: 3, deleted_at: "2026-01-01T00:00:00.000Z" },
      ],
      expectedUpsertedIds: [1],
    },
    {
      name: "rows the download could not identify",
      existing: [],
      records: [{ id: null }, { id: undefined }, {}, { id: 4 }],
      expectedUpsertedIds: [4],
    },
    {
      name: "the same record twice in one download",
      existing: [],
      records: [{ id: 5 }, { id: 5 }, { id: 5 }],
      expectedUpsertedIds: [5],
    },
    {
      name: "another device's rows, which say nothing about this one",
      existing: [{ ...watcherRow(1), device_id: "device-b" }],
      records: [{ id: 1 }],
      expectedUpsertedIds: [1],
    },
    {
      name: "the same entity id in another table",
      existing: [watcherRow(1, "exercise_instance")],
      records: [{ id: 1 }],
      expectedUpsertedIds: [1],
    },
  ];

  for (const download of DOWNLOADS) {
    const fake = createFakeSupabase(download.existing);
    const { claimCloudWatchers } = buildClaim(fake.client);

    await claimCloudWatchers({
      userId: "user-1",
      tableName: "set",
      cloudRecords: download.records,
    });

    const upsertedIds = fake.upserts
      .flat()
      .map((row) => row.entity_id)
      .sort((left, right) => left - right);

    assert.deepStrictEqual(
      upsertedIds,
      download.expectedUpsertedIds,
      `${download.name}: wrote the wrong rows`
    );

    const wasWatchedBefore = watchedIdsIn(download.existing);
    const expected = [
      ...new Set([...wasWatchedBefore, ...expectedWatchedIds(download.records)]),
    ].sort((left, right) => left - right);

    assert.deepStrictEqual(
      watchedIdsIn(fake.rows),
      expected,
      `${download.name}: the watcher rows afterwards differ from what the per-record claim left behind`
    );

    for (const row of fake.upserts.flat()) {
      assert.strictEqual(row.user_id, "user-1", "a claim lost its user");
      assert.strictEqual(row.entity_table, "set", "a claim lost its table");
      assert.strictEqual(row.device_id, DEVICE_ID, "a claim lost its device");
      assert.ok(row.last_seen_at, "a claim lost its timestamp");
    }
  }

  /* ---- an empty download must not even ask ---------------------------- */

  for (const records of [[], null, undefined, [{ id: null }]]) {
    const fake = createFakeSupabase([watcherRow(1)]);
    const { claimCloudWatchers } = buildClaim(fake.client);

    await claimCloudWatchers({
      userId: "user-1",
      tableName: "set",
      cloudRecords: records,
    });

    assert.strictEqual(
      fake.upserts.length + fake.selects.length,
      0,
      "an empty download still talked to the cloud"
    );
  }

  /* ---- a history larger than one page ---------------------------------- */

  const bigHistory = Array.from({ length: 2500 }, (_, index) => index + 1);
  const fullyWatched = createFakeSupabase(bigHistory.map((id) => watcherRow(id)));
  const { claimCloudWatchers: claimFullyWatched } = buildClaim(fullyWatched.client);

  await claimFullyWatched({
    userId: "user-1",
    tableName: "set",
    cloudRecords: bigHistory.map((id) => ({ id })),
  });

  assert.strictEqual(
    fullyWatched.upserts.length,
    0,
    "a history that is already watched still wrote to the cloud"
  );
  assert.ok(
    fullyWatched.selects.length >= 3,
    `reading 2500 watchers took ${fullyWatched.selects.length} pages - it cannot have read them all`
  );
  assert.ok(
    fullyWatched.selects.every((select) => select.returned <= WATCHER_PAGE_SIZE),
    "a page came back larger than the page size, so paging is not being applied"
  );

  const fresh = createFakeSupabase([]);
  const { claimCloudWatchers: claimFresh } = buildClaim(fresh.client);

  await claimFresh({
    userId: "user-1",
    tableName: "set",
    cloudRecords: bigHistory.map((id) => ({ id })),
  });

  assert.deepStrictEqual(
    watchedIdsIn(fresh.rows),
    bigHistory,
    "a fresh device did not end up watching the whole history"
  );
  assert.ok(
    fresh.upserts.every((chunk) => chunk.length <= WATCHER_PAGE_SIZE),
    "an upsert was sent in one body larger than the page size"
  );

  console.log(
    `Cloud watcher claims: ${DOWNLOADS.length} downloads end with the same ` +
      `watcher rows as the per-record claim, and an already-watched history of ` +
      `${bigHistory.length} writes nothing.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
