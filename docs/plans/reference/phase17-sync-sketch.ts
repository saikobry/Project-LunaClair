/**
 * LunaClair Phase 17 — sync sketch (registry, merge plugins, tx-origin hooks,
 * orphan detection, review-log fold).
 *
 * Table names/row shapes are ASSUMPTIONS inferred from the Phase 17 brief; rename to match
 * your schema. Everything here type-checks under `strict` and is exercised by
 * phase17-sync-sketch.test.ts against Dexie 4 + fake-indexeddb.
 *
 * Behaviours this design relies on were verified empirically against Dexie 4.4.6:
 *  - hooks receive the live Transaction as their last argument (=== Dexie.currentTransaction)
 *  - custom props on that Transaction are visible to hooks; concurrent transactions don't bleed
 *  - NESTED db.transaction() creates a NEW Transaction object that does NOT inherit custom props,
 *    but exposes `.parent` -> resolve origin by walking the parent chain
 *  - an un-awaited tx.table('outbox').add() that FAILS (or targets an out-of-scope table) does not
 *    abort the main write: silent data loss -> guard scope synchronously, abort on failure
 *  - Table.clear() / bulkDelete / where().delete() all fire `deleting` hooks (one per row)
 *  - creating-hook may mutate obj in place; updating-hook may return extra mods; an identical put()
 *    fires `updating` with EMPTY mods
 *  - a non-Dexie await (setTimeout, fetch) inside a transaction lets IDB auto-commit -> partial writes
 */
import Dexie, { type Table, type Transaction } from 'dexie';

/* ════════════════════════════ 0. Primitives ════════════════════════════ */

/** `${wallMs(13)}_${counter(4)}_${deviceId}` — lexicographic order == HLC order. */
export type Hlc = string;
export const compareHlc = (a: Hlc, b: Hlc): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

export interface HlcClock {
  readonly deviceId: string;
  tick(): Hlc; // local event
  receive(remote: Hlc): Hlc; // fold a remote stamp in so later local ticks sort after it
}

export function createClock(deviceId: string, now: () => number = Date.now): HlcClock {
  let wall = 0;
  let counter = 0;
  const fmt = () => `${String(wall).padStart(13, '0')}_${String(counter).padStart(4, '0')}_${deviceId}`;
  const advance = (remoteWall: number, remoteCounter: number): Hlc => {
    const pt = now();
    const nextWall = Math.max(wall, remoteWall, pt);
    counter = nextWall === wall && nextWall === remoteWall ? Math.max(counter, remoteCounter) + 1
      : nextWall === wall ? counter + 1
      : nextWall === remoteWall ? remoteCounter + 1
      : 0;
    wall = nextWall;
    return fmt();
  };
  return {
    deviceId,
    tick: () => advance(0, 0),
    receive: (remote) => {
      const [w, c] = remote.split('_');
      return advance(Number(w), Number(c));
    },
  };
}

/* ════════════════════════════ 1. Tables ════════════════════════════ */

export interface Material { id: string; title: string; originShareId?: string }
export interface Question { id: string; materialId: string; text: string }
export interface Quiz { id: string; materialId: string; questionIds: string[] }
export interface DocumentContent { id: string; materialId: string; text: string }
export interface Highlight { id: string; documentId: string; start: number; end: number; color: string; note?: string }
export interface Drawing { id: string; documentId: string; strokes: unknown[] }
export interface QuizAttempt { id: string; quizId: string; score: number; at: number }
export interface CardState { cardKey: string; due: number; stability: number; difficulty: number; state: number; lastReview?: number; reps: number }
export interface ReviewLog {
  id: string; cardKey: string; kind: 'review' | 'keyframe';
  rating?: 1 | 2 | 3 | 4; at: number; state?: CardState; deviceId: string;
}
export interface AssetCacheRow { url: string; bytes: number }

/** Fields the sync layer adds to rows of synced tables. Stamped by hooks, never by app code. */
export interface SyncStamp { _hlc?: Hlc; _rev?: Hlc; _anc?: Hlc[] }

