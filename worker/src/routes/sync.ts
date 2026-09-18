/**
 * Cloud Sync Protocol Handler for LunaClair Worker.
 *
 * Implements:
 * - POST /api/sync/push: Ingest mutation envelopes with idempotency, optimistic CAS for versioned
 *   documents (Model C), LWW timestamp reconciliation (Model A), and append-only event streams (Model B).
 * - GET  /api/sync/pull: Cursor-based monotonic delta pull endpoint with batch entity resolution.
 */
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { pruneSyncIdempotency } from '../core/retention';
import type { Env, RouteContext } from '../core/types';
import {
  syncChanges,
  syncIdempotency,
  userDocuments,
  userEntities,
} from '../schema';

export type SyncModelType = 'versioned' | 'lww' | 'append';

export const SYNC_MODELS: Record<string, SyncModelType> = {
  document: 'versioned',
  highlight: 'lww',
  drawing: 'lww',
  flashcardReview: 'lww',
  quizSession: 'append',
};

export interface SyncMutation<T = unknown> {
  clientMutationId: string;
  entityType: string;
  entityId: string;
  operation: 'UPSERT' | 'DELETE' | 'APPEND';
  baseVersion?: number;
  clientTimestamp: string;
  payload: T;
}

export interface SyncPushRequest {
  deviceId: string;
  mutations: SyncMutation[];
}

export interface AcceptedMutation {
  clientMutationId: string;
  entityType: string;
  entityId: string;
  newVersion?: number;
}

export interface ConflictMutation {
  clientMutationId: string;
  entityType: string;
  entityId: string;
  serverVersion: number;
  serverPayload: unknown;
}

export interface RejectedMutation {
  clientMutationId: string;
  entityType: string;
  entityId: string;
  reason: string;
}

export interface SyncPushResponse {
  accepted: AcceptedMutation[];
  conflicts: ConflictMutation[];
  rejected: RejectedMutation[];
  serverCursor: number;
}

export interface SyncChangeItem {
  sequence: number;
  entityType: string;
  entityId: string;
  operation: string;
  version?: number;
  changedAt: string;
  data: unknown;
}

export interface SyncPullResponse {
  newCursor: number;
  hasMore: boolean;
  changes: SyncChangeItem[];
}

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

/**
 * Extracts userId from Authorization Bearer token (authoritative) or x-user-id header.
 * Derives userId from valid JWT claims (`sub` or `userId`) or token payload.
 * Defaults to 'user_default'.
 */
export function resolveUserId(request: Request): string {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const token = match[1].trim();
      if (token.includes('.')) {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const rawPayload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(rawPayload) as Record<string, unknown>;
            if (payload && typeof payload.sub === 'string' && payload.sub.trim().length > 0) {
              return payload.sub.trim();
            }
            if (payload && typeof payload.userId === 'string' && payload.userId.trim().length > 0) {
              return payload.userId.trim();
            }
          }
        } catch {
          // Token is not base64 JSON, continue to raw token string fallback
        }
      }
      if (token && token !== 'undefined' && token !== 'null') {
        return token;
      }
    }
  }

  const customHeaderUser = request.headers.get('x-user-id');
  if (customHeaderUser && customHeaderUser.trim().length > 0) {
    return customHeaderUser.trim();
  }

  return 'user_default';
}

/**
 * Handles POST /api/sync/push
 */
