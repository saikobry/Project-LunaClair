import Dexie from 'dexie';
import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type {
  AiGroundingMode,
  AiMessageRecord,
  AiThread,
} from '../../../domain/ai/models/ai.types';
import { db, type AiThreadRow, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Concrete Dexie implementation of AiChatRepository.
 *
 * Provides local-first persistence for conversation threads and messages,
 * ensuring all chat history stays within IndexedDB on the user's device.
 */
/**
 * Resolves a persisted row into the domain shape, normalizing its grounding mode.
 *
 * Scope-aware and validating on purpose: a global thread (`materialId === undefined`) can never be
 * grounded, whatever is on disk, so a stored `'whole'` is coerced rather than trusted. A
 * material-scoped row whose value is missing (written before grounding existed) or malformed falls
 * back to `'whole'`, so legacy conversations keep behaving exactly as they did — a preference the
 * user sets today must not retroactively change what a past conversation was.
 *
 * Deliberately side-effect free: it returns the safe value and never rewrites the row. Writing
 * during a read would introduce transaction and concurrency problems for no user benefit.
 */
function normalizeThreadRow(row: AiThreadRow): AiThread {
  if (row.materialId === undefined) {
    return { ...row, grounding: 'none' };
  }

  const grounding: AiGroundingMode =
    row.grounding === 'whole' || row.grounding === 'none' ? row.grounding : 'whole';

  return { ...row, grounding };
}

export class DexieAiChatRepository implements AiChatRepository {
  private readonly database: LunaClairDatabase;

  constructor(database: LunaClairDatabase = db) {
    this.database = database;
  }

  async getThread(threadId: string): Promise<AiThread | null> {
    const thread = await this.database.aiThreads.get(threadId);
    return thread ? normalizeThreadRow(thread) : null;
  }

  async listThreads(materialId?: string): Promise<AiThread[]> {
    if (materialId !== undefined) {
      // `[materialId+updatedAt]` reversed is exactly the order the previous in-memory sort
      // produced, without materialising the whole set first.
      const rows = await this.database.aiThreads
        .where('[materialId+updatedAt]')
        .between([materialId, Dexie.minKey], [materialId, Dexie.maxKey])
        .reverse()
        .toArray();

      return rows.map(normalizeThreadRow);
    }

    // Global threads carry no `materialId`, and a Dexie index skips records whose key is
    // `undefined` — so they are unreachable through the compound and stay a scan plus in-memory
    // order. They are also few by construction (the global assistant's own sessions).
    const threads = await this.database.aiThreads
      .filter((t) => t.materialId === undefined)
      .toArray();

    return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(normalizeThreadRow);
  }

  async findLatestThread(materialId?: string): Promise<AiThread | null> {
    if (materialId !== undefined) {
      // The compound index already orders by `updatedAt`, so the newest session is the last row.
      const threads = await this.database.aiThreads
        .where('[materialId+updatedAt]')
        .between([materialId, Dexie.minKey], [materialId, Dexie.maxKey])
        .toArray();

      const newest = threads[threads.length - 1];
      return newest ? normalizeThreadRow(newest) : null;
    }

    const threads = await this.database.aiThreads
      .filter((t) => t.materialId === undefined)
      .toArray();

    if (threads.length === 0) return null;
    threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const newest = threads[0];
    return newest ? normalizeThreadRow(newest) : null;
  }

  async saveThread(thread: AiThread): Promise<void> {
    await this.database.aiThreads.put(thread);
  }

  async setGrounding(threadId: string, grounding: AiGroundingMode): Promise<void> {
    // `update()` writes only the named field, so a concurrent title or recency write on the same
    // thread cannot be clobbered by a whole-object save of an earlier read. `updatedAt` is untouched
    // on purpose: a settings change must not reorder conversation history.
    await this.database.aiThreads.update(threadId, { grounding });
  }

  async setTitle(threadId: string, title: string): Promise<void> {
    // Same partial-write rule as `setGrounding`, and it exists for the same reason: renaming used to
    // read a thread and put the whole object back, so a grounding toggle landing in between was
    // silently reverted by the stale copy. `updatedAt` is untouched — renaming an old session must
    // not reorder history.
    await this.database.aiThreads.update(threadId, { title });
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

  async saveMessagePair(
    userMessage: AiMessageRecord,
    assistantMessage: AiMessageRecord,
  ): Promise<void> {
    // One transaction over both tables: a turn opens with its partner already present, so an
    // interruption can never strand a user record, and the recency bump commits with the pair.
    await this.database.transaction('rw', [this.database.aiMessages, this.database.aiThreads], async () => {
      // The parent is verified *inside* the transaction, so a thread deleted between the resolver's
      // read and this write rolls the pair back instead of orphaning history nothing can reach.
      const thread = await this.database.aiThreads.get(userMessage.threadId);
      if (!thread) {
        throw new Error(`Cannot persist messages for missing thread ${userMessage.threadId}`);
      }

      await this.database.aiMessages.put(userMessage);
      await this.database.aiMessages.put(assistantMessage);

      const latest = [userMessage.createdAt, assistantMessage.createdAt].reduce((a, b) =>
        a.localeCompare(b) >= 0 ? a : b,
      );
      await this.database.aiThreads.update(thread.id, { updatedAt: latest });
    });
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
