import type { AiChatMessage, AiMessageRecord } from '../models/ai.types';

/**
 * Projects persisted conversation records into the messages a request may send.
 *
 * **One projection, two consumers.** The provider payload and the context meter's conversation count
 * both come from this function, so the meter can never count records the payload drops (which would
 * overstate the next request and block a send that would have fit).
 *
 * Three exclusions, each answering a real record the transcript can hold:
 *
 * - **`status: 'streaming'` placeholders** have no answer yet. A turn opens with one deliberately, so
 *   any interruption leaves one behind; it must never be sent as an empty assistant reply. (It is
 *   normally repaired to `'error'` by the recovery path on reopen — this is the defence for a path
 *   that reopened without recovering.)
 * - **An empty `status: 'error'` turn takes its user turn with it.** The pair is written so the
 *   failure stays visible and retryable, but a failed exchange is not history: re-sending it asks a
 *   question the model never answered and puts an empty assistant message in front of the prompt.
 * - **A `complete` turn with nothing in it** contributes nothing, so it is dropped on its own — its
 *   user turn is a question that is simply unanswered, which is a normal state.
 *
 * An error turn that *does* carry text is kept: the user saw that partial answer, and dropping it
 * would lose real continuity. That is a deliberate call, because the text represents an incomplete
 * reply rather than a finished one.
 */
export function projectRequestMessages(records: AiMessageRecord[]): AiChatMessage[] {
  const projected: AiChatMessage[] = [];
  /** The user turn still awaiting a partner, tracked so an empty failure can retract it. */
  let pendingUserId: string | null = null;

  for (const record of records) {
    if (record.role === 'user') {
      projected.push({
        id: record.id,
        role: 'user',
        content: record.content,
        createdAt: record.createdAt,
      });
      pendingUserId = record.id;
      continue;
    }

    // An unsettled placeholder is not an answer.
    if (record.status === 'streaming') continue;

    const hasContent = record.content.trim().length > 0;

    if (record.status === 'error' && !hasContent) {
      if (pendingUserId !== null) {
        const index = projected.findIndex((message) => message.id === pendingUserId);
        if (index !== -1) projected.splice(index, 1);
        pendingUserId = null;
      }
      continue;
    }

    if (!hasContent) continue;

    projected.push({
      id: record.id,
      role: 'assistant',
      content: record.content,
      createdAt: record.createdAt,
    });
    pendingUserId = null;
  }

  return projected;
}
