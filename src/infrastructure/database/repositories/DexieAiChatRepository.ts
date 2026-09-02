import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type {
  AiMessageRecord,
  AiThread,
  AiTutorMode,
} from '../../../domain/ai/models/ai.types';
import { db, type LunaClairDatabase } from '../LunaClairDatabase';

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
    let threads: AiThread[];
    if (materialId !== undefined) {
      threads = await this.database.aiThreads
        .where('materialId')
        .equals(materialId)
        .toArray();
    } else {
      threads = await this.database.aiThreads
        .filter((t) => t.materialId === undefined)
        .toArray();
    }

    return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findLatestThread(
    materialId: string | undefined,
    mode: AiTutorMode,
  ): Promise<AiThread | null> {
    let threads: AiThread[];
    if (materialId !== undefined) {
      threads = await this.database.aiThreads
        .where('materialId')
        .equals(materialId)
        .filter((t) => t.mode === mode)
        .toArray();
    } else {
      threads = await this.database.aiThreads
        .filter((t) => t.materialId === undefined && t.mode === mode)
        .toArray();
    }

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
    return this.database.aiMessages.where('threadId').equals(threadId).sortBy('createdAt');
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