export interface JournalOp<T = unknown> {
  entity: string; key: string; hlc: Hlc; deviceId: string; schemaVersion: number;
  op: 'put' | 'del'; value?: T; baseRevision?: Hlc;
}
export interface OutboxRow extends JournalOp { seq?: number }
export interface TombstoneRow { id: string; entity: string; key: string; hlc: Hlc }
export interface ConflictDraft { id: string; entity: string; key: string; value: unknown }
export interface HeldOp { id: string; op: JournalOp; reason: 'unknown-entity' | 'newer-schema' }
export interface PendingHydration { originShareId: string; attempts: number; nextAttemptAt: number }

export interface LunaClairTables {
  materials: Table<Material & SyncStamp, string>;
  questions: Table<Question & SyncStamp, string>;
  quizzes: Table<Quiz & SyncStamp, string>;
  documentContents: Table<DocumentContent & SyncStamp, string>;
  highlights: Table<Highlight & SyncStamp, string>;
  drawings: Table<Drawing & SyncStamp, string>;
  quizAttempts: Table<QuizAttempt & SyncStamp, string>;
  reviewLogs: Table<ReviewLog & SyncStamp, string>;
  flashcardReviews: Table<CardState, string>; // becomes DERIVED in Phase 17 (see section 7)
  assetCache: Table<AssetCacheRow, string>;
  outbox: Table<OutboxRow, number>;
  tombstones: Table<TombstoneRow, string>;
  conflictDrafts: Table<ConflictDraft, string>;
  heldOps: Table<HeldOp, string>;
  pendingHydrations: Table<PendingHydration, string>;
  syncCursor: Table<{ id: string; hlc: Hlc }, string>;
}
export type LunaClairDatabase = Dexie & LunaClairTables;

export const DEXIE_SCHEMA = {
  materials: 'id', questions: 'id, materialId', quizzes: 'id, materialId', documentContents: 'id, materialId',
  highlights: 'id, documentId', drawings: 'id, documentId', quizAttempts: 'id, quizId',
  reviewLogs: 'id, cardKey, at', flashcardReviews: 'cardKey, due', assetCache: 'url',
  outbox: '++seq', tombstones: 'id', conflictDrafts: 'id', heldOps: 'id',
  pendingHydrations: 'originShareId', syncCursor: 'id',
} satisfies Record<keyof LunaClairTables, string>;

/* ════════════════════════════ 2. Registry ════════════════════════════ */

export type TableName = keyof LunaClairTables & string;
type RowOf<K extends TableName> = LunaClairTables[K] extends Table<infer R, never> ? R : never;
type RowOfLoose<K extends TableName> = LunaClairTables[K] extends Table<infer R, infer _P> ? R : never;

export type SyncCategory = 'annotations' | 'flashcards' | 'customMaterials' | 'studyHistory';
export type MergeStrategyId = 'lww' | 'appendOnly' | 'casDraft';
/** upcasters[n] converts a wire row from schema version n to n+1. */
export type Upcaster = (wireRow: unknown) => unknown;

export interface SyncEntityConfig<K extends TableName = TableName> {
  kind: 'authoritative';
  /** Wire name in journals. Decoupled from the Dexie table name so renaming a table never breaks old journals. */
  entity: string;
  mergeStrategy: MergeStrategyId;
  category: SyncCategory;
  /** Tables that should be applied before this one (restore order). NOT enforced as foreign keys. */
  dependencies: readonly TableName[];
  /** For orphan detection / cascade GC. */
  parent?: { table: TableName; key(row: RowOfLoose<K>): string | undefined };
  schemaVersion: number;
  upcasters: Readonly<Record<number, Upcaster>>;
  /** Fields never put on the wire (blobs, caches). Default-include is a trap; keep this explicit. */
  excludeFields?: readonly string[];
}
export interface DerivedConfig { kind: 'derived'; rebuildFrom: readonly TableName[]; reason: string }
export interface LocalOnlyConfig { kind: 'localOnly'; reason: string; prunable: boolean }
export type TablePolicy<K extends TableName = TableName> = SyncEntityConfig<K> | DerivedConfig | LocalOnlyConfig;

/**
 * ONE record, keyed by every table in LunaClairTables. `satisfies` makes the compiler reject
 * (a) a table with no entry and (b) an entry for a table that doesn't exist. A table can't be both
 * synced and local-only because it only has one slot — which two separate sets couldn't guarantee.
 */
