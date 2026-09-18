/**
 * Database lifecycle states that only a reload can resolve.
 *
 * A running tab can lose access to its local database without any application bug, and every such
 * case used to present as a permanently blank screen:
 *
 * - a **newer build in another tab** (or a fresh deploy picked up by one) upgrades the stored schema,
 *   so IndexedDB closes this connection;
 * - the database is **deleted** underneath this tab, which closes the connection the same way;
 * - this build asks for a version an **older connection** is still holding, and IndexedDB leaves the
 *   `open()` request *pending* rather than rejecting — a silenced promise, not an error.
 *
 * The vocabulary lives in infrastructure so the database owns the states and the UI only maps them to
 * copy. Two halves expose it: {@link DatabaseReloadRequiredError} for startup (thrown by
 * `DatabaseInitializer`), and `LunaClairDatabase.onReloadRequired` for a problem that arrives while the
 * app is already running.
 */
export type DatabaseReloadReason =
  /** Another context upgraded the stored schema — this connection is closed and its build is behind. */
  | 'app-updated'
  /** The stored database was deleted underneath this tab; reloading rebuilds an empty one. */
  | 'database-reset'
  /** This build requested a newer schema and an older connection is holding the upgrade back. */
  | 'upgrade-blocked';

export type DatabaseReloadListener = (reason: DatabaseReloadReason) => void;

/**
 * Dexie encodes a declared schema version `n` as the IndexedDB native version `n * 10`
 * (`nativeVerToOpen = Math.round(db.verno * 10)` in `node_modules/dexie/dist/dexie.js`), so this
 * build's v15 database is stored as native 150 and a v16 one as 160. A **patch** — Dexie's workaround
 * for a declaration that changed without a version bump — reopens one native step higher, turning 150
 * into 151, so a stored version may legitimately carry a small offset above the declared one.
 */
const NATIVE_VERSION_FACTOR = 10;

/**
 * Reads the schema version IndexedDB currently holds for `databaseName`, or `null` when nothing is
 * stored or the browser will not say (no IndexedDB in this realm, or a denied request). A `null`
 * result means "no reason to object" and leaves the caller with Dexie's own behaviour.
 *
 * The unnamed `open()` is the whole point: it is served at the stored version and never upgrades an
 * existing database, so it cannot disturb a connection another tab is holding. The connection it
 * takes lives only for the read, which bounds how long a peer's upgrade can wait on it. Its one hazard is the
 * empty case — an unnamed open *creates* a database — so the creation is rolled back as soon as
 * IndexedDB announces it, before the request can succeed. That is not just hygiene: a stray native-1
 * database would send Dexie down its per-version upgrade path on a fresh install, replaying v8's
 * primary-key change, which cannot be applied at all (`SCHEMA_V8`).
 */
export async function readStoredDatabaseVersion(databaseName: string): Promise<number | null> {
  const factory = globalThis.indexedDB;
  if (!factory) return null;

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(databaseName);
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    const settle = (version: number | null) => {
      if (settled) return;
      settled = true;
      resolve(version);
    };

    request.onupgradeneeded = () => {
      // Nothing is stored, so IndexedDB is about to create the database. Undo that, and report it as
      // having no version rather than as version 1.
      const connection = request.result;
      request.transaction?.abort();
      connection?.close();
      settle(null);
    };
    request.onsuccess = () => {
      const { version } = request.result;
      request.result.close();
      settle(version);
    };
    request.onerror = () => settle(null);
    request.onblocked = () => settle(null);
  });
}

/**
 * True when the stored database was produced by a build declaring a schema version **newer** than
 * `declaredVersion` — i.e. this bundle is stale relative to the data on disk.
 *
 * Rounding, rather than a multiple-of-ten test, is what makes this safe to act on. A patch artifact
 * (150 → 151) rounds back onto the version that produced it, so it can never be mistaken for a newer
 * build, while a genuinely newer build sits a full factor away (160). Reading an artifact as "newer"
 * would be worse than the fault it reports: reloading cannot change the stored number, so the user
 * would land on this state again, forever.
 */
export function isStoredDatabaseNewer(storedVersion: number, declaredVersion: number): boolean {
  return Math.round(storedVersion / NATIVE_VERSION_FACTOR) > declaredVersion;
}

/**
 * Thrown by `DatabaseInitializer.initialize()` when the stored database is **newer** than this bundle,
 * which happens when a stale precached bundle runs against an IndexedDB another (newer) build already
 * upgraded. Not a bug to fix in place — the only recovery is a reload onto the new bundle, so the app
 * surfaces a reload state instead of an error.
 */
export class DatabaseReloadRequiredError extends Error {
  readonly reason: DatabaseReloadReason;
  readonly databaseName: string;

  constructor(reason: DatabaseReloadReason, databaseName: string, cause?: unknown) {
    super(`LunaClair database "${databaseName}" needs a reload (${reason})`, { cause });
    this.name = 'DatabaseReloadRequiredError';
    this.reason = reason;
    this.databaseName = databaseName;
  }
}
