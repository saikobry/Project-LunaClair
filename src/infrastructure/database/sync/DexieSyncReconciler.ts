import type { Table } from 'dexie';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import { createSyncStateKey } from '../../../domain/sync/utils/syncIdentity';
import { compareHlc } from '../../../domain/sync/utils/hlc';
import type { ConflictDraft, SyncPushRequest, SyncPushResponse, SyncPullResponse, SyncQueueItem, SyncState } from '../../../domain/sync/models/sync.types';
import type { SyncReconciler, ReconcilePullResult, ApplyPushResult } from '../../../domain/sync/services/SyncReconciler';
import { isSyncCategoryEnabled } from '../../../domain/sync/preferences/SyncCategoryPreferences';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import {
  SYNC_POLICY,
  tableForEntity,
  type SyncCategory,
  type TableName,
} from '../../../domain/sync/policy/SyncPolicy';
import {
  PLUGINS,
  type JournalOp,
} from '../../../domain/sync/reconcilers/plugins/MergePlugin';
import { withOrigin } from './transactionContext';
import { deriveEntityHlc } from '../../api/google/streamVaultChunksGzipped';

export type { ReconcilePullResult, ApplyPushResult };

async function findMaterialByOriginShareId(
  db: LunaClairDatabase,
  originShareId: string
): Promise<StudyMaterial | undefined> {
  if (!originShareId) return undefined;
  const direct = await db.materials.get(`mat_share_${originShareId}`);
  if (direct) {
    return direct;
  }
  try {
    if (db.materials.schema?.indexes?.some((idx) => idx.name === 'originShareId')) {
      const found = await db.materials.where('originShareId').equals(originShareId).first();
      if (found) return found;
    }
  } catch {
    // Ignore schema error and fall back to filter scan
  }
  return await db.materials.filter((m) => m.originShareId === originShareId).first();
}

/**
 * Transactional sync reconciler for Dexie / IndexedDB.
 *
 * Coordinates atomic batch pull reconciliation using pure merge plugins
 * and push outcome application across local database tables, outbox mutations,
 * and conflict draft records.
 */
export class DexieSyncReconciler implements SyncReconciler {
  private readonly db: LunaClairDatabase;
  private readonly isCategoryEnabled: (category: SyncCategory) => boolean;

  constructor(
    database: LunaClairDatabase = getActiveVaultDatabase(),
    isCategoryEnabled: (category: SyncCategory) => boolean = isSyncCategoryEnabled
  ) {
    this.db = database;
    this.isCategoryEnabled = isCategoryEnabled;
  }

