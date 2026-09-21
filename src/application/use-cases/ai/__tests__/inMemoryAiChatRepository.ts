import type { AiChatRepository } from '../../../../domain/ai/repositories/AiChatRepository';
import type { AiGroundingMode, AiMessageRecord, AiThread } from '../../../../domain/ai/models/ai.types';

/**
 * In-memory `AiChatRepository` for pure application-layer unit tests.
 *
 * Keeps use-case tests free of IndexedDB while reproducing the contract that
 * matters to them: newest-session resolution, cascade deletion, and orphaned
 * `streaming` recovery.
 */
export class InMemoryAiChatRepository implements AiChatRepository {
  private readonly threads = new Map<string, AiThread>();
  private readonly messages = new Map<string, AiMessageRecord>();

  async getThread(threadId: string): Promise<AiThread | null> {
    return this.threads.get(threadId) ?? null;
  }

  async listThreads(materialId?: string): Promise<AiThread[]> {
    return [...this.threads.values()]
      .filter((thread) => thread.materialId === materialId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findLatestThread(materialId?: string): Promise<AiThread | null> {
    return (await this.listThreads(materialId))[0] ?? null;
  }

  async saveThread(thread: AiThread): Promise<void> {
    this.threads.set(thread.id, { ...thread });
  }

  async setGrounding(threadId: string, grounding: AiGroundingMode): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    this.threads.set(threadId, { ...thread, grounding });
  }

  async setTitle(threadId: string, title: string): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    this.threads.set(threadId, { ...thread, title });
  }

  async deleteThread(threadId: string): Promise<void> {
    this.threads.delete(threadId);
    for (const [id, message] of this.messages) {
      if (message.threadId === threadId) this.messages.delete(id);
    }
  }

  async getMessages(threadId: string): Promise<AiMessageRecord[]> {
    return [...this.messages.values()]
      .filter((message) => message.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveMessage(message: AiMessageRecord): Promise<void> {
    this.messages.set(message.id, { ...message });
    const thread = this.threads.get(message.threadId);
    if (thread) {
      this.threads.set(thread.id, { ...thread, updatedAt: message.createdAt });
    }
  }

  async saveMessagesBatch(messages: AiMessageRecord[]): Promise<void> {
    for (const message of messages) {
      await this.saveMessage(message);
    }
  }

  async saveMessagePair(
    userMessage: AiMessageRecord,
    assistantMessage: AiMessageRecord,
  ): Promise<void> {
    // Mirrors the Dexie adapter: the parent is verified first and the pair lands together, so a
    // thread that no longer exists rolls back rather than leaving orphaned history.
    const thread = this.threads.get(userMessage.threadId);
    if (!thread) {
      throw new Error(`Cannot persist messages for missing thread ${userMessage.threadId}`);
    }

    this.messages.set(userMessage.id, { ...userMessage });
    this.messages.set(assistantMessage.id, { ...assistantMessage });

    const latest =
      userMessage.createdAt.localeCompare(assistantMessage.createdAt) >= 0
        ? userMessage.createdAt
        : assistantMessage.createdAt;
    this.threads.set(thread.id, { ...thread, updatedAt: latest });
  }

  async clearMaterialThreads(materialId: string): Promise<void> {
    for (const thread of await this.listThreads(materialId)) {
      await this.deleteThread(thread.id);
    }
  }

  async clearAllThreads(): Promise<void> {
    this.threads.clear();
    this.messages.clear();
  }

  async recoverInterruptedMessages(): Promise<number> {
    let recovered = 0;
    for (const [id, message] of this.messages) {
      if (message.status !== 'streaming') continue;
      this.messages.set(id, {
        ...message,
        status: 'error',
        metadata: { ...message.metadata, errorCode: 'INTERRUPTED', errorMessage: 'Generation was interrupted.' },
      });
      recovered += 1;
    }
    return recovered;
  }
}
