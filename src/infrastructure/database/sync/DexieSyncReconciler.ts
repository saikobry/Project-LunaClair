import { db as defaultDb, type LunaClairDatabase, type HighlightRecord } from '../LunaClairDatabase';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import { createSyncStateKey } from '../../../domain/sync/utils/syncIdentity';
import { compareLwwTimestamps } from '../../../domain/sync/utils/syncVersioning';
import { reconcileDocument, reconcileTimestampLww, reconcileFlashcardReview, reconcileQuizSession } from '../../../domain/sync/reconcilers';
import type { DocumentSyncPayload, HighlightSyncPayload, DrawingSyncPayload, FlashcardReviewSyncPayload, QuizSessionSyncPayload } from '../../../domain/sync/models/SyncEntities';
import type { ConflictDraft, SyncQueueItem } from '../../../domain/sync/models/sync.types';
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse } from '../../../domain/sync/services/SyncTransport';
import type { SyncReconciler, ReconcilePullResult, ApplyPushResult } from '../../../domain/sync/services/SyncReconciler';

export type { ReconcilePullResult, ApplyPushResult };

/**
 * Transactional sync reconciler for Dexie / IndexedDB.
 *
 * Coordinates atomic batch pull reconciliation and push outcome application
 * across local database tables, outbox mutations, and conflict draft records.
 */
export class DexieSyncReconciler implements SyncReconciler {
  private readonly db: LunaClairDatabase;

  constructor(database: LunaClairDatabase = defaultDb) {
    this.db = database;
  }

