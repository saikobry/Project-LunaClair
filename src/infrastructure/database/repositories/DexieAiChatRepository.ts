import Dexie from 'dexie';
import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type {
  AiMessageRecord,
  AiThread,
} from '../../../domain/ai/models/ai.types';
import { db, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Concrete Dexie implementation of AiChatRepository.
 *
 * Provides local-first persistence for conversation threads and messages,
 * ensuring all chat history stays within IndexedDB on the user's device.
 */
export class DexieAiChatRepository implements AiChatRepository {
  private readonly database: LunaClairDatabase;

  constructor(database: LunaClairDatabase = db) {
    this.database = database;
  }

  async getThread(threadId: string): Promise<AiThread | null> {
    const thread = await this.database.aiThreads.get(threadId);
    return thread ?? null;
  }

  async listThreads(materialId?: string): Promise<AiThread[]> {
    if (materialId !== undefined) {
      // `[materialId+updatedAt]` reversed is exactly the order the previous in-memory sort
      // produced, without materialising the whole set first.
      return this.database.aiThreads
        .where('[materialId+updatedAt]')
        .between([materialId, Dexie.minKey], [materialId, Dexie.maxKey])
        .reverse()
        .toArray();
    }

    // Global threads carry no `materialId`, and a Dexie index skips records whose key is
    // `undefined` — so they are unreachable through the compound and stay a scan plus in-memory
    // order. They are also few by construction (the global assistant's own sessions).
    const threads = await this.database.aiThreads
      .filter((t) => t.materialId === undefined)
      .toArray();

    return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findLatestThread(materialId?: string): Promise<AiThread | null> {
    if (materialId !== undefined) {
      // The compound index already orders by `updatedAt`, so the newest session is the last row.
      const threads = await this.database.aiThreads
        .where('[materialId+updatedAt]')
        .between([materialId, Dexie.minKey], [materialId, Dexie.maxKey])
        .toArray();

      return threads[threads.length - 1] ?? null;
    }

    const threads = await this.database.aiThreads
      .filter((t) => t.materialId === undefined)
      .toArray();

    if (threads.length === 0) return null;
    threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return threads[0] ?? null;
  }

  async saveThread(thread: AiThread): Promise<void> {
    await this.database.aiThreads.put(thread);
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.aiThreads, this.database.aiMessages], async () => {
      await this.database.aiMessages.where('threadId').equals(threadId).delete();
      await this.database.aiThreads.delete(threadId);
    });
  }

  async getMessages(threadId: string): Promise<AiMessageRecord[]> {
    // Same order as `where('threadId').equals(id).sortBy('createdAt')`, without the in-memory sort.
    // The whole thread is still returned — the port's contract is an array, so this is not
    // virtualized streaming; a paged/cursor read would be a port change, not an index change.
    return this.database.aiMessages
      .where('[threadId+createdAt]')
      .between([threadId, Dexie.minKey], [threadId, Dexie.maxKey])
      .toArray();
  }

  async saveMessage(message: AiMessageRecord): Promise<void> {
    await this.database.transaction('rw', [this.database.aiMessages, this.database.aiThreads], async () => {
      await this.database.aiMessages.put(message);
      const thread = await this.database.aiThreads.get(message.threadId);
      if (thread) {
        await this.database.aiThreads.update(thread.id, { updatedAt: message.createdAt });
      }
    });
  }

  async saveMessagesBatch(messages: AiMessageRecord[]): Promise<void> {
    if (messages.length === 0) return;
    await this.database.aiMessages.bulkPut(messages);
  }

  async clearMaterialThreads(materialId: string): Promise<void> {
    await this.database.transaction('rw', [this.database.aiThreads, this.database.aiMessages], async () => {
      const threads = await this.database.aiThreads
        .where('materialId')
        .equals(materialId)
        .toArray();
      const threadIds = threads.map((t) => t.id);

      if (threadIds.length > 0) {
        await this.database.aiMessages.where('threadId').anyOf(threadIds).delete();
        await this.database.aiThreads.where('id').anyOf(threadIds).delete();
      }
    });
  }

  async clearAllThreads(): Promise<void> {
    await this.database.transaction('rw', [this.database.aiThreads, this.database.aiMessages], async () => {
      await this.database.aiMessages.clear();
      await this.database.aiThreads.clear();
    });
  }

  async recoverInterruptedMessages(): Promise<number> {
    return this.database.transaction('rw', this.database.aiMessages, async () => {
      const streaming = await this.database.aiMessages
        .where('status')
        .equals('streaming')
        .toArray();

      if (streaming.length === 0) return 0;

      const updatedMessages = streaming.map((msg) => ({
        ...msg,
        status: 'error' as const,
        metadata: {
          ...msg.metadata,
          errorCode: 'INTERRUPTED',
          errorMessage: 'Generation was interrupted.',
        },
      }));

      await this.database.aiMessages.bulkPut(updatedMessages);
      return streaming.length;
    });
  }
}

/** Singleton instance of DexieAiChatRepository */
export const dexieAiChatRepository = new DexieAiChatRepository();