export const SYNC_POLICY = {
  materials: { kind: 'authoritative', entity: 'material', mergeStrategy: 'lww', category: 'customMaterials', dependencies: [], schemaVersion: 1, upcasters: {} },
  questions: { kind: 'authoritative', entity: 'question', mergeStrategy: 'lww', category: 'customMaterials', dependencies: ['materials'], parent: { table: 'materials', key: (r) => r.materialId }, schemaVersion: 1, upcasters: {} },
  quizzes: { kind: 'authoritative', entity: 'quiz', mergeStrategy: 'lww', category: 'customMaterials', dependencies: ['materials', 'questions'], parent: { table: 'materials', key: (r) => r.materialId }, schemaVersion: 1, upcasters: {} },
  documentContents: { kind: 'authoritative', entity: 'documentContent', mergeStrategy: 'casDraft', category: 'customMaterials', dependencies: ['materials'], parent: { table: 'materials', key: (r) => r.materialId }, schemaVersion: 1, upcasters: {} },
  highlights: { kind: 'authoritative', entity: 'highlight', mergeStrategy: 'lww', category: 'annotations', dependencies: ['documentContents'], parent: { table: 'documentContents', key: (r) => r.documentId }, schemaVersion: 1, upcasters: {} },
  drawings: { kind: 'authoritative', entity: 'drawing', mergeStrategy: 'lww', category: 'annotations', dependencies: ['documentContents'], parent: { table: 'documentContents', key: (r) => r.documentId }, schemaVersion: 1, upcasters: {} },
  quizAttempts: { kind: 'authoritative', entity: 'quizAttempt', mergeStrategy: 'appendOnly', category: 'studyHistory', dependencies: ['quizzes'], parent: { table: 'quizzes', key: (r) => r.quizId }, schemaVersion: 1, upcasters: {} },
  reviewLogs: { kind: 'authoritative', entity: 'reviewLog', mergeStrategy: 'appendOnly', category: 'flashcards', dependencies: [], schemaVersion: 1, upcasters: {} },
  flashcardReviews: { kind: 'derived', rebuildFrom: ['reviewLogs'], reason: 'FSRS state = fold(reviewLogs); rebuilt on remote apply and on FSRS parameter changes' },
  assetCache: { kind: 'localOnly', reason: 're-fetchable content cache', prunable: true },
  outbox: { kind: 'localOnly', reason: 'pending local ops; pruning loses unsynced changes', prunable: false },
  tombstones: { kind: 'localOnly', reason: 'delete markers needed to block resurrection', prunable: false },
  conflictDrafts: { kind: 'localOnly', reason: 'deterministically re-derivable from ops, but user-visible', prunable: false },
  heldOps: { kind: 'localOnly', reason: 'ops from newer clients waiting for an upgrade; MUST be carried into snapshots', prunable: false },
  pendingHydrations: { kind: 'localOnly', reason: 'hydration queue for Explore pointers', prunable: false },
  syncCursor: { kind: 'localOnly', reason: 'per-vault sync position; reset together with data or not at all', prunable: false },
} satisfies { [K in TableName]: TablePolicy<K> };

export type PolicyKind = TablePolicy['kind'];

export function syncedTables(): Array<[TableName, SyncEntityConfig]> {
  return (Object.entries(SYNC_POLICY) as Array<[TableName, TablePolicy]>)
    .filter((e): e is [TableName, SyncEntityConfig] => e[1].kind === 'authoritative');
}
export const tableForEntity = (entity: string): TableName | undefined =>
  syncedTables().find(([, c]) => c.entity === entity)?.[0];

/** Kahn topological sort over synced tables; throws on cycles. */
export function restoreOrder(): TableName[] {
  const nodes = syncedTables();
  const names = new Set(nodes.map(([n]) => n));
  const indeg = new Map<TableName, number>(nodes.map(([n]) => [n, 0]));
  const out = new Map<TableName, TableName[]>();
  for (const [n, c] of nodes) for (const d of c.dependencies) {
    if (!names.has(d)) continue;
    indeg.set(n, (indeg.get(n) ?? 0) + 1);
    out.set(d, [...(out.get(d) ?? []), n]);
  }
  const queue = [...indeg].filter(([, v]) => v === 0).map(([n]) => n).sort();
  const order: TableName[] = [];
  while (queue.length) {
    const n = queue.shift() as TableName;
    order.push(n);
    for (const m of out.get(n) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 1) - 1);
      if ((indeg.get(m) ?? 0) === 0) queue.push(m);
    }
  }
  if (order.length !== nodes.length) throw new Error('SYNC_POLICY dependency cycle');
  return order;
}

