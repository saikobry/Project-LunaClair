/**
 * Declarative synchronization policy & table registry for LunaClair.
 *
 * Implements declarative synchronization policy and entity reconciliation rules from ADR-018.
 * Provides compile-time exhaustiveness via TypeScript `satisfies`, Kahn topological
 * restore ordering, prunability introspection, and runtime schema drift detection.
 */

export type TableName =
  | 'materials'
  | 'questions'
  | 'quizzes'
  | 'quizSessions'
  | 'documentContents'
  | 'highlights'
  | 'drawings'
  | 'reviewLogs'
  | 'flashcardReviews'
  | 'localAssets'
  | 'outbox'
  | 'tombstones'
  | 'conflictDrafts'
  | 'heldOps'
  | 'pendingHydrations'
  | 'syncCursor';

export type SyncCategory = 'annotations' | 'flashcards' | 'customMaterials' | 'studyHistory';
export type MergeStrategyId = 'lww' | 'appendOnly' | 'casDraft';

/** upcasters[n] converts a wire row from schema version n to n+1. */
export type Upcaster = (wireRow: unknown) => unknown;

export interface SyncEntityConfig<_K extends TableName = TableName> {
  kind: 'authoritative';
  /** Wire name in journals. Decoupled from the Dexie table name so renaming a table never breaks old journals. */
  entity: string;
  mergeStrategy: MergeStrategyId;
  category: SyncCategory;
  /** Tables that should be applied before this one (restore order). NOT enforced as foreign keys. */
  dependencies: readonly TableName[];
  /** For orphan detection / cascade GC. */
  parent?: { table: TableName; key(row: any): string | undefined };
  schemaVersion: number;
  upcasters: Readonly<Record<number, Upcaster>>;
  /** Fields never put on the wire (blobs, caches). Default-include is a trap; keep this explicit. */
  excludeFields?: readonly string[];
}

export interface DerivedConfig {
  kind: 'derived';
  rebuildFrom: readonly TableName[];
  reason: string;
}

export interface LocalOnlyConfig {
  kind: 'localOnly';
  reason: string;
  prunable: boolean;
}

export type TablePolicy<K extends TableName = TableName> =
  | SyncEntityConfig<K>
  | DerivedConfig
  | LocalOnlyConfig;

export type PolicyKind = TablePolicy['kind'];

/**
 * Single authoritative policy record for LunaClair IndexedDB tables.
 * Compile-time exhaustiveness ensured by TypeScript `satisfies`.
 */
export const SYNC_POLICY = {
  materials: {
    kind: 'authoritative',
    entity: 'material',
    mergeStrategy: 'lww',
    category: 'customMaterials',
    dependencies: [],
    schemaVersion: 1,
    upcasters: {},
  },
  questions: {
    kind: 'authoritative',
    entity: 'question',
    mergeStrategy: 'lww',
    category: 'customMaterials',
    dependencies: ['materials'],
    parent: { table: 'materials', key: (r) => r.materialId },
    schemaVersion: 1,
    upcasters: {},
  },
  quizzes: {
    kind: 'authoritative',
    entity: 'quiz',
    mergeStrategy: 'lww',
    category: 'customMaterials',
    dependencies: ['materials', 'questions'],
    parent: { table: 'materials', key: (r) => r.materialId },
    schemaVersion: 1,
    upcasters: {},
  },
  documentContents: {
    kind: 'authoritative',
    entity: 'documentContent',
    mergeStrategy: 'casDraft',
    category: 'customMaterials',
    dependencies: ['materials'],
    parent: { table: 'materials', key: (r) => r.materialId },
    schemaVersion: 1,
    upcasters: {},
  },
  highlights: {
    kind: 'authoritative',
    entity: 'highlight',
    mergeStrategy: 'lww',
    category: 'annotations',
    dependencies: ['documentContents'],
    parent: { table: 'documentContents', key: (r) => r.documentId },
    schemaVersion: 1,
    upcasters: {},
  },
  drawings: {
    kind: 'authoritative',
    entity: 'drawing',
    mergeStrategy: 'lww',
    category: 'annotations',
    dependencies: ['documentContents'],
    parent: { table: 'documentContents', key: (r) => r.documentId },
    schemaVersion: 1,
    upcasters: {},
  },
  quizSessions: {
    kind: 'authoritative',
    entity: 'quizSession',
    mergeStrategy: 'appendOnly',
    category: 'studyHistory',
    dependencies: ['quizzes'],
    parent: { table: 'quizzes', key: (r) => r.quizId },
    schemaVersion: 1,
    upcasters: {},
  },
  reviewLogs: {
    kind: 'authoritative',
    entity: 'reviewLog',
    mergeStrategy: 'appendOnly',
    category: 'flashcards',
    dependencies: [],
    schemaVersion: 1,
    upcasters: {},
  },
  flashcardReviews: {
    kind: 'derived',
    rebuildFrom: ['reviewLogs'],
    reason: 'FSRS state = fold(reviewLogs); rebuilt on remote apply and on FSRS parameter changes',
  },
  localAssets: {
    kind: 'localOnly',
    reason: 're-fetchable content cache or local binaries',
    prunable: true,
  },
  outbox: {
    kind: 'localOnly',
    reason: 'pending local ops; pruning loses unsynced changes',
    prunable: false,
  },
  tombstones: {
    kind: 'localOnly',
    reason: 'delete markers needed to block resurrection',
    prunable: false,
  },
  conflictDrafts: {
    kind: 'localOnly',
    reason: 'deterministically re-derivable from ops, but user-visible',
    prunable: false,
  },
  heldOps: {
    kind: 'localOnly',
    reason: 'ops from newer clients waiting for an upgrade; MUST be carried into snapshots',
    prunable: false,
  },
  pendingHydrations: {
    kind: 'localOnly',
    reason: 'hydration queue for Explore pointers',
    prunable: false,
  },
  syncCursor: {
    kind: 'localOnly',
    reason: 'per-vault sync position; reset together with data or not at all',
    prunable: false,
  },
} as const satisfies { [K in TableName]: TablePolicy<K> };