export async function handleSyncPush(
  ctxOrRequest: RouteContext | Request,
  maybeEnv?: Env,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const request = 'request' in ctxOrRequest ? ctxOrRequest.request : ctxOrRequest;
  const env = 'env' in ctxOrRequest ? ctxOrRequest.env : maybeEnv!;
  const corsHeaders = 'corsHeaders' in ctxOrRequest ? ctxOrRequest.corsHeaders : (maybeCorsHeaders ?? {});

  const userId = resolveUserId(request);
  const db = drizzle(env.DB);

  let body: SyncPushRequest;
  try {
    body = (await request.json()) as SyncPushRequest;
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400, corsHeaders);
  }

  if (!body || typeof body !== 'object') {
    return json({ error: 'Request body must be an object' }, 400, corsHeaders);
  }

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  if (!deviceId) {
    return json({ error: 'Missing or invalid deviceId' }, 400, corsHeaders);
  }

  if (!Array.isArray(body.mutations)) {
    return json({ error: 'Missing or invalid mutations array' }, 400, corsHeaders);
  }

  const accepted: AcceptedMutation[] = [];
  const conflicts: ConflictMutation[] = [];
  const rejected: RejectedMutation[] = [];

  for (const mutation of body.mutations) {
    if (!mutation || typeof mutation !== 'object') {
      continue;
    }

    const {
      clientMutationId,
      entityType,
      entityId,
      operation,
      baseVersion,
      clientTimestamp,
      payload,
    } = mutation;

    if (!clientMutationId || !entityType || !entityId || !operation) {
      rejected.push({
        clientMutationId: clientMutationId || 'unknown',
        entityType: entityType || 'unknown',
        entityId: entityId || 'unknown',
        reason: 'Missing required mutation fields (clientMutationId, entityType, entityId, operation)',
      });
      continue;
    }

    const model = SYNC_MODELS[entityType];
    if (!model) {
      rejected.push({
        clientMutationId,
        entityType,
        entityId,
        reason: `Unsupported entity type: ${entityType}`,
      });
      continue;
    }

    const now = new Date().toISOString();
    const timestamp = clientTimestamp || now;

    // 1. Idempotency Check
    const existingIdempotency = await db
      .select()
      .from(syncIdempotency)
      .where(eq(syncIdempotency.clientMutationId, clientMutationId))
      .get();

    if (existingIdempotency) {
      if (model === 'versioned') {
        const doc = await db
          .select({ version: userDocuments.version })
          .from(userDocuments)
          .where(
            and(
              eq(userDocuments.userId, userId),
              eq(userDocuments.documentId, entityId),
            ),
          )
          .get();

        accepted.push({
          clientMutationId,
          entityType,
          entityId,
          newVersion: doc?.version ?? baseVersion ?? 1,
        });
      } else {
        accepted.push({
          clientMutationId,
          entityType,
          entityId,
        });
      }
      continue;
    }

    // 2. Document (Versioned - Model C)
    if (model === 'versioned') {
      const isCreate = baseVersion === undefined || baseVersion === 0;
      const docPayload = (payload ?? {}) as {
        title?: string;
        content?: string;
        deletedAt?: string | null;
      };
      const title = typeof docPayload.title === 'string' ? docPayload.title : '';
      const content = typeof docPayload.content === 'string' ? docPayload.content : '';
      const deletedAt = operation === 'DELETE' ? timestamp : (docPayload.deletedAt ?? null);

      if (isCreate) {
        const existingDoc = await db
          .select()
          .from(userDocuments)
          .where(
            and(
              eq(userDocuments.userId, userId),
              eq(userDocuments.documentId, entityId),
            ),
          )
          .get();

        if (existingDoc) {
          conflicts.push({
            clientMutationId,
            entityType,
            entityId,
            serverVersion: existingDoc.version,
            serverPayload: {
              title: existingDoc.title,
              content: existingDoc.content,
              updatedAt: existingDoc.updatedAt,
              deletedAt: existingDoc.deletedAt,
            },
          });
          continue;
        }

        // Insert initial document version
        await db.insert(userDocuments).values({
          userId,
          documentId: entityId,
          version: 1,
          title,
          content,
          updatedAt: timestamp,
          deletedAt,
        });

        await db.insert(syncChanges).values({
          userId,
          entityType,
          entityId,
          operation,
          version: 1,
          changedAt: timestamp,
        });

        await db.insert(syncIdempotency).values({
          clientMutationId,
          userId,
          deviceId,
          entityType,
          entityId,
          processedAt: now,
        });

        accepted.push({
          clientMutationId,
          entityType,
          entityId,
          newVersion: 1,
        });
      } else {
        // Atomic CAS update: only update if current version equals baseVersion
        const casResult = await env.DB.prepare(
          `UPDATE user_documents SET version = version + 1, title = ?, content = ?, updated_at = ?, deleted_at = ? WHERE user_id = ? AND document_id = ? AND version = ?`,
        )
          .bind(title, content, timestamp, deletedAt, userId, entityId, baseVersion)
          .run();

        const rowsAffected = casResult.meta?.changes ?? (casResult as unknown as { changes?: number }).changes ?? 0;

        if (rowsAffected === 1) {
          const nextVer = baseVersion + 1;
          await db.insert(syncChanges).values({
            userId,
            entityType,
            entityId,
            operation,
            version: nextVer,
            changedAt: timestamp,
          });

          await db.insert(syncIdempotency).values({
            clientMutationId,
            userId,
            deviceId,
            entityType,
            entityId,
            processedAt: now,
          });

          accepted.push({
            clientMutationId,
            entityType,
            entityId,
            newVersion: nextVer,
          });
        } else {
          // Version mismatch: fetch current server version and content
          const storedDoc = await db
            .select()
            .from(userDocuments)
            .where(
              and(
                eq(userDocuments.userId, userId),
                eq(userDocuments.documentId, entityId),
              ),
            )
            .get();

          if (storedDoc) {
            conflicts.push({
              clientMutationId,
              entityType,
              entityId,
              serverVersion: storedDoc.version,
              serverPayload: {
                title: storedDoc.title,
                content: storedDoc.content,
                updatedAt: storedDoc.updatedAt,
                deletedAt: storedDoc.deletedAt,
              },
            });
          } else {
            conflicts.push({
              clientMutationId,
              entityType,
              entityId,
              serverVersion: 0,
              serverPayload: null,
            });
          }
        }
      }
    }

    // 3. LWW Entities (highlight, drawing, flashcardReview - Model A)
    else if (model === 'lww') {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
      const deletedAt =
        operation === 'DELETE'
          ? timestamp
          : ((payload as Record<string, unknown> | undefined)?.deletedAt as string | null | undefined) ?? null;

      const existingEntity = await db
        .select()
        .from(userEntities)
        .where(
          and(
            eq(userEntities.userId, userId),
            eq(userEntities.entityType, entityType),
            eq(userEntities.entityId, entityId),
          ),
        )
        .get();

      if (existingEntity) {
        if (timestamp >= existingEntity.updatedAt) {
          // Incoming update is newer or equal: update row and record sync_changes
          await db
            .update(userEntities)
            .set({
              payload: payloadStr,
              updatedAt: timestamp,
              deletedAt,
            })
            .where(
              and(
                eq(userEntities.userId, userId),
                eq(userEntities.entityType, entityType),
                eq(userEntities.entityId, entityId),
              ),
            );

          await db.insert(syncChanges).values({
            userId,
            entityType,
            entityId,
            operation,
            version: null,
            changedAt: timestamp,
          });

          await db.insert(syncIdempotency).values({
            clientMutationId,
            userId,
            deviceId,
            entityType,
            entityId,
            processedAt: now,
          });

          accepted.push({
            clientMutationId,
            entityType,
            entityId,
          });
        } else {
          // Incoming update is older: ignore update and do not insert sync_changes
          // Record idempotency so retries don't re-evaluate
          await db.insert(syncIdempotency).values({
            clientMutationId,
            userId,
            deviceId,
            entityType,
            entityId,
            processedAt: now,
          });

          accepted.push({
            clientMutationId,
            entityType,
            entityId,
          });
        }
      } else {
        // First time insertion
        await db.insert(userEntities).values({
          userId,
          entityType,
          entityId,
          payload: payloadStr,
          updatedAt: timestamp,
          deletedAt,
        });

        await db.insert(syncChanges).values({
          userId,
          entityType,
          entityId,
          operation,
          version: null,
          changedAt: timestamp,
        });

        await db.insert(syncIdempotency).values({
          clientMutationId,
          userId,
          deviceId,
          entityType,
          entityId,
          processedAt: now,
        });

        accepted.push({
          clientMutationId,
          entityType,
          entityId,
        });
      }
    }

    // 4. Append Entities (quizSession - Model B)
    else if (model === 'append') {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});

      const existingEntity = await db
        .select()
        .from(userEntities)
        .where(
          and(
            eq(userEntities.userId, userId),
            eq(userEntities.entityType, entityType),
            eq(userEntities.entityId, entityId),
          ),
        )
        .get();

      if (existingEntity) {
        // PK conflict / duplicate append: ignore duplicate payload, ensure idempotency recorded
        await db
          .insert(syncIdempotency)
          .values({
            clientMutationId,
            userId,
            deviceId,
            entityType,
            entityId,
            processedAt: now,
          })
          .onConflictDoNothing();

        accepted.push({
          clientMutationId,
          entityType,
          entityId,
        });
      } else {
        await db.insert(userEntities).values({
          userId,
          entityType,
          entityId,
          payload: payloadStr,
          updatedAt: timestamp,
          deletedAt: null,
        });

        await db.insert(syncChanges).values({
          userId,
          entityType,
          entityId,
          operation: 'APPEND',
          version: null,
          changedAt: timestamp,
        });

        await db.insert(syncIdempotency).values({
          clientMutationId,
          userId,
          deviceId,
          entityType,
          entityId,
          processedAt: now,
        });

        accepted.push({
          clientMutationId,
          entityType,
          entityId,
        });
      }
    }
  }

  // Calculate current server sequence cursor for this user
  const maxSeqResult = await env.DB.prepare(
    `SELECT MAX(sequence) as lastSeq FROM sync_changes WHERE user_id = ?`,
  )
    .bind(userId)
    .first<{ lastSeq: number | null }>();

  const serverCursor = maxSeqResult?.lastSeq ?? 0;

  const responseBody: SyncPushResponse = {
    accepted,
    conflicts,
    rejected,
    serverCursor,
  };

  // Retention for the idempotency ledger rides the push path, because a push is the only traffic that
  // can add ledger rows — with no pushes there is nothing new to expire. Bounded to one batch per
  // push and skipped when this request processed nothing, so an empty-array push loop cannot turn
  // every request into a write. Best-effort: the mutations above are already committed, so a
  // retention failure must not become a client-visible error on an otherwise successful push.
  if (body.mutations.length > 0) {
    try {
      const pruned = await pruneSyncIdempotency(env.DB);
      // Only when it did something: a working retention policy should be visible in logs without
      // logging every push that found nothing to retire.
      if (pruned > 0) {
        console.log(`sync_idempotency pruned ${pruned} expired entries`);
      }
    } catch (error) {
      console.error('sync_idempotency prune failed:', error);
    }
  }

  return json(responseBody, 200, corsHeaders);
}