/** Runtime half of the completeness check: catches drift between the TS interface and the real Dexie schema. */
export function assertPolicyMatchesSchema(db: Dexie): void {
  const real = new Set(db.tables.map((t) => t.name));
  const declared = new Set(Object.keys(SYNC_POLICY));
  const missing = [...real].filter((n) => !declared.has(n));
  const phantom = [...declared].filter((n) => !real.has(n));
  if (missing.length || phantom.length) {
    throw new Error(`SYNC_POLICY out of sync with schema. missing: [${missing}] phantom: [${phantom}]`);
  }
}

/** Vault Inspector (17D): destructive actions only where the policy allows. */
export const isPrunable = (t: TableName): boolean => {
  const p: TablePolicy = SYNC_POLICY[t];
  return p.kind === 'derived' || (p.kind === 'localOnly' && p.prunable);
};

/* ════════════════════════════ 3. Merge plugins ════════════════════════════ */

export type LocalChange<T> =
  | { kind: 'create'; key: string; next: T }
  | { kind: 'update'; key: string; prev: T & SyncStamp; next: T }
  | { kind: 'delete'; key: string; prev: T & SyncStamp };

export interface CaptureResult<T> { op: JournalOp<T>; stamp: SyncStamp; tombstone?: boolean }
export interface CaptureCtx { clock: HlcClock; entity: string; schemaVersion: number; wire(row: object): object }

export interface LocalState<T> { row?: T & SyncStamp; tombstoneHlc?: Hlc }
export type MergeDecision<T> =
  | { kind: 'noop' }
  | { kind: 'put'; row: T & SyncStamp; drafts?: ConflictDraft[] }
  | { kind: 'del'; tombstoneHlc: Hlc };

/**
 * Pure: no DB, no clock, no I/O. `capture` runs inside a Dexie hook (synchronous);
 * `apply` runs in the reconciler. A plugin that needs async data cannot be a hook-time plugin —
 * that is the constraint to design around.
 */
export interface MergePlugin {
  readonly id: MergeStrategyId;
  capture<T extends object>(change: LocalChange<T>, ctx: CaptureCtx): CaptureResult<T> | null;
  apply<T extends object>(state: LocalState<T>, op: JournalOp<T>): MergeDecision<T>;
}

const META_KEYS = ['_hlc', '_rev', '_anc'] as const;
export const toWire = (row: object, exclude: readonly string[] = []): object => {
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const k of [...META_KEYS, ...exclude]) delete copy[k];
  return copy;
};
const stamped = <T extends object>(value: T | undefined, stamp: SyncStamp): T & SyncStamp => ({ ...(value as object), ...stamp }) as T & SyncStamp;
const newestOf = (a?: Hlc, b?: Hlc): Hlc | undefined => (a && b ? (compareHlc(a, b) >= 0 ? a : b) : a ?? b);
const base = (ctx: CaptureCtx, key: string, hlc: Hlc) => ({ entity: ctx.entity, key, hlc, deviceId: ctx.clock.deviceId, schemaVersion: ctx.schemaVersion });

export const LwwPlugin: MergePlugin = {
  id: 'lww',
  capture(change, ctx) {
    const hlc = ctx.clock.tick();
    if (change.kind === 'delete') return { op: { ...base(ctx, change.key, hlc), op: 'del' }, stamp: {}, tombstone: true };
    return { op: { ...base(ctx, change.key, hlc), op: 'put', value: ctx.wire(change.next) as never }, stamp: { _hlc: hlc } };
  },
  apply(state, op) {
    const known = newestOf(state.row?._hlc, state.tombstoneHlc);
    if (known && compareHlc(op.hlc, known) <= 0) return { kind: 'noop' };
    if (op.op === 'del') return { kind: 'del', tombstoneHlc: op.hlc };
    return { kind: 'put', row: stamped(op.value, { _hlc: op.hlc }) };
  },
};

