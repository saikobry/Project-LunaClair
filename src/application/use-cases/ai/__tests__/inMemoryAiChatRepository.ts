import type { AiChatRepository } from '../../../../domain/ai/repositories/AiChatRepository';
import type { AiMessageRecord, AiThread } from '../../../../domain/ai/models/ai.types';

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