/**
 * Returns all tables marked with `kind: 'authoritative'`.
 */
export function syncedTables(): Array<[TableName, SyncEntityConfig]> {
  return (Object.entries(SYNC_POLICY) as Array<[TableName, TablePolicy]>)
    .filter((e): e is [TableName, SyncEntityConfig] => e[1].kind === 'authoritative');
}

/**
 * Looks up the Dexie table name corresponding to a journal wire entity name.
 */
export const tableForEntity = (entity: string): TableName | undefined => {
  if (entity === 'quizAttempt') return 'quizSessions';
  return syncedTables().find(([, c]) => c.entity === entity)?.[0];
};

/**
 * Kahn topological sort over synced authoritative tables; throws on cycles.
 */
export function restoreOrder(policy: Record<string, TablePolicy> = SYNC_POLICY): TableName[] {
  const nodes = (Object.entries(policy) as Array<[TableName, TablePolicy]>)
    .filter((e): e is [TableName, SyncEntityConfig] => e[1].kind === 'authoritative');
  const names = new Set(nodes.map(([n]) => n));
  const indeg = new Map<TableName, number>(nodes.map(([n]) => [n, 0]));
  const out = new Map<TableName, TableName[]>();

  for (const [n, c] of nodes) {
    for (const d of c.dependencies) {
      if (!names.has(d)) continue;
      indeg.set(n, (indeg.get(n) ?? 0) + 1);
      out.set(d, [...(out.get(d) ?? []), n]);
    }
  }

  const queue = [...indeg].filter(([, v]) => v === 0).map(([n]) => n).sort();
  const order: TableName[] = [];

  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of out.get(n) ?? []) {
      indeg.set(m, (indeg.get(m) ?? 1) - 1);
      if ((indeg.get(m) ?? 0) === 0) queue.push(m);
    }
  }

  if (order.length !== nodes.length) {
    throw new Error('SYNC_POLICY dependency cycle');
  }

  return order;
}

/**
 * Runtime schema completeness check: catches drift between declared policy and schema tables.
 */
export function assertPolicyMatchesSchema(tableNames: readonly string[]): void {
  const real = new Set(tableNames);
  const declared = new Set(Object.keys(SYNC_POLICY));
  const missing = [...real].filter((n) => !declared.has(n));
  const phantom = [...declared].filter((n) => !real.has(n));

  if (missing.length > 0 || phantom.length > 0) {
    throw new Error(`SYNC_POLICY out of sync with schema. missing: [${missing}] phantom: [${phantom}]`);
  }
}

/**
 * Returns true if a table is safe for Vault Inspector cache clear or derived state rebuild.
 */
export const isPrunable = (table: string): boolean => {
  if (table === 'assetCache') return true;
  const p = (SYNC_POLICY as Record<string, TablePolicy | undefined>)[table];
  if (!p) return false;
  return p.kind === 'derived' || (p.kind === 'localOnly' && p.prunable);
};

/**
 * Returns all table names belonging to a specific sync category.
 */
export function getTablesForCategory(category: SyncCategory | 'quizHistory'): TableName[] {
  const targetCategory = category === 'quizHistory' ? 'studyHistory' : category;
  const tables: TableName[] = [];
  for (const [table, policy] of Object.entries(SYNC_POLICY)) {
    if (policy.kind === 'authoritative' && policy.category === targetCategory) {
      tables.push(table as TableName);
    }
  }
  if (targetCategory === 'flashcards') {
    tables.push('flashcardReviews');
  }
  return tables;
}