export class AppendOnlyViolation extends Error {}
export const AppendOnlyPlugin: MergePlugin = {
  id: 'appendOnly',
  capture(change, ctx) {
    if (change.kind !== 'create') throw new AppendOnlyViolation(`${ctx.entity} is append-only (${change.kind} rejected)`);
    const hlc = ctx.clock.tick();
    return { op: { ...base(ctx, change.key, hlc), op: 'put', value: ctx.wire(change.next) as never }, stamp: { _hlc: hlc } };
  },
  apply(state, op) {
    if (state.row || op.op !== 'put') return { kind: 'noop' }; // idempotent by key
    return { kind: 'put', row: stamped(op.value, { _hlc: op.hlc }) };
  },
};

const ANCESTOR_CAP = 32;
/**
 * Versioned CAS. Every write carries the revision it was based on. Fast-forwards apply silently;
 * concurrent edits converge on the HIGHER revision as the main row and keep the other as a draft with a
 * deterministic id, so every replica ends with the same row AND the same drafts. Edit beats delete.
 */
export const CasDraftPlugin: MergePlugin = {
  id: 'casDraft',
  capture(change, ctx) {
    const hlc = ctx.clock.tick();
    if (change.kind === 'delete') return { op: { ...base(ctx, change.key, hlc), op: 'del', baseRevision: change.prev._rev }, stamp: {}, tombstone: true };
    const prev = change.kind === 'update' ? change.prev : undefined;
    const anc = prev?._rev ? [...(prev._anc ?? []), prev._rev].slice(-ANCESTOR_CAP) : [];
    return {
      op: { ...base(ctx, change.key, hlc), op: 'put', value: ctx.wire(change.next) as never, baseRevision: prev?._rev },
      stamp: { _hlc: hlc, _rev: hlc, _anc: anc },
    };
  },
  apply(state, op) {
    const local = state.row;
    if (op.op === 'del') {
      if (!local) return state.tombstoneHlc && compareHlc(op.hlc, state.tombstoneHlc) <= 0 ? { kind: 'noop' } : { kind: 'del', tombstoneHlc: op.hlc };
      return op.baseRevision === local._rev ? { kind: 'del', tombstoneHlc: op.hlc } : { kind: 'noop' }; // edit beats delete
    }
    const stampedIncoming = (anc: Hlc[]) => stamped(op.value, { _hlc: op.hlc, _rev: op.hlc, _anc: anc });
    if (!local) {
      if (state.tombstoneHlc && compareHlc(op.hlc, state.tombstoneHlc) < 0) return { kind: 'noop' };
      return { kind: 'put', row: stampedIncoming(op.baseRevision ? [op.baseRevision] : []) };
    }
    if (op.hlc === local._rev || (local._anc ?? []).includes(op.hlc)) return { kind: 'noop' }; // already have it / older
    if (op.baseRevision === local._rev) return { kind: 'put', row: stampedIncoming([...(local._anc ?? []), local._rev as Hlc].slice(-ANCESTOR_CAP)) };
    // concurrent: deterministic winner, loser kept as a draft with a deterministic id
    const localRev = local._rev ?? local._hlc ?? '';
    const draftOf = (rev: Hlc, value: unknown): ConflictDraft => ({ id: `${op.entity}:${op.key}@${rev}`, entity: op.entity, key: op.key, value });
    if (compareHlc(op.hlc, localRev) > 0) {
      return { kind: 'put', row: stampedIncoming([...(local._anc ?? []), localRev].slice(-ANCESTOR_CAP)), drafts: [draftOf(localRev, toWire(local))] };
    }
    return { kind: 'put', row: local, drafts: [draftOf(op.hlc, op.value)] }; // local wins; row unchanged, remote kept as draft
  },
};

export const PLUGINS: Record<MergeStrategyId, MergePlugin> = { lww: LwwPlugin, appendOnly: AppendOnlyPlugin, casDraft: CasDraftPlugin };

/* ════════════════════════════ 4. Transaction origin + hooks ════════════════════════════ */

