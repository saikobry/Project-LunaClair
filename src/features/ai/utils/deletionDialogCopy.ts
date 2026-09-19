/**
 * What a destructive AI-history action is about to remove.
 *
 * Vocabulary follows the repo-wide removal rules: AI conversations are **deleted** (device-local,
 * unrecoverable) rather than "removed", which is reserved for library materials whose published
 * share survives.
 */
export type PendingAiDeletion = { kind: 'all' } | { kind: 'session'; threadId: string; title: string };

export interface AiDeletionDialogCopy {
  title: string;
  message: string;
  confirmLabel: string;
}

/**
 * Copy for the confirmation dialog, naming what is deleted and what cannot be recovered.
 */
export function buildAiDeletionDialogCopy(pending: PendingAiDeletion): AiDeletionDialogCopy {
  if (pending.kind === 'all') {
    return {
      title: 'Delete every conversation?',
      message:
        'All conversations for this material will be removed from this device and cannot be recovered.',
      confirmLabel: 'Delete all',
    };
  }

  return {
    title: 'Delete this conversation?',
    message: `“${pending.title}” will be removed from this device and cannot be recovered.`,
    confirmLabel: 'Delete',
  };
}