  /**
   * Reconciles a server pull response batch into Dexie using generic table lookup,
   * pure merge plugins, and batched remote transactions.
   */
  async reconcilePullBatch(
    userId: string,
    deviceId: string,
    currentCursor: number,
    pullResponse: SyncPullResponse
  ): Promise<ReconcilePullResult>;
  async reconcilePullBatch(
    db: LunaClairDatabase,
    userId: string,
    deviceId: string,
    currentCursor: number,
    pullResponse: SyncPullResponse
  ): Promise<ReconcilePullResult>;
  async reconcilePullBatch(
    dbOrUserId: LunaClairDatabase | string,
    userIdOrDeviceId?: string,
    deviceIdOrCurrentCursor?: string | number,
    currentCursorOrPullResponse?: number | SyncPullResponse,
    maybePullResponse?: SyncPullResponse
  ): Promise<ReconcilePullResult> {
    let db: LunaClairDatabase;
    let userId: string;
    let deviceId: string;
    let currentCursor: number | undefined;
    let pullResponse: SyncPullResponse;

    if (typeof dbOrUserId === 'string') {
      db = this.db;
      userId = dbOrUserId;
      deviceId = userIdOrDeviceId!;
      if (typeof deviceIdOrCurrentCursor === 'number') {
        currentCursor = deviceIdOrCurrentCursor;
        pullResponse = currentCursorOrPullResponse as SyncPullResponse;
      } else {
        pullResponse = currentCursorOrPullResponse as SyncPullResponse;
        currentCursor = pullResponse.receipt?.baseCursor;
      }
    } else {
      db = dbOrUserId;
      userId = userIdOrDeviceId!;
      deviceId = deviceIdOrCurrentCursor as string;
      if (typeof currentCursorOrPullResponse === 'number') {
        currentCursor = currentCursorOrPullResponse;
        pullResponse = maybePullResponse!;
      } else {
        pullResponse = currentCursorOrPullResponse as SyncPullResponse;
        currentCursor = pullResponse.receipt?.baseCursor;
      }
    }

    if (pullResponse.receipt) {
      if (pullResponse.receipt.userId && pullResponse.receipt.userId !== userId) {
        throw new Error(
          `Receipt user mismatch: receipt ${pullResponse.receipt.userId} but expected ${userId}`
        );
      }
      if (pullResponse.receipt.deviceId && pullResponse.receipt.deviceId !== deviceId) {
        throw new Error(
          `Receipt device mismatch: receipt ${pullResponse.receipt.deviceId} but expected ${deviceId}`
        );
      }
    }

    const changes = pullResponse.changes ?? [];
    const CHUNK_SIZE = 250;
    const chunks = changes.length > 0
      ? Array.from({ length: Math.ceil(changes.length / CHUNK_SIZE) }, (_, i) =>
          changes.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        )
      : [[]];

    let appliedCount = 0;
    let conflictCount = 0;
    const touchedEntities = new Set<string>();
    let isStaleBatch = false;
    let staleNewCursor = 0;
    let lastCommittedRevision: number | undefined;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const touchedTablesSet = new Set<Table>();
      if (db.syncState) touchedTablesSet.add(db.syncState);
      if (db.syncQueue) touchedTablesSet.add(db.syncQueue);
      if (db.conflictDrafts) touchedTablesSet.add(db.conflictDrafts);
      if (db.tombstones) touchedTablesSet.add(db.tombstones);
      if (db.heldOps) touchedTablesSet.add(db.heldOps);
      if (db.pendingHydrations) touchedTablesSet.add(db.pendingHydrations);

      for (const change of chunk) {
        if (change.entityType === 'pointer') {
          if (db.pendingHydrations) touchedTablesSet.add(db.pendingHydrations);
          if (db.materials) touchedTablesSet.add(db.materials);
          continue;
        }
        const tableName = tableForEntity(change.entityType);
        if (tableName && db.tables.some((t) => t.name === tableName)) {
          touchedTablesSet.add(db.table(tableName));
        }
      }
      const touchedTables = Array.from(touchedTablesSet);

      await withOrigin(db, 'remote', touchedTables, async () => {
        const stateKey = createSyncStateKey(userId, deviceId);
        const existingState = await db.syncState.get(stateKey);
        const storedRevision = existingState?.checkpointRevision ?? 0;
        const storedCursor = existingState?.lastServerCursor;

        // Pre-Write check: inside the transaction BEFORE any entity mutations or checkpoint writes
        if (chunkIndex === 0 && existingState) {

          // Check base revision: if receipt has baseRevision and it doesn't match storedRevision, fence
          if (
            pullResponse.receipt?.baseRevision !== undefined &&
            pullResponse.receipt.baseRevision !== storedRevision
          ) {
            isStaleBatch = true;
            staleNewCursor = storedCursor ?? 0;
            return;
          }

          // Check base cursor: if storedCursor is recorded and does not match, fence
          if (typeof storedCursor === 'number') {
            if (typeof currentCursor === 'number' && currentCursor !== storedCursor) {
              isStaleBatch = true;
              staleNewCursor = storedCursor;
              return;
            }
            if (
              pullResponse.receipt?.baseCursor !== undefined &&
              pullResponse.receipt.baseCursor !== storedCursor
            ) {
              isStaleBatch = true;
              staleNewCursor = storedCursor;
              return;
            }
            if (pullResponse.newCursor < storedCursor) {
              isStaleBatch = true;
              staleNewCursor = storedCursor;
              return;
            }
          }
        }
        const keysByTable = new Map<TableName, Set<string>>();
        const entitiesByTable = new Map<TableName, string>();

        for (const change of chunk) {
          if (change.entityType === 'pointer') continue;
          const tableName = tableForEntity(change.entityType);
          if (!tableName) continue;
          const policy = SYNC_POLICY[tableName];
          if (policy?.kind !== 'authoritative') continue;
          if (policy.category && !this.isCategoryEnabled(policy.category)) continue;

          if (!keysByTable.has(tableName)) {
            keysByTable.set(tableName, new Set());
            entitiesByTable.set(tableName, policy.entity);
          }
          keysByTable.get(tableName)!.add(change.entityId);
        }

        const overlay = new Map<string, { row?: any; tombstoneHlc?: string }>();

        for (const [tableName, keysSet] of keysByTable.entries()) {
          const keys = Array.from(keysSet);
          const entity = entitiesByTable.get(tableName)!;
          const rows = await db.table(tableName).bulkGet(keys);
          const tombstoneKeys = keys.map((k) => `${entity}:${k}`);
          const tombstones = await db.tombstones.bulkGet(tombstoneKeys);

          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            overlay.set(`${tableName}:${key}`, {
              row: rows[i],
              tombstoneHlc: tombstones[i]?.hlc,
            });
          }
        }

        const pendingQueueMap = new Map<string, SyncQueueItem>();
        if (db.syncQueue) {
          const pendingItems = await db.syncQueue
            .where('status')
            .equals('pending')
            .toArray();
          for (const item of pendingItems) {
            pendingQueueMap.set(`${item.entityType}:${item.entityId}`, item);
          }
        }

        for (const change of chunk) {
          if (change.entityType === 'pointer') {
            const pointerData = (change.data ?? {}) as any;
            const originShareId = pointerData.originShareId ?? change.entityId;

            const existingMaterial = await findMaterialByOriginShareId(db, originShareId);
            if (existingMaterial) {
              await db.pendingHydrations.delete(originShareId);
              appliedCount++;
              touchedEntities.add(change.entityType);
              continue;
            }

            const existingPending = await db.pendingHydrations.get(originShareId);
            if (existingPending) {
              await db.pendingHydrations.put({
                ...existingPending,
                title: pointerData.title ?? existingPending.title,
                publishedAt: pointerData.publishedAt ?? change.changedAt ?? existingPending.publishedAt,
                schemaVersion: pointerData.schemaVersion ?? existingPending.schemaVersion,
              });
            } else {
              await db.pendingHydrations.put({
                originShareId,
                attempts: 0,
                nextAttemptAt: 0,
                title: pointerData.title,
                publishedAt: pointerData.publishedAt ?? change.changedAt,
                schemaVersion: pointerData.schemaVersion ?? 1,
              });
            }
            appliedCount++;
            touchedEntities.add(change.entityType);
            continue;
          }

          const tableName = tableForEntity(change.entityType);
          if (!tableName) {
            const op: JournalOp = {
              entity: change.entityType,
              key: change.entityId,
              hlc: (change as any).hlc ?? deriveEntityHlc(change.changedAt, deviceId),
              deviceId: (change as any).deviceId ?? deviceId,
              schemaVersion: change.version ?? 1,
              op: change.operation === 'DELETE' ? 'del' : 'put',
              value: change.data,
            };
            await db.heldOps.put({
              id: `${op.entity}:${op.key}:${op.hlc}`,
              op,
              reason: 'unknown-entity',
              error: `Unknown entity: ${change.entityType}`,
              heldAt: new Date().toISOString(),
            });
            continue;
          }

          const policy = SYNC_POLICY[tableName];
          if (policy?.kind !== 'authoritative') {
            continue;
          }

          if (policy.category && !this.isCategoryEnabled(policy.category)) {
            continue;
          }

          const plugin = PLUGINS[policy.mergeStrategy];
          if (!plugin) {
            continue;
          }

          const overlayKey = `${tableName}:${change.entityId}`;
          const currentLocal = overlay.get(overlayKey) ?? {};
          const localRow = currentLocal.row;
          const tombstoneHlc = currentLocal.tombstoneHlc;

          const isDelete =
            change.operation === 'DELETE' ||
            !change.data ||
            (change.data as { deletedAt?: string } | null)?.deletedAt !== undefined;

          const hlc = (change as any).hlc ?? deriveEntityHlc(change.changedAt, deviceId);
          const queueItem = pendingQueueMap.get(`${change.entityType}:${change.entityId}`);

          let baseRevision: string | undefined = (change as any).baseRevision;
          if (!baseRevision && change.version !== undefined) {
            baseRevision = `v${change.version}`;
          }

          let stateRow = localRow;
          if (localRow && policy.mergeStrategy === 'casDraft' && !localRow._rev) {
            if (!queueItem) {
              stateRow = {
                ...localRow,
                _rev: baseRevision,
              };
            } else {
              stateRow = {
                ...localRow,
                _rev: deriveEntityHlc(
                  queueItem.clientTimestamp ?? localRow.updatedAt,
                  deviceId
                ),
              };
            }
          } else if (localRow && policy.mergeStrategy === 'lww' && !localRow._hlc) {
            stateRow = {
              ...localRow,
              _hlc: deriveEntityHlc(
                localRow.deletedAt ?? localRow.updatedAt ?? localRow.createdAt,
                deviceId
              ),
            };
          }

          const op: JournalOp = {
            entity: change.entityType,
            key: change.entityId,
            hlc,
            deviceId: (change as any).deviceId ?? deviceId,
            schemaVersion: 1,
            op: isDelete ? 'del' : 'put',
            value: change.data,
            baseRevision,
          };

          try {
            const decision = plugin.apply(
              { row: stateRow, tombstoneHlc },
              op as JournalOp<object>
            );

            if (decision.kind === 'noop') {
              continue;
            }

            const tableRef = db.table(tableName);

            if (decision.kind === 'put') {
              const rowToWrite = { ...decision.row };
              if (tableName === 'documentContents') {
                (rowToWrite as any).documentId = (rowToWrite as any).documentId ?? change.entityId;
              } else {
                (rowToWrite as any).id = (rowToWrite as any).id ?? change.entityId;
              }

              await tableRef.put(rowToWrite);
              await db.tombstones.delete(`${policy.entity}:${change.entityId}`);

              if (decision.drafts && decision.drafts.length > 0) {
                for (const draft of decision.drafts) {
                  const documentId = (draft as any).key ?? change.entityId;
                  const baseVersion = queueItem?.baseVersion ?? (localRow as any)?.version ?? 0;
                  const serverVersion = change.version ?? (op.value as any)?.version ?? 1;
                  const localContent =
                    (localRow as any)?.content ??
                    (queueItem?.payload as any)?.content ??
                    (draft.value as any)?.content ??
                    '';
                  const serverContent = (op.value as any)?.content ?? '';

                  if (localContent.trim() === serverContent.trim()) {
                    const existingDoc = await db.documentContents.get(documentId);
                    if (existingDoc) {
                      const updated = {
                        ...existingDoc,
                        version: serverVersion,
                      };
                      await db.documentContents.put(updated);
                      overlay.set(overlayKey, { row: updated, tombstoneHlc: undefined });
                    }
                    await db.conflictDrafts.where('documentId').equals(documentId).delete();
                    appliedCount++;
                    touchedEntities.add(change.entityType);
                  } else {
                    const existingDraft = await db.conflictDrafts
                      .where('documentId')
                      .equals(documentId)
                      .first();

                    if (existingDraft) {
                      await db.conflictDrafts.put({
                        ...existingDraft,
                        serverVersion,
                        serverContent,
                      });
                    } else {
                      const draftRecord: ConflictDraft = {
                        ...draft,
                        id: draft.id ?? crypto.randomUUID(),
                        documentId,
                        baseVersion,
                        serverVersion,
                        localContent,
                        serverContent,
                        createdAt: new Date().toISOString(),
                      };
                      await db.conflictDrafts.put(draftRecord);
                    }
                    conflictCount++;
                  }
                }

                if (queueItem) {
                  await db.syncQueue.delete(queueItem.id);
                  pendingQueueMap.delete(`${change.entityType}:${change.entityId}`);
                }
              } else {
                appliedCount++;
                touchedEntities.add(change.entityType);
              }

              overlay.set(overlayKey, { row: rowToWrite, tombstoneHlc: undefined });
            } else if (decision.kind === 'del') {
              await tableRef.delete(change.entityId);
              const tombstoneRec = {
                id: `${policy.entity}:${change.entityId}`,
                entity: policy.entity,
                key: change.entityId,
                hlc: decision.tombstoneHlc,
              };
              await db.tombstones.put(tombstoneRec);
              appliedCount++;
              touchedEntities.add(change.entityType);
              overlay.set(overlayKey, { row: undefined, tombstoneHlc: decision.tombstoneHlc });
            }
          } catch (err: unknown) {
            await db.heldOps.put({
              id: op.key,
              op: op as any,
              reason: 'newer-schema',
              error: String(err),
              heldAt: new Date().toISOString(),
            });
          }
        }

        if (chunkIndex === chunks.length - 1) {
          const now = new Date().toISOString();
          const stateKey = createSyncStateKey(userId, deviceId);
          const existingState = await db.syncState.get(stateKey);

          let updatedAppliedFileIds = existingState?.appliedFileIds ?? [];
          let updatedPendingFileProgress = existingState?.pendingFileProgress;
          let updatedPageToken = existingState?.pageToken;
          let updatedPeerWatermarks = existingState?.peerWatermarks
            ? { ...existingState.peerWatermarks }
            : {};

          if (pullResponse.receipt) {
            const receipt = pullResponse.receipt;
            if (Array.isArray(receipt.appliedFileIds) && receipt.appliedFileIds.length > 0) {
              const fileIdSet = new Set(updatedAppliedFileIds);
              for (const fid of receipt.appliedFileIds) {
                fileIdSet.delete(fid);
                fileIdSet.add(fid);
              }
              updatedAppliedFileIds = Array.from(fileIdSet);
              if (updatedAppliedFileIds.length > 1000) {
                updatedAppliedFileIds = updatedAppliedFileIds.slice(-1000);
              }
            }

            if (receipt.pendingFileProgress) {
              const pending = receipt.pendingFileProgress;
              const alreadyApplied = updatedAppliedFileIds.includes(pending.fileId);
              const isSamePendingFile = existingState?.pendingFileProgress?.fileId === pending.fileId;
              const isRegressingOffset =
                isSamePendingFile &&
                typeof existingState?.pendingFileProgress?.offset === 'number' &&
                existingState.pendingFileProgress.offset >= pending.offset;

              if (!alreadyApplied && !isRegressingOffset) {
                updatedPendingFileProgress = pending;
              } else {
                updatedPendingFileProgress = existingState?.pendingFileProgress;
              }
            } else {
              if (
                existingState?.pendingFileProgress &&
                receipt.appliedFileIds?.includes(existingState.pendingFileProgress.fileId)
              ) {
                updatedPendingFileProgress = undefined;
              } else if (!existingState?.pendingFileProgress) {
                updatedPendingFileProgress = undefined;
              }
            }

            if (receipt.pageToken) {
              updatedPageToken = receipt.pageToken;
            }

            if (receipt.peerWatermarks) {
              for (const [pDeviceId, pHlc] of Object.entries(receipt.peerWatermarks)) {
                const currentHlc = updatedPeerWatermarks[pDeviceId];
                if (!currentHlc || compareHlc(pHlc, currentHlc) > 0) {
                  updatedPeerWatermarks[pDeviceId] = pHlc;
                }
              }
            }
          }

          const updatedRevision = (existingState?.checkpointRevision ?? storedRevision) + 1;
          lastCommittedRevision = updatedRevision;

          const newState: SyncState = {
            ...(existingState ?? {}),
            key: stateKey,
            userId,
            deviceId,
            lastServerCursor: pullResponse.newCursor,
            checkpointRevision: updatedRevision,
            lastSyncedAt: now,
            appliedFileIds: updatedAppliedFileIds,
            pendingFileProgress: updatedPendingFileProgress,
            pendingDiscovery: pullResponse.receipt?.pendingDiscovery,
            pageToken: updatedPageToken,
            peerWatermarks: updatedPeerWatermarks,
          };
          if (!updatedPendingFileProgress) {
            delete (newState as any).pendingFileProgress;
          }
          if (!newState.pendingDiscovery) {
            delete (newState as any).pendingDiscovery;
          }

          await db.syncState.put(newState);
        }
      });