/**
 * local   — user-initiated; captured to outbox/tombstones, stamped.
 * remote  — inbound reconcile; NOT captured (kills echo loops). Reconciler stamps rows itself.
 * bypass  — local maintenance (vault prune, category toggle-off, reset); NOT captured, so no phantom tombstones.
 */
export type TxOrigin = 'local' | 'remote' | 'bypass';
type TaggedTx = Transaction & { origin?: TxOrigin };

/** Walk the parent chain: nested db.transaction() builds a fresh Transaction that does not inherit props. */
export function originOf(tx: Transaction | null | undefined): TxOrigin {
  for (let t = tx as TaggedTx | null | undefined; t; t = t.parent as TaggedTx | undefined) if (t.origin) return t.origin;
  return 'local'; // default-capture: forgetting to tag fails SAFE (syncs) rather than silently dropping changes
}

export class SyncScopeError extends Error {}
export class OriginConflictError extends Error {}

/**
 * The only sanctioned way to write synced tables. Always adds outbox + tombstones to the scope.
 * A nested call must not change origin (a 'remote' tx opening a 'local' sub-tx would emit echoes).
 */
export function withOrigin<T>(db: LunaClairDatabase, origin: TxOrigin, tables: Table[], fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const cur = Dexie.currentTransaction;
  if (cur && originOf(cur) !== origin) throw new OriginConflictError(`nested transaction origin ${origin} inside ${originOf(cur)}`);
  const scope = [...new Set([...tables, db.outbox, db.tombstones, db.heldOps, db.conflictDrafts, db.syncCursor])];
  return db.transaction('rw', scope, async (tx) => {
    if (!cur) (tx as TaggedTx).origin = origin;
    return fn(tx);
  });
}

const applyMods = <T extends object>(prev: T, mods: Record<string, unknown>): T => {
  const next = structuredClone(prev);
  for (const [kp, v] of Object.entries(mods)) {
    if (v === undefined) Dexie.delByKeyPath(next, kp); else Dexie.setByKeyPath(next, kp, v);
  }
  return next;
};

export function installSyncHooks(db: LunaClairDatabase, clock: HlcClock): void {
  for (const [name, cfg] of syncedTables()) {
    const table = db.table(name);
    const plugin = PLUGINS[cfg.mergeStrategy];
    const ctx: CaptureCtx = { clock, entity: cfg.entity, schemaVersion: cfg.schemaVersion, wire: (r) => toWire(r, cfg.excludeFields) };

    // Synchronous guard: a missing scope would otherwise fail ASYNCHRONOUSLY and the main write would still commit.
    const guard = (tx: Transaction) => {
      for (const need of ['outbox', 'tombstones']) {
        if (!tx.storeNames.includes(need)) throw new SyncScopeError(`write to ${name} outside withOrigin(): ${need} not in transaction scope`);
      }
    };
    const emit = (tx: Transaction, cap: CaptureResult<object>, key: string) => {
      // If the outbox/tombstone write fails, roll back the whole transaction instead of committing an unsynced change.
      tx.table('outbox').add(cap.op).catch((e: unknown) => { console.error('sync capture failed; aborting write', e); tx.abort(); });
      if (cap.tombstone) {
        tx.table('tombstones').put({ id: `${cfg.entity}:${key}`, entity: cfg.entity, key, hlc: cap.op.hlc }).catch((e: unknown) => { console.error('sync capture failed; aborting write', e); tx.abort(); });
      }
    };

    table.hook('creating', function (pk, obj, tx) {
      if (originOf(tx) !== 'local') return;
      guard(tx);
      const key = String(pk);
      const cap = plugin.capture({ kind: 'create', key, next: obj as object }, ctx);
      if (!cap) return;
      Object.assign(obj, cap.stamp);
      emit(tx, cap, key);
    });
    table.hook('updating', function (mods, pk, prev, tx) {
      if (originOf(tx) !== 'local' || Object.keys(mods).length === 0) return; // identical put() => empty mods
      guard(tx);
      const key = String(pk);
      const next = applyMods(prev as object, mods as Record<string, unknown>);
      const cap = plugin.capture({ kind: 'update', key, prev: prev as object, next }, ctx);
      if (!cap) return;
      emit(tx, cap, key);
      return cap.stamp as Record<string, unknown>;
    });
    table.hook('deleting', function (pk, prev, tx) {
      if (originOf(tx) !== 'local') return;
      guard(tx);
      const key = String(pk);
      const cap = plugin.capture({ kind: 'delete', key, prev: prev as object }, ctx);
      if (cap) emit(tx, cap, key);
    });
  }
}

