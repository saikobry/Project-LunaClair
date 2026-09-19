import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { AiThread } from '../../../domain/ai/models/ai.types';

export interface ResolveAiThreadInput {
  /** Optional study material ID. If undefined, resolves the global assistant's latest session. */
  materialId?: string;
}

export interface ResolveAiThreadResult {
  /** The most recently updated session in scope, or null when the scope has never been used. */
  thread: AiThread | null;
  /** Turns left in `streaming` status by a reload that were transitioned to `error`/INTERRUPTED. */
  recoveredMessageCount: number;
}

/**
 * Entry point for the AI chat surface.
 *
 * Recovers turns abandoned mid-stream by a reload and resolves the newest
 * session in scope. It never creates a session: a material with no history
 * shows the composer's empty state instead of an empty row in session history.
 *
 * The two reads are independent — recovery touches messages, resolution reads
 * threads — so they are issued together.
 */
export class ResolveAiThreadUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: ResolveAiThreadInput = {}): Promise<ResolveAiThreadResult> {
    const [recoveredMessageCount, thread] = await Promise.all([
      this.chatRepo.recoverInterruptedMessages(),
      this.chatRepo.findLatestThread(input.materialId),
    ]);

    return { thread, recoveredMessageCount };
  }
}
