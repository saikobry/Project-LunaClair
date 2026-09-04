import type { Table, Transaction } from 'dexie';
import type { LunaClairDatabase } from '../schema/LunaClairDatabase';
import type {
    SyncEntityType,
    SyncOperation,
    SyncQueueItem,
} from '../../../domain/sync/models/sync.types';

export interface SyncableMutationInput<TPayload> {
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    payload: TPayload;
    baseVersion?: number;
    clientMutationId?: string; // If not provided, generates once via crypto.randomUUID()
}

export interface SyncableTransactionResult<TEntityResult, TPayload> {
    result: TEntityResult;
    queueItem: SyncQueueItem<TPayload>;
}

/**
 * Executes a mutation function and enqueues an outbox SyncQueueItem atomically
 * within a single Dexie read-write transaction.
 *
 * Guarantees:
 * 1. Atomicity: If mutationFn or outbox enqueue throws, the entire transaction rolls back.
 * 2. Scope Safety: Ensures db.syncQueue is included in the transaction table scope.
 * 3. Idempotency: Generates or preserves logical clientMutationId for cloud deduplication.
 */
export async function runSyncableTransaction<TEntityResult, TPayload>(
    db: LunaClairDatabase,
    tables: Table<any, any>[],
    mutationInput: SyncableMutationInput<TPayload>,
    mutationFn: (tx: Transaction) => Promise<TEntityResult>
): Promise<SyncableTransactionResult<TEntityResult, TPayload>> {
    const tableSet = new Set<Table<any, any>>(tables);
    tableSet.add(db.syncQueue);
    const transactionTables = Array.from(tableSet);

    const clientMutationId = mutationInput.clientMutationId ?? crypto.randomUUID();
    const queueItemId = crypto.randomUUID();
    const now = new Date().toISOString();

    const queueItem: SyncQueueItem<TPayload> = {
        id: queueItemId,
        clientMutationId,
        entityType: mutationInput.entityType,
        entityId: mutationInput.entityId,
        operation: mutationInput.operation,
        ...(mutationInput.baseVersion !== undefined ? { baseVersion: mutationInput.baseVersion } : {}),
        clientTimestamp: now,
        payload: mutationInput.payload,
        status: 'pending',
        createdAt: now,
        retryCount: 0,
    };

    return await db.transaction('rw', transactionTables, async (tx) => {
        const result = await mutationFn(tx);
        await db.syncQueue.add(queueItem);
        return { result, queueItem };
    });
}
