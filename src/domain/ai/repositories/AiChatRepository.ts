import type { AiMessageRecord, AiThread } from '../models/ai.types';

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