/* ════════════════════════════ 5. Remote apply ════════════════════════════ */

export function upcast(op: JournalOp, cfg: SyncEntityConfig): JournalOp | 'newer' {
  if (op.schemaVersion > cfg.schemaVersion) return 'newer';
  let value = op.value;
  for (let v = op.schemaVersion; v < cfg.schemaVersion; v++) {
    const up = cfg.upcasters[v];
    if (!up) throw new Error(`${cfg.entity}: missing upcaster ${v}->${v + 1}`);
    value = up(value);
  }
  return { ...op, value, schemaVersion: cfg.schemaVersion };
}

/**
 * PRECONDITION: ops are already downloaded, gunzipped and parsed. NOTHING in here may await a non-Dexie
 * promise — IDB auto-commits and you get a half-applied batch (verified). Batch per journal file and
 * advance the cursor in the SAME transaction.
 *
 * Children are written immediately even if their parent is absent (eventual convergence; see findOrphans).
 */
export async function applyRemoteOps(db: LunaClairDatabase, clock: HlcClock, ops: JournalOp[], cursor?: Hlc): Promise<Map<TableName, Set<string>>> {
  const rank = new Map(restoreOrder().map((n, i) => [n, i] as const));
  const touched = new Map<TableName, Set<string>>();
  const known = ops.map((op) => ({ op, table: tableForEntity(op.entity) }));
  const sorted = known
    .filter((k): k is { op: JournalOp; table: TableName } => k.table !== undefined)
    .sort((a, b) => (rank.get(a.table) ?? 0) - (rank.get(b.table) ?? 0) || compareHlc(a.op.hlc, b.op.hlc));
  const unknown = known.filter((k) => k.table === undefined).map((k) => k.op);

  await withOrigin(db, 'remote', sorted.map((s) => db.table(s.table)), async () => {
    for (const op of unknown) await db.heldOps.put({ id: `${op.entity}:${op.key}:${op.hlc}`, op, reason: 'unknown-entity' });
    for (const { op: raw, table } of sorted) {
      const cfg = SYNC_POLICY[table] as SyncEntityConfig;
      const up = upcast(raw, cfg);
      if (up === 'newer') { await db.heldOps.put({ id: `${raw.entity}:${raw.key}:${raw.hlc}`, op: raw, reason: 'newer-schema' }); continue; }
      const t = db.table(table);
      const state: LocalState<object> = {
        row: (await t.get(up.key)) as (object & SyncStamp) | undefined,
        tombstoneHlc: (await db.tombstones.get(`${cfg.entity}:${up.key}`))?.hlc,
      };
      const d = PLUGINS[cfg.mergeStrategy].apply(state, up as JournalOp<object>);
      clock.receive(up.hlc);
      if (d.kind === 'noop') continue;
      if (d.kind === 'put') {
        await t.put(d.row);
        await db.tombstones.delete(`${cfg.entity}:${up.key}`);
        if (d.drafts?.length) await db.conflictDrafts.bulkPut(d.drafts);
      } else {
        await t.delete(up.key);
        await db.tombstones.put({ id: `${cfg.entity}:${up.key}`, entity: cfg.entity, key: up.key, hlc: d.tombstoneHlc });
      }
      touched.set(table, (touched.get(table) ?? new Set()).add(up.key));
    }
    if (cursor) await db.syncCursor.put({ id: 'remote', hlc: cursor });
  });
  return touched;
}

/* ════════════════════════════ 6. Orphans ════════════════════════════ */

