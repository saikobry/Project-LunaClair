import type { SyncQueueItem, SyncStatus } from '../models/sync.types';

export interface SyncQueueRepository {
  /**
   * Persists a new mutation to the persistent outbox queue.
   */
  enqueue(item: SyncQueueItem): Promise<void>;

  /**
   * Returns up to `limit` pending outbox mutations ordered chronologically by createdAt.
   */
  peekPending(limit: number): Promise<SyncQueueItem[]>;

  /**
   * Updates the status and diagnostic attempt metadata for a specific queue item.
   */
  updateStatus(
    id: string,
    status: SyncStatus,
    metadata?: { lastAttemptAt?: string; lastError?: string }
  ): Promise<void>;

  /**
   * Removes a processed or discarded mutation from the queue.
   */
  remove(id: string): Promise<void>;

  /**
   * Returns the count of pending outbox mutations awaiting synchronization.
   */
  countPending(): Promise<number>;
}
