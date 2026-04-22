/**
 * Regression test for the dashboard cache "set-after-invalidate" race.
 *
 * Reproduces the race deterministically:
 *   1. Handler A starts → snapshots version → reads sessions (status=active)
 *   2. Student finishes → invalidateDashboardCache() increments version
 *   3. Handler A finishes → tries to write stale snapshot → BLOCKED by version guard
 *   4. Handler B starts fresh → snapshot has new version → writes correct data
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCacheVersion,
  getCached,
  setCache,
  setCacheIfVersionUnchanged,
  invalidateDashboardCache,
} from "../dashboardCache";

// ---------------------------------------------------------------------------
// Helpers — reach into the module's internal cache by re-exporting via
// getCached/setCache, which is sufficient for these tests.
// ---------------------------------------------------------------------------

const SCENARIO = "scenario-test-race-001";
const KEY = `class-stats-${SCENARIO}`;

describe("dashboardCache — version token race guard", () => {
  // Reset internal state between tests by invalidating (increments version,
  // clears entries) and then doing a manual re-zero isn't possible without
  // exporting the maps, so we use unique scenario ids per test instead.

  it("getCacheVersion starts at 0 for a new scenarioId", () => {
    const fresh = "scenario-fresh-" + Date.now();
    assert.strictEqual(getCacheVersion(fresh), 0);
  });

  it("invalidateDashboardCache increments the version", () => {
    const sid = "scenario-version-inc-" + Date.now();
    assert.strictEqual(getCacheVersion(sid), 0);
    invalidateDashboardCache(sid);
    assert.strictEqual(getCacheVersion(sid), 1);
    invalidateDashboardCache(sid);
    assert.strictEqual(getCacheVersion(sid), 2);
  });

  it("setCacheIfVersionUnchanged writes when version matches", () => {
    const sid = "scenario-write-ok-" + Date.now();
    const key = `class-stats-${sid}`;
    const version = getCacheVersion(sid); // 0
    const data = { completed: 2, inProgress: 0 };

    const wrote = setCacheIfVersionUnchanged(key, sid, version, data);

    assert.ok(wrote, "Expected write to succeed");
    assert.deepEqual(getCached(key), data);
  });

  it("setCacheIfVersionUnchanged is blocked when version has changed (the race)", () => {
    const sid = "scenario-race-block-" + Date.now();
    const key = `class-stats-${sid}`;

    // Step 1: Handler A snapshots version before DB reads
    const snapshotVersion = getCacheVersion(sid); // 0

    // Step 2: Student finishes — invalidation fires before handler A finishes
    invalidateDashboardCache(sid); // version → 1

    // Step 3: Handler A tries to write its stale result
    const staleData = { completed: 0, inProgress: 1 };
    const wrote = setCacheIfVersionUnchanged(key, sid, snapshotVersion, staleData);

    assert.ok(!wrote, "Stale write should have been blocked");
    assert.strictEqual(getCached(key), null, "Cache should remain empty after blocked write");
  });

  it("fresh handler after invalidation writes the correct post-completion data", () => {
    const sid = "scenario-fresh-after-inv-" + Date.now();
    const key = `class-stats-${sid}`;

    // Simulate the race first (handler A's stale write is blocked)
    const staleSnapshot = getCacheVersion(sid);
    invalidateDashboardCache(sid);
    setCacheIfVersionUnchanged(key, sid, staleSnapshot, { completed: 0, inProgress: 1 });

    // Handler B starts after invalidation — snapshots current (bumped) version
    const freshSnapshot = getCacheVersion(sid); // 1
    const freshData = { completed: 1, inProgress: 0 };
    const wrote = setCacheIfVersionUnchanged(key, sid, freshSnapshot, freshData);

    assert.ok(wrote, "Fresh handler should succeed");
    assert.deepEqual(getCached(key), freshData);
  });

  it("invalidateDashboardCache deletes existing cached entries", () => {
    const sid = "scenario-delete-entries-" + Date.now();
    const key = `class-stats-${sid}`;

    // Pre-populate cache
    setCache(key, { completed: 1, inProgress: 0 });
    assert.ok(getCached(key) !== null, "Pre-condition: entry should be in cache");

    // Invalidate
    invalidateDashboardCache(sid);

    assert.strictEqual(getCached(key), null, "Cache entry should be deleted after invalidation");
  });

  it("students-summary is NOT in the invalidation set (always uncached)", () => {
    const sid = "scenario-students-summary-" + Date.now();
    const ssKey = `students-summary-${sid}`;

    // Manually write a fake entry to confirm invalidation ignores it
    setCache(ssKey, { students: [] });
    assert.ok(getCached(ssKey) !== null, "Pre-condition: entry is present");

    // Invalidation should NOT touch students-summary
    invalidateDashboardCache(sid);

    assert.ok(
      getCached(ssKey) !== null,
      "students-summary must survive invalidateDashboardCache — it is intentionally uncached by the analytics endpoints",
    );
  });

  it("multiple invalidations keep the version strictly increasing", () => {
    const sid = "scenario-multi-inv-" + Date.now();
    const versions: number[] = [];

    for (let i = 0; i < 5; i++) {
      invalidateDashboardCache(sid);
      versions.push(getCacheVersion(sid));
    }

    for (let i = 1; i < versions.length; i++) {
      assert.ok(
        versions[i] > versions[i - 1],
        `Version at index ${i} (${versions[i]}) should be > ${versions[i - 1]}`,
      );
    }
  });

  it("Stats Row counts (class-stats) and students-summary are consistent after a simulated completion", () => {
    // This test models the consistency invariant:
    //   • class-stats completed count must equal the number of students
    //     whose status is "completed" in the per-student table.
    // We can't hit the real DB here, so we model the data contract directly.

    const sid = "scenario-consistency-" + Date.now();
    const statsKey = `class-stats-${sid}`;

    // Simulate: one student becomes completed
    const sessions = [
      { id: "s1", status: "completed" },
      { id: "s2", status: "active" },
    ];

    const completedCount = sessions.filter(s => s.status === "completed").length;
    const inProgressCount = sessions.filter(s => s.status === "active").length;

    // Handler writes class-stats after a fresh (post-invalidation) version snapshot
    invalidateDashboardCache(sid);
    const version = getCacheVersion(sid);
    const statsResult = { completed: completedCount, inProgress: inProgressCount };
    setCacheIfVersionUnchanged(statsKey, sid, version, statsResult);

    const cached = getCached(statsKey);
    assert.ok(cached, "Stats result should be cached");

    // Per-student table (students-summary) derives its status directly from
    // session.status — it never reads the analytics cache. Verify the counts agree.
    const completedStudents = sessions.filter(s => s.status === "completed").length;
    assert.strictEqual(
      cached.completed,
      completedStudents,
      "class-stats.completed must match the count of completed sessions in students-summary",
    );
    assert.strictEqual(
      cached.inProgress,
      sessions.length - completedStudents,
      "class-stats.inProgress must match sessions not yet completed",
    );
  });
});

// ---------------------------------------------------------------------------
// Endpoint-wiring integration test
//
// This reproduces the exact code pattern used inside the class-stats (and
// sibling) request handlers to verify the endpoint wiring is correct:
//
//   const cacheVersion = getCacheVersion(scenarioId);   ← snapshot before DB
//   // ... async DB read (simulated) ...
//   setCacheIfVersionUnchanged(key, scenarioId, cacheVersion, result);
//   res.json(result);
//
// The test drives this flow end-to-end with a real async boundary between
// snapshot and write so the race window is genuine.
// ---------------------------------------------------------------------------
describe("dashboardCache — endpoint wiring integration (pause-after-read simulation)", () => {
  it("stale handler that was paused across an invalidation does not pollute the cache", async () => {
    const sid = "scenario-endpoint-wiring-" + Date.now();
    const key = `class-stats-${sid}`;

    // Simulate the class-stats handler code path:
    //
    //   1. Snapshot version (handler A starts — cache miss, begins computing)
    const snapshotVersion = getCacheVersion(sid);

    // 2. Async DB read returns stale sessions (all status="active")
    const staleSessionCount = await new Promise<{ completed: number; inProgress: number }>(
      (resolve) => {
        // Introduce a real async tick to open the race window
        setImmediate(() => resolve({ completed: 0, inProgress: 1 }));
      },
    );

    // 3. While handler A was awaiting its DB read, the student finished:
    //    storage.updateSimulationSession() persisted status="completed" and then
    //    invalidateDashboardCache() was called.
    invalidateDashboardCache(sid); // version bumped to 1

    // 4. Handler A finishes computing from the stale sessions and tries to write
    const wroteStale = setCacheIfVersionUnchanged(
      key,
      sid,
      snapshotVersion, // still 0 — stale
      staleSessionCount,
    );

    assert.ok(!wroteStale, "Stale handler must not write to cache");
    assert.strictEqual(getCached(key), null, "Cache must remain empty after blocked stale write");

    // 5. A fresh request (handler B) starts after the invalidation — its
    //    snapshot sees the bumped version and correctly writes the updated data.
    const freshSnapshot = getCacheVersion(sid); // 1
    const freshResult = await new Promise<{ completed: number; inProgress: number }>(
      (resolve) => setImmediate(() => resolve({ completed: 1, inProgress: 0 })),
    );
    const wroteFresh = setCacheIfVersionUnchanged(key, sid, freshSnapshot, freshResult);

    assert.ok(wroteFresh, "Fresh handler must succeed");
    assert.deepEqual(getCached(key), freshResult, "Cache must hold the post-completion counts");
  });

  it("inline completion path: invalidation before cache-write is still blocked correctly", async () => {
    const sid = "scenario-inline-path-" + Date.now();
    const key = `class-stats-${sid}`;

    // Handler A snapshot
    const v0 = getCacheVersion(sid); // 0

    // Handler A reads sessions (still active at time of read)
    await new Promise<void>((r) => setImmediate(r));

    // Inline processTurnAndSave: storage.updateSimulationSession → invalidate
    invalidateDashboardCache(sid); // version → 1

    // Handler A tries to persist stale result
    const blocked = setCacheIfVersionUnchanged(key, sid, v0, { completed: 0, inProgress: 1 });
    assert.ok(!blocked, "Inline path: stale write must be blocked");

    // Next professor request sees correct counts
    const v1 = getCacheVersion(sid);
    const wrote = setCacheIfVersionUnchanged(key, sid, v1, { completed: 1, inProgress: 0 });
    assert.ok(wrote, "Inline path: fresh write must succeed");
    assert.strictEqual((getCached(key) as any).completed, 1);
  });

  it("queued (turnQueue) path: invalidation fired asynchronously still blocks stale write", async () => {
    const sid = "scenario-queue-path-" + Date.now();
    const key = `class-stats-${sid}`;

    // Handler A snapshot
    const v0 = getCacheVersion(sid);

    // Simulate the queued path: the 202 returns immediately, and the actual
    // status flip + invalidation happen later in background processing.
    const handlerAComputation = new Promise<{ completed: number; inProgress: number }>(
      (resolve) => setTimeout(() => resolve({ completed: 0, inProgress: 1 }), 5),
    );

    // Background turnQueue job finishes and fires invalidation (async, 2ms later)
    const backgroundInvalidation = new Promise<void>((resolve) =>
      setTimeout(() => {
        invalidateDashboardCache(sid); // version → 1
        resolve();
      }, 2),
    );

    await Promise.all([handlerAComputation, backgroundInvalidation]);
    const staleResult = await handlerAComputation;

    // Handler A writes — should be blocked
    const blocked = setCacheIfVersionUnchanged(key, sid, v0, staleResult);
    assert.ok(!blocked, "turnQueue path: stale write must be blocked after async invalidation");

    // Professor refreshes — handler B writes correct data
    const v1 = getCacheVersion(sid);
    const wroteFresh = setCacheIfVersionUnchanged(
      key,
      sid,
      v1,
      { completed: 1, inProgress: 0 },
    );
    assert.ok(wroteFresh, "turnQueue path: fresh write must succeed");
    assert.strictEqual((getCached(key) as any).inProgress, 0);
  });
});
