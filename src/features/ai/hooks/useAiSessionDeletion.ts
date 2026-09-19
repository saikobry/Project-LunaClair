import { useCallback, useState } from 'react';
import type { AiThread } from '../../../domain/ai/models/ai.types';
import {
  buildAiDeletionDialogCopy,
  type AiDeletionDialogCopy,
  type PendingAiDeletion,
} from '../utils/deletionDialogCopy';

export interface UseAiSessionDeletionOptions {
  /** Sessions in scope, used to name the conversation being deleted. */
  sessions: AiThread[];
  deleteSession: (threadId: string) => Promise<void>;
  /** Deletes every session in scope. */
  clearHistory: () => Promise<void>;
  /** Called after a scope-wide deletion, which also hands the panel back to the transcript. */
  onCleared: () => void;
}

export interface UseAiSessionDeletionResult {
  /** The action awaiting confirmation, or null when nothing is pending. */
  pendingDeletion: PendingAiDeletion | null;
  /**
   * Copy for the confirmation dialog, composed only while an action is pending. Doubles as the
   * dialog's visibility flag, so there is no second "is it open" boolean to keep in step.
   */
  dialogCopy: AiDeletionDialogCopy | null;
  requestClearAll: () => void;
  requestDeleteSession: (threadId: string) => void;
  confirmDeletion: () => Promise<void>;
  cancelDeletion: () => void;
}

/**
 * Two-step deletion of AI conversations: request, then confirm.
 *
 * Neither deletion path touches the transcript's in-memory turn list — `deleteSession` and
 * `clearHistory` already re-resolve which session the drawer shows — so this hook owns only the
 * pending action and its copy.
 */
export function useAiSessionDeletion({
  sessions,
  deleteSession,
  clearHistory,
  onCleared,
}: UseAiSessionDeletionOptions): UseAiSessionDeletionResult {
  const [pendingDeletion, setPendingDeletion] = useState<PendingAiDeletion | null>(null);

  const requestClearAll = useCallback(() => setPendingDeletion({ kind: 'all' }), []);

  const requestDeleteSession = useCallback(
    (threadId: string) => {
      const target = sessions.find((session) => session.id === threadId);
      setPendingDeletion({
        kind: 'session',
        threadId,
        title: target?.title ?? 'this conversation',
      });
    },
    [sessions],
  );

  const cancelDeletion = useCallback(() => setPendingDeletion(null), []);

  const confirmDeletion = useCallback(async () => {
    // Clear first: the action must not be confirmable twice.
    const pending = pendingDeletion;
    setPendingDeletion(null);
    if (!pending) return;

    if (pending.kind === 'all') {
      await clearHistory();
      onCleared();
      return;
    }

    await deleteSession(pending.threadId);
  }, [pendingDeletion, clearHistory, deleteSession, onCleared]);

  return {
    pendingDeletion,
    dialogCopy: pendingDeletion ? buildAiDeletionDialogCopy(pendingDeletion) : null,
    requestClearAll,
    requestDeleteSession,
    confirmDeletion,
    cancelDeletion,
  };
}