      if (isStaleBatch) {
        break;
      }
    }

    if (isStaleBatch) {
      return {
        appliedCount: 0,
        conflictCount: 0,
        newCursor: staleNewCursor,
        isStale: true,
        touchedEntities: [],
      };
    }

    return {
      appliedCount,
      conflictCount,
      newCursor: pullResponse.newCursor,
      newRevision: lastCommittedRevision,
      touchedEntities: Array.from(touchedEntities),
    };
  }

  /**
   * Applies cloud push response outcomes (accepted, conflicts, rejected) within a single read-write transaction.
   *
   * Transaction scope:
   * - `documentContents`
   * - `conflictDrafts`
   * - `syncQueue`
   * - `syncState`
   */
  async applyPushResult(
    userId: string,
    deviceId: string,
    pushRequest: SyncPushRequest,
    pushResponse: SyncPushResponse
  ): Promise<ApplyPushResult>;
  async applyPushResult(
    db: LunaClairDatabase,
    userId: string,
    deviceId: string,
    pushRequest: SyncPushRequest,
    pushResponse: SyncPushResponse
  ): Promise<ApplyPushResult>;
  async applyPushResult(
    dbOrUserId: LunaClairDatabase | string,
    userIdOrDeviceId?: string,
    deviceIdOrPushRequest?: string | SyncPushRequest,
    pushRequestOrPushResponse?: SyncPushRequest | SyncPushResponse,
    maybePushResponse?: SyncPushResponse
  ): Promise<ApplyPushResult> {
    let db: LunaClairDatabase;
    let userId: string;
    let deviceId: string;
    let pushRequest: SyncPushRequest;
    let pushResponse: SyncPushResponse;

    if (typeof dbOrUserId === 'string') {
      db = this.db;
      userId = dbOrUserId;
      deviceId = userIdOrDeviceId!;
      pushRequest = deviceIdOrPushRequest as SyncPushRequest;
      pushResponse = pushRequestOrPushResponse as SyncPushResponse;
    } else {
      db = dbOrUserId;
      userId = userIdOrDeviceId!;
      deviceId = deviceIdOrPushRequest as string;
      pushRequest = pushRequestOrPushResponse as SyncPushRequest;
      pushResponse = maybePushResponse!;
    }
    return await db.transaction(
      'rw',
      [db.documentContents, db.conflictDrafts, db.syncQueue, db.syncState],
      async () => {
        const mutationsByClientMutationId = new Map(
          pushRequest.mutations.map((m) => [m.clientMutationId, m])
        );

        if (pushResponse.accepted.length > 0) {
          const acceptedMutationIds = pushResponse.accepted.map((a) => a.clientMutationId);
          const queueItems = await db.syncQueue
            .where('clientMutationId')
            .anyOf(acceptedMutationIds)
            .toArray();

          if (queueItems.length > 0) {
            await db.syncQueue.bulkDelete(queueItems.map((q) => q.id));
          }

          for (const accepted of pushResponse.accepted) {
            if (accepted.entityType === 'document' && accepted.newVersion !== undefined) {
              const localDoc = await db.documentContents.get(accepted.entityId);
              if (localDoc) {
                await db.documentContents.put({
                  ...localDoc,
                  version: accepted.newVersion,
                });
              }
            }
          }
        }

        if (pushResponse.conflicts.length > 0) {
          const conflictMutationIds = pushResponse.conflicts.map((c) => c.clientMutationId);
          const conflictQueueItems = await db.syncQueue
            .where('clientMutationId')
            .anyOf(conflictMutationIds)
            .toArray();

          if (conflictQueueItems.length > 0) {
            await db.syncQueue.bulkDelete(conflictQueueItems.map((q) => q.id));
          }

          // Only conflicts whose outbox row this call actually drained are ours to
          // surface. A second tab (or a retry) can receive the same `conflicts` array
          // after the first tab already deleted the queue row; it must not write a
          // duplicate draft, nor re-apply the server payload over local edits made
          // since. Match on `clientMutationId` — the wire key the response carries —
          // not `q.id`, which is the Dexie primary key used only for the delete above.
          const drainedMutationIds = new Set(
            conflictQueueItems.map((q) => q.clientMutationId)
          );

          for (const conflict of pushResponse.conflicts) {
            if (!drainedMutationIds.has(conflict.clientMutationId)) {
              continue;
            }

            const matchingMutation = mutationsByClientMutationId.get(conflict.clientMutationId);
            const localDoc = await db.documentContents.get(conflict.entityId);
            const serverPayload = (conflict.serverPayload ?? {}) as {
              title?: string;
              content?: string;
              updatedAt?: string;
            };

            const localContent =
              localDoc?.content ??
              (matchingMutation?.payload as { content?: string } | undefined)?.content ??
              '';
            const serverContent = serverPayload.content ?? '';

            if (localContent.trim() === serverContent.trim()) {
              if (localDoc) {
                await db.documentContents.put({
                  ...localDoc,
                  version: conflict.serverVersion,
                });
              } else if (serverPayload.content !== undefined) {
                await db.documentContents.put({
                  documentId: conflict.entityId,
                  title: serverPayload.title ?? '',
                  content: serverPayload.content ?? '',
                  updatedAt: serverPayload.updatedAt ?? new Date().toISOString(),
                  version: conflict.serverVersion,
                });
              }
              await db.conflictDrafts.where('documentId').equals(conflict.entityId).delete();
              continue;
            }

            const existingDraft = await db.conflictDrafts
              .where('documentId')
              .equals(conflict.entityId)
              .first();

            if (existingDraft) {
              await db.conflictDrafts.put({
                ...existingDraft,
                serverVersion: conflict.serverVersion,
                serverContent,
              });
            } else {
              const draft: ConflictDraft = {
                id: crypto.randomUUID(),
                documentId: conflict.entityId,
                baseVersion: matchingMutation?.baseVersion ?? 0,
                serverVersion: conflict.serverVersion,
                localContent,
                serverContent,
                createdAt: new Date().toISOString(),
              };
              await db.conflictDrafts.put(draft);
            }

            if (serverPayload.content !== undefined) {
              await db.documentContents.put({
                documentId: conflict.entityId,
                title: serverPayload.title ?? localDoc?.title ?? '',
                content: serverPayload.content ?? '',
                updatedAt: serverPayload.updatedAt ?? new Date().toISOString(),
                version: conflict.serverVersion,
              });
            }
          }
        }

        if (pushResponse.rejected && pushResponse.rejected.length > 0) {
          const rejectedMap = new Map(pushResponse.rejected.map((r) => [r.clientMutationId, r]));
          const rejectedMutationIds = pushResponse.rejected.map((r) => r.clientMutationId);
          const queueItems = await db.syncQueue
            .where('clientMutationId')
            .anyOf(rejectedMutationIds)
            .toArray();

          const updatedQueueItems = queueItems.map((item) => {
            const rejected = rejectedMap.get(item.clientMutationId);
            return {
              ...item,
              status: 'failed' as const,
              retryCount: item.retryCount + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: rejected?.reason,
            };
          });

          if (updatedQueueItems.length > 0) {
            await db.syncQueue.bulkPut(updatedQueueItems);
          }
        }

        const stateKey = createSyncStateKey(userId, deviceId);
        const existingState = await db.syncState.get(stateKey);
        const now = new Date().toISOString();

        if (existingState) {
          await db.syncState.put({
            ...existingState,
            lastSyncedAt: now,
          });
        } else {
          await db.syncState.put({
            key: stateKey,
            userId,
            deviceId,
            lastServerCursor: 0,
            lastSyncedAt: now,
          });
        }

        return {
          acceptedCount: pushResponse.accepted.length,
          conflictCount: pushResponse.conflicts.length,
        };
      }
    );
  }
}

export const dexieSyncReconciler = new DexieSyncReconciler();
