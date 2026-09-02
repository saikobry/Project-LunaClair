import type { DocumentSyncPayload } from '../models/SyncEntities';
import type { ConflictDraft, EntityVersion, SyncMutation, SyncQueueItem } from '../models/sync.types';

export interface LocalDocumentState {
  documentId: string;
  title?: string;
  content: string;
  updatedAt?: string;
  version?: EntityVersion;
}

export type DocumentReconcileResult =
  | {
      kind: 'apply';
      document: DocumentSyncPayload;
    }
  | {
      kind: 'compatible';
      reason?: string;
    }
  | {
      kind: 'conflict';
      draft: ConflictDraft;
      canonicalServerDoc: DocumentSyncPayload;
    };

/**
 * Pure domain reconciler for versioned documents (Model C).
 *
 * Compares incoming remote document state against local document state and unpushed outbox mutations.
 *
 * Rules:
 * 1. If local is clean (no unpushed mutation) -> applies remote document.
 * 2. If unpushed mutation has identical content to remote -> applies remote document.
 * 3. If unpushed mutation exists with baseVersion === remote.version -> compatible (preserves local unpushed draft).
 * 4. If unpushed mutation exists with baseVersion !== remote.version -> divergence conflict (branches ConflictDraft, canonical server wins).
 */
export function reconcileDocument(
  local: LocalDocumentState | null | undefined,
  remote: DocumentSyncPayload,
  unpushedMutation?: SyncQueueItem<unknown> | SyncMutation<unknown> | null
): DocumentReconcileResult {
  // Case 1: Clean local state (no pending unpushed outbox mutations)
  if (!unpushedMutation) {
    return {
      kind: 'apply',
      document: remote,
    };
  }

  const unpushedPayload = unpushedMutation.payload as { content?: string; title?: string } | undefined;
  const localContent = local?.content ?? unpushedPayload?.content ?? '';

  // Case 2: Identical content despite pending mutation
  if (localContent === remote.content) {
    return {
      kind: 'apply',
      document: remote,
    };
  }

  const baseVersion = unpushedMutation.baseVersion ?? 0;

  // Case 3: Unpushed mutation matches remote base version (compatible branch)
  if (baseVersion === remote.version) {
    return {
      kind: 'compatible',
      reason: 'Unpushed mutation is based on current server version',
    };
  }

  // Case 4: Base version divergence -> Conflict draft snapshot branched
  const draft: ConflictDraft = {
    id: crypto.randomUUID(),
    documentId: remote.documentId,
    baseVersion,
    serverVersion: remote.version,
    localContent,
    serverContent: remote.content,
    createdAt: new Date().toISOString(),
  };

  return {
    kind: 'conflict',
    draft,
    canonicalServerDoc: remote,
  };
}
