import type { AiGroundingMode, AiMessageRecord, AiThread } from '../models/ai.types';

/**
 * Domain port for local-first AI thread and message persistence.
 *
 * All implementations must guarantee 100% local persistence (e.g. Dexie IndexedDB)
 * without sending conversation history to cloud servers.
 */
export interface AiChatRepository {
  /**
   * Retrieves a single thread by its unique ID.
   */
  getThread(threadId: string): Promise<AiThread | null>;

  /**
   * Lists all conversation sessions for a given material, or all global sessions
   * if materialId is undefined. Results ordered by updatedAt descending.
   */
  listThreads(materialId?: string): Promise<AiThread[]>;

  /**
   * Finds the most recently updated session in a given scope (materialId, or the
   * global assistant when materialId is undefined). Returns null when the scope
   * has no sessions yet.
   */
  findLatestThread(materialId?: string): Promise<AiThread | null>;

  /**
   * Persists or updates a thread record.
   */
  saveThread(thread: AiThread): Promise<void>;

  /**
   * Updates only a thread's grounding mode.
   *
   * A partial write by contract: reading the thread and re-saving the whole object would let a
   * concurrent title or `updatedAt` write be clobbered by a stale copy. Deliberately does not touch
   * `updatedAt` — recency tracks conversation activity, and settings changes must not reorder history
   * (the same rule `RenameAiThreadUseCase` follows).
   */
  setGrounding(threadId: string, grounding: AiGroundingMode): Promise<void>;

  /**
   * Updates only a thread's title, for the same partial-write reason as `setGrounding`: a rename that
   * reads a thread and re-saves the whole object can revert a grounding toggle that landed in
   * between. Deliberately does not touch `updatedAt` — renaming must not reorder history.
   */
  setTitle(threadId: string, title: string): Promise<void>;

  /**
   * Deletes a thread and cascades deletion of all its associated messages.
   */
  deleteThread(threadId: string): Promise<void>;

  /**
   * Retrieves all chronological messages for a thread.
   */
  getMessages(threadId: string): Promise<AiMessageRecord[]>;

  /**
   * Persists a single message record.
   */
  saveMessage(message: AiMessageRecord): Promise<void>;

  /**
   * Persists a batch of message records.
   */
  saveMessagesBatch(messages: AiMessageRecord[]): Promise<void>;

  /**
   * Persists a user turn and its assistant partner atomically, bumping the thread's `updatedAt`.
   *
   * The pair is opened together so no interruption can leave a user turn with no partner. Callers
   * open a turn with an assistant placeholder in `'streaming'` status and settle it afterwards;
   * `recoverInterruptedMessages` repairs any placeholder left behind.
   *
   * Implementations must reject (and roll back) when the parent thread no longer exists, so a thread
   * deleted between resolution and this write cannot leave orphaned history behind.
   */
  saveMessagePair(
    userMessage: AiMessageRecord,
    assistantMessage: AiMessageRecord,
  ): Promise<void>;

  /**
   * Clears all threads and messages for a specific material.
   */
  clearMaterialThreads(materialId: string): Promise<void>;

  /**
   * Clears all threads and messages across the entire application.
   */
  clearAllThreads(): Promise<void>;

  /**
   * Recovers any orphaned messages left in 'streaming' status after a reload or interruption,
   * transitioning them to 'error' with errorCode: 'INTERRUPTED'.
   */
  recoverInterruptedMessages(): Promise<number>;
}