/** Rows whose declared parent row does not exist (yet). Dexie enforces no FKs, so this is a read-side concern. */
export async function findOrphans(db: LunaClairDatabase): Promise<Partial<Record<TableName, string[]>>> {
  const result: Partial<Record<TableName, string[]>> = {};
  for (const [name, cfg] of syncedTables()) {
    if (!cfg.parent) continue;
    const rows = (await db.table(name).toArray()) as Array<Record<string, unknown> & { id: string }>;
    const parentKeys = [...new Set(rows.map((r) => cfg.parent?.key(r as never)).filter((k): k is string => !!k))];
    const present = new Set((await db.table(cfg.parent.table).bulkGet(parentKeys)).map((p, i) => (p ? parentKeys[i] : undefined)));
    const orphans = rows.filter((r) => { const pk = cfg.parent?.key(r as never); return pk !== undefined && !present.has(pk); }).map((r) => r.id);
    if (orphans.length) result[name] = orphans;
  }
  return result;
}

/** The read-side contract: never `!`-assert a parent. UI queries go through helpers shaped like this. */
export async function highlightsWithDocument(db: LunaClairDatabase, documentIds: string[]) {
  const docs = await db.documentContents.bulkGet(documentIds);
  const alive = new Set(documentIds.filter((_, i) => docs[i]));
  const rows = await db.highlights.where('documentId').anyOf(documentIds).toArray();
  return { visible: rows.filter((h) => alive.has(h.documentId)), orphaned: rows.filter((h) => !alive.has(h.documentId)) };
}

/* ════════════════════════════ 7. FSRS: review log is truth, state is derived ════════════════════════════ */

export interface Scheduler { next(prev: CardState | undefined, rating: 1 | 2 | 3 | 4, at: number, cardKey: string): CardState }

const logOrder = (a: ReviewLog & SyncStamp, b: ReviewLog & SyncStamp) =>
  a.at - b.at || compareHlc(a._hlc ?? '', b._hlc ?? '') || (a.id < b.id ? -1 : 1);

/**
 * Deterministic: same set of logs => same state, regardless of arrival order.
 * The latest keyframe resets state; only reviews AFTER it are applied (earlier ones are already inside it).
 */
export function foldCard(logs: Array<ReviewLog & SyncStamp>, sched: Scheduler): CardState | undefined {
  const sorted = [...logs].sort(logOrder);
  let start = -1;
  sorted.forEach((l, i) => { if (l.kind === 'keyframe') start = i; });
  let state: CardState | undefined = start >= 0 ? sorted[start]?.state : undefined;
  for (const l of sorted.slice(start + 1)) {
    if (l.kind === 'review' && l.rating) state = sched.next(state, l.rating, l.at, l.cardKey);
  }
  return state;
}

/** Recompute derived state for specific cards (called with `touched` from applyRemoteOps, in the same tx as the apply). */
export async function rebuildCards(db: LunaClairDatabase, cardKeys: Iterable<string>, sched: Scheduler): Promise<void> {
  for (const cardKey of cardKeys) {
    const logs = await db.reviewLogs.where('cardKey').equals(cardKey).toArray();
    const state = foldCard(logs, sched);
    if (state) await db.flashcardReviews.put(state); else await db.flashcardReviews.delete(cardKey);
  }
}

/** One-time, idempotent: each existing state row becomes a deterministic keyframe log (id includes the device). */
export async function migrateStateToKeyframes(db: LunaClairDatabase, deviceId: string): Promise<number> {
  const rows = await db.flashcardReviews.toArray();
  const ids = rows.map((r) => `kf:${r.cardKey}:${deviceId}`);
  const have = await db.reviewLogs.bulkGet(ids);
  const fresh = rows.filter((_, i) => !have[i]);
  // origin 'local': keyframes are real, syncable log entries (appendOnly), so they ride the normal capture path
  await withOrigin(db, 'local', [db.reviewLogs], async () => {
    await db.reviewLogs.bulkAdd(fresh.map((r) => ({ id: `kf:${r.cardKey}:${deviceId}`, cardKey: r.cardKey, kind: 'keyframe' as const, at: r.lastReview ?? 0, state: r, deviceId })));
  });
  return fresh.length;
}

/** Wire it all up. */
export function openLunaClairDb(name: string, deviceId: string, now?: () => number): { db: LunaClairDatabase; clock: HlcClock } {
  const db = new Dexie(name) as LunaClairDatabase;
  db.version(1).stores(DEXIE_SCHEMA);
  assertPolicyMatchesSchema(db);
  const clock = createClock(deviceId, now);
  installSyncHooks(db, clock);
  return { db, clock };
}