  /**
   * Reconciles a server pull response batch into Dexie within a single read-write transaction.
   *
   * Transaction scope:
   * - `documentContents`
   * - `highlights`
   * - `drawings`
   * - `flashcardReviews`
   * - `quizSessions`
   * - `syncState`
   * - `conflictDrafts`
   * - `syncQueue`
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
    let pullResponse: SyncPullResponse;

    if (typeof dbOrUserId === 'string') {
      db = this.db;
      userId = dbOrUserId;
      deviceId = userIdOrDeviceId!;
      pullResponse = currentCursorOrPullResponse as SyncPullResponse;
    } else {
      db = dbOrUserId;
      userId = userIdOrDeviceId!;
      deviceId = deviceIdOrCurrentCursor as string;
      pullResponse = maybePullResponse!;
    }
    return await db.transaction(
      'rw',
      [
        db.documentContents,
        db.highlights,
        db.drawings,
        db.flashcardReviews,
        db.quizSessions,
        db.syncState,
        db.conflictDrafts,
        db.syncQueue,
      ],
      async () => {
        let appliedCount = 0;
        let conflictCount = 0;

        for (const change of pullResponse.changes) {
          const { entityType, entityId, operation, changedAt } = change;

          // 1. Versioned Documents (Model C)
          if (entityType === 'document') {
            const localDoc = await db.documentContents.get(entityId);
            const unpushedQueueItem = await db.syncQueue
              .where('entityType')
              .equals('document')
              .filter((q) => q.entityId === entityId && q.status === 'pending')
              .first();

            const remoteData = (change.data ?? {}) as Partial<DocumentSyncPayload>;
            const remoteDoc: DocumentSyncPayload = {
              documentId: entityId,
              title: remoteData.title ?? '',
              content: remoteData.content ?? '',
              updatedAt: changedAt || remoteData.updatedAt || new Date().toISOString(),
              version: change.version ?? remoteData.version ?? 1,
            };

            if (operation === 'DELETE' || (change.data as { deletedAt?: string } | null)?.deletedAt) {
              if (!unpushedQueueItem) {
                await db.documentContents.delete(entityId);
                appliedCount++;
              } else {
                const unpushedBase = unpushedQueueItem.baseVersion ?? 0;
                if (unpushedBase !== remoteDoc.version) {
                  const draft: ConflictDraft = {
                    id: crypto.randomUUID(),
                    documentId: entityId,
                    baseVersion: unpushedBase,
                    serverVersion: remoteDoc.version,
                    localContent: localDoc?.content ?? (unpushedQueueItem.payload as { content?: string })?.content ?? '',
                    serverContent: '',
                    createdAt: new Date().toISOString(),
                  };
                  await db.conflictDrafts.put(draft);
                  await db.documentContents.delete(entityId);
                  await db.syncQueue.delete(unpushedQueueItem.id);
                  conflictCount++;
                }
              }
            } else {
              const result = reconcileDocument(
                localDoc,
                remoteDoc,
                unpushedQueueItem as SyncQueueItem<Partial<DocumentSyncPayload>> | undefined
              );
              if (result.kind === 'apply') {
                await db.documentContents.put({
                  documentId: entityId,
                  title: result.document.title,
                  content: result.document.content,
                  updatedAt: result.document.updatedAt,
                });
                appliedCount++;
              } else if (result.kind === 'conflict') {
                await db.conflictDrafts.put(result.draft);
                await db.documentContents.put({
                  documentId: entityId,
                  title: result.canonicalServerDoc.title,
                  content: result.canonicalServerDoc.content,
                  updatedAt: result.canonicalServerDoc.updatedAt,
                });
                if (unpushedQueueItem) {
                  await db.syncQueue.delete(unpushedQueueItem.id);
                }
                conflictCount++;
              }
              // If 'compatible', local unpushed mutation remains in syncQueue and local draft untouched
            }
          }

          // 2. Highlights (Model A - LWW)
          else if (entityType === 'highlight') {
            const localHighlight = await db.highlights.get(entityId);
            if (operation === 'DELETE' || !change.data) {
              if (localHighlight) {
                const localTime = localHighlight.deletedAt ?? (localHighlight as { updatedAt?: string }).updatedAt ?? localHighlight.createdAt;
                if (compareLwwTimestamps(localTime, changedAt) === 'remote_wins') {
                  await db.highlights.delete(entityId);
                  appliedCount++;
                }
              } else {
                await db.highlights.delete(entityId);
                appliedCount++;
              }
            } else {
              const remotePayload = change.data as HighlightSyncPayload;
              const result = reconcileTimestampLww(localHighlight, remotePayload);
              if (result.kind === 'apply') {
                const payload = result.payload;
                if (payload.deletedAt) {
                  await db.highlights.delete(entityId);
                } else {
                  await db.highlights.put({
                    id: payload.id || entityId,
                    documentId: payload.documentId,
                    start: payload.start,
                    end: payload.end,
                    color: payload.color as HighlightRecord['color'],
                    text: payload.text,
                    createdAt: payload.createdAt,
                    ...(payload.deletedAt ? { deletedAt: payload.deletedAt } : {}),
                  });
                }
                appliedCount++;
              }
            }
          }

          // 3. Drawings (Model A - LWW)
          else if (entityType === 'drawing') {
            const localDrawing = await db.drawings.get(entityId);
            if (operation === 'DELETE' || !change.data) {
              if (localDrawing) {
                const localTime = localDrawing.deletedAt ?? (localDrawing as { updatedAt?: string }).updatedAt ?? localDrawing.createdAt;
                if (compareLwwTimestamps(localTime, changedAt) === 'remote_wins') {
                  await db.drawings.delete(entityId);
                  appliedCount++;
                }
              } else {
                await db.drawings.delete(entityId);
                appliedCount++;
              }
            } else {
              const remotePayload = change.data as DrawingSyncPayload;
              const result = reconcileTimestampLww(localDrawing, remotePayload);
              if (result.kind === 'apply') {
                const payload = result.payload;
                if (payload.deletedAt) {
                  await db.drawings.delete(entityId);
                } else {
                  await db.drawings.put({
                    id: payload.id || entityId,
                    documentId: payload.documentId,
                    color: payload.color,
                    thickness: payload.thickness,
                    points: payload.points,
                    isEraser: payload.isEraser,
                    createdAt: payload.createdAt,
                    ...(payload.deletedAt ? { deletedAt: payload.deletedAt } : {}),
                  });
                }
                appliedCount++;
              }
            }
          }

          // 4. Flashcard Reviews (Model A - Spaced Repetition LWW)
          else if (entityType === 'flashcardReview') {
            const localReview = await db.flashcardReviews.get(entityId);
            if (operation === 'DELETE' || !change.data) {
              if (localReview) {
                await db.flashcardReviews.delete(entityId);
                appliedCount++;
              }
            } else {
              const remotePayload = change.data as FlashcardReviewSyncPayload;
              const result = reconcileFlashcardReview(localReview, remotePayload);
              if (result.kind === 'apply') {
                await db.flashcardReviews.put(result.payload as ReviewState);
                appliedCount++;
              }
            }
          }

          // 5. Quiz Sessions (Model B - Append-Only)
          else if (entityType === 'quizSession') {
            const localSession = await db.quizSessions.get(entityId);
            if (change.data) {
              const remotePayload = change.data as QuizSessionSyncPayload;
              const result = reconcileQuizSession(localSession, remotePayload);
              if (result.kind === 'apply') {
                await db.quizSessions.put(result.payload as QuizSession);
                appliedCount++;
              }
            }
          }
        }

        // Commit updated checkpoint cursor and sync timestamp
        const now = new Date().toISOString();
        const stateKey = createSyncStateKey(userId, deviceId);
        await db.syncState.put({
          key: stateKey,
          userId,
          deviceId,
          lastServerCursor: pullResponse.newCursor,
          lastSyncedAt: now,
        });

        return {
          appliedCount,
          conflictCount,
          newCursor: pullResponse.newCursor,
        };
      }
    );
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
        // Pre-build index Map for O(1) matching mutation lookup
        const mutationsByClientMutationId = new Map(
          pushRequest.mutations.map((m) => [m.clientMutationId, m])
        );

        // 1. Process Accepted Mutations
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

        // 2. Process Divergence Conflicts
        if (pushResponse.conflicts.length > 0) {
          const conflictMutationIds = pushResponse.conflicts.map((c) => c.clientMutationId);
          const conflictQueueItems = await db.syncQueue
            .where('clientMutationId')
            .anyOf(conflictMutationIds)
            .toArray();

          if (conflictQueueItems.length > 0) {
            await db.syncQueue.bulkDelete(conflictQueueItems.map((q) => q.id));
          }

          for (const conflict of pushResponse.conflicts) {
            const matchingMutation = mutationsByClientMutationId.get(conflict.clientMutationId);
            const localDoc = await db.documentContents.get(conflict.entityId);
            const serverPayload = (conflict.serverPayload ?? {}) as Partial<DocumentSyncPayload>;

            const localContent =
              localDoc?.content ??
              (matchingMutation?.payload as { content?: string } | undefined)?.content ??
              '';

            const draft: ConflictDraft = {
              id: crypto.randomUUID(),
              documentId: conflict.entityId,
              baseVersion: matchingMutation?.baseVersion ?? 0,
              serverVersion: conflict.serverVersion,
              localContent,
              serverContent: serverPayload.content ?? '',
              createdAt: new Date().toISOString(),
            };

            await db.conflictDrafts.put(draft);

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

        // 3. Process Rejected Mutations (Mark status as failed)
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

        // 4. Update Sync State Checkpoint
        const stateKey = createSyncStateKey(userId, deviceId);
        const existingState = await db.syncState.get(stateKey);
        const now = new Date().toISOString();

        if (existingState) {
          await db.syncState.put({
            ...existingState,
            lastSyncedAt: now,
            ...(pushResponse.serverCursor
              ? { lastServerCursor: Math.max(existingState.lastServerCursor, pushResponse.serverCursor) }
              : {}),
          });
        } else {
          await db.syncState.put({
            key: stateKey,
            userId,
            deviceId,
            lastServerCursor: pushResponse.serverCursor ?? 0,
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
