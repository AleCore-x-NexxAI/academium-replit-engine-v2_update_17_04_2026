/**
 * Dashboard analytics cache with race-safe version tokens.
 *
 * Problem being solved (the "set-after-invalidate" race):
 *   1. Professor request A arrives → cache miss → reads sessions (status="active") → starts computing.
 *   2. Student finishes → server flips status to "completed" and calls invalidateDashboardCache().
 *      The cache entry doesn't exist yet so the deletion is a no-op.
 *   3. Request A finishes computing its stale snapshot and writes it into the cache.
 *   4. For up to 5 minutes every dashboard load returns the stale "0 completed" result.
 *
 * Fix — version tokens:
 *   Each call to invalidateDashboardCache() increments a monotonic version counter
 *   for that scenarioId. Each analytics handler snapshots the current version before
 *   doing any async work and then calls setCacheIfVersionUnchanged() instead of
 *   setCache(). If the version has been bumped since the snapshot (i.e. an
 *   invalidation raced ahead), the write is skipped and the fresh result is still
 *   returned to the caller — it just won't be cached until a future request that
 *   starts after the invalidation.
 *
 * students-summary is intentionally NOT included in the invalidation key list.
 * That endpoint never writes to the cache (it always queries the DB directly), so
 * there is nothing to invalidate and adding it created misleading "no-op deletes"
 * that obscured the race.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

const dashboardCache = new Map<string, { data: any; expiry: number }>();

/** Monotonically-increasing invalidation counter per scenarioId. */
const cacheVersions = new Map<string, number>();

/** Return the current invalidation version for a scenario (0 if never invalidated). */
export function getCacheVersion(scenarioId: string): number {
  return cacheVersions.get(scenarioId) ?? 0;
}

/** Return cached data if the entry exists and has not expired; otherwise null. */
export function getCached(key: string): any {
  const entry = dashboardCache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data;
  return null;
}

/**
 * Unconditional cache write (used internally and by callers that already hold
 * the version token). Prefer setCacheIfVersionUnchanged inside request handlers.
 */
export function setCache(key: string, data: any): void {
  dashboardCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * Version-guarded cache write.
 * Only writes if the version for scenarioId is still equal to snapshotVersion.
 * Returns true when the write was committed, false when it was skipped.
 *
 * Usage pattern inside an analytics request handler:
 *
 *   const version = getCacheVersion(scenarioId);   // ← snapshot before DB reads
 *   // ... expensive async computation ...
 *   setCacheIfVersionUnchanged(`class-stats-${scenarioId}`, scenarioId, version, result);
 *   res.json(result);                              // ← always send fresh data
 */
export function setCacheIfVersionUnchanged(
  key: string,
  scenarioId: string,
  snapshotVersion: number,
  data: any,
): boolean {
  if (getCacheVersion(scenarioId) !== snapshotVersion) {
    return false;
  }
  setCache(key, data);
  return true;
}

/**
 * Invalidate all cached analytics for a scenario and increment the version
 * token so any in-flight computation that snapshotted an older version cannot
 * overwrite the cache with pre-completion data.
 *
 * Must be called AFTER storage.updateSimulationSession() has persisted the
 * status="completed" change (both inline and turnQueue paths).
 *
 * NOTE: students-summary is intentionally absent — that endpoint is always
 * uncached (live DB read on every request), so there is nothing to invalidate.
 */
export function invalidateDashboardCache(scenarioId: string): void {
  const keys = ["class-stats", "module-health", "depth-trajectory", "class-patterns"];
  for (const k of keys) dashboardCache.delete(`${k}-${scenarioId}`);
  cacheVersions.set(scenarioId, (cacheVersions.get(scenarioId) ?? 0) + 1);
}