/**
 * Handles GET /api/sync/pull?cursor=...&limit=...
 */
export async function handleSyncPull(
  ctxOrRequest: RouteContext | Request,
  maybeEnv?: Env,
  maybeCorsHeaders?: Record<string, string>,
): Promise<Response> {
  const request = 'request' in ctxOrRequest ? ctxOrRequest.request : ctxOrRequest;
  const env = 'env' in ctxOrRequest ? ctxOrRequest.env : maybeEnv!;
  const corsHeaders = 'corsHeaders' in ctxOrRequest ? ctxOrRequest.corsHeaders : (maybeCorsHeaders ?? {});

  const userId = resolveUserId(request);
  const url = new URL(request.url);

  const rawCursor = url.searchParams.get('cursor');
  const parsedCursor = rawCursor !== null ? parseInt(rawCursor, 10) : 0;
  const cursor = Number.isInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;

  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = rawLimit !== null ? parseInt(rawLimit, 10) : 100;
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 500) : 100;

  // Query sync_changes for sequence > cursor with limit + 1 to detect hasMore
  const changeRowsResult = await env.DB.prepare(
    `SELECT sequence, user_id as userId, entity_type as entityType, entity_id as entityId, operation, version, changed_at as changedAt FROM sync_changes WHERE user_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?`,
  )
    .bind(userId, cursor, limit + 1)
    .all<{
      sequence: number;
      userId: string;
      entityType: string;
      entityId: string;
      operation: string;
      version: number | null;
      changedAt: string;
    }>();

  const changeRows = changeRowsResult.results ?? [];
  const hasMore = changeRows.length > limit;
  const batch = hasMore ? changeRows.slice(0, limit) : changeRows;

  if (batch.length === 0) {
    const emptyResponse: SyncPullResponse = {
      newCursor: cursor,
      hasMore: false,
      changes: [],
    };
    return json(emptyResponse, 200, corsHeaders);
  }

  // Collect distinct document IDs and entity keys for batch fetching
  const docIds = new Set<string>();
  const entityKeys = new Set<string>();

  for (const change of batch) {
    if (change.entityType === 'document') {
      docIds.add(change.entityId);
    } else {
      entityKeys.add(`${change.entityType}:::${change.entityId}`);
    }
  }

  // Batch query user_documents
  const docMap = new Map<
    string,
    {
      title: string;
      content: string;
      updatedAt: string;
      deletedAt: string | null;
      version: number;
    }
  >();

  if (docIds.size > 0) {
    const docIdList = Array.from(docIds);
    const placeholders = docIdList.map(() => '?').join(',');
    const docsResult = await env.DB.prepare(
      `SELECT document_id as documentId, title, content, updated_at as updatedAt, deleted_at as deletedAt, version FROM user_documents WHERE user_id = ? AND document_id IN (${placeholders})`,
    )
      .bind(userId, ...docIdList)
      .all<{
        documentId: string;
        title: string;
        content: string;
        updatedAt: string;
        deletedAt: string | null;
        version: number;
      }>();

    for (const doc of docsResult.results ?? []) {
      docMap.set(doc.documentId, doc);
    }
  }

  // Batch query user_entities
  const entityMap = new Map<
    string,
    {
      payload: string;
      updatedAt: string;
      deletedAt: string | null;
    }
  >();

  if (entityKeys.size > 0) {
    // Hydrate only the referenced (entity_type, entity_id) pairs in bounded chunks
    // instead of slurping every entity for the user; each chunk keeps the WHERE
    // clause well under SQLite's bound-parameter limit (1 + 2 per pair).
    const ENTITY_CHUNK_SIZE = 100;
    const entityPairs = Array.from(entityKeys).map((key) => {
      const separatorIndex = key.indexOf(':::');
      return {
        entityType: key.slice(0, separatorIndex),
        entityId: key.slice(separatorIndex + 3),
      };
    });

    for (let i = 0; i < entityPairs.length; i += ENTITY_CHUNK_SIZE) {
      const chunk = entityPairs.slice(i, i + ENTITY_CHUNK_SIZE);
      const pairConditions = chunk.map(() => '(entity_type = ? AND entity_id = ?)').join(' OR ');
      const chunkResult = await env.DB.prepare(
        `SELECT entity_type as entityType, entity_id as entityId, payload, updated_at as updatedAt, deleted_at as deletedAt FROM user_entities WHERE user_id = ? AND (${pairConditions})`,
      )
        .bind(userId, ...chunk.flatMap((pair) => [pair.entityType, pair.entityId]))
        .all<{
          entityType: string;
          entityId: string;
          payload: string;
          updatedAt: string;
          deletedAt: string | null;
        }>();

      for (const ent of chunkResult.results ?? []) {
        entityMap.set(`${ent.entityType}:::${ent.entityId}`, ent);
      }
    }
  }

  // Assemble sync change payload items
  const changes: SyncChangeItem[] = batch.map((change) => {
    let data: unknown = null;

    if (change.operation === 'DELETE') {
      data = null;
    } else if (change.entityType === 'document') {
      const doc = docMap.get(change.entityId);
      if (doc && !doc.deletedAt) {
        data = {
          title: doc.title,
          content: doc.content,
          updatedAt: doc.updatedAt,
          deletedAt: doc.deletedAt ?? undefined,
        };
      } else {
        data = null;
      }
    } else {
      const entity = entityMap.get(`${change.entityType}:::${change.entityId}`);
      if (entity && !entity.deletedAt) {
        try {
          data = JSON.parse(entity.payload);
        } catch {
          data = entity.payload;
        }
      } else {
        data = null;
      }
    }

    return {
      sequence: change.sequence,
      entityType: change.entityType,
      entityId: change.entityId,
      operation: change.operation,
      version: change.version ?? undefined,
      changedAt: change.changedAt,
      data,
    };
  });

  const newCursor = batch[batch.length - 1].sequence;

  const pullResponse: SyncPullResponse = {
    newCursor,
    hasMore,
    changes,
  };

  return json(pullResponse, 200, corsHeaders);
}
