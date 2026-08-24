import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { GetOrCreateAiThreadUseCase } from '../GetOrCreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../ClearChatHistoryUseCase';

describe('AI Thread Use Cases', () => {
  let db: LunaClairDatabase;
  let chatRepo: DexieAiChatRepository;

  beforeEach(async () => {
    db = new LunaClairDatabase();
    await db.open();
    chatRepo = new DexieAiChatRepository(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('gets existing thread or creates new thread scoped by materialId + mode', async () => {
    const getOrCreate = new GetOrCreateAiThreadUseCase(chatRepo);

    const thread1 = await getOrCreate.execute({
      materialId: 'doc-cardio',
      mode: 'assistant',
    });

    expect(thread1.id).toBeDefined();
    expect(thread1.materialId).toBe('doc-cardio');
    expect(thread1.mode).toBe('assistant');

    // Calling again returns the exact same thread
    const thread1Again = await getOrCreate.execute({
      materialId: 'doc-cardio',
      mode: 'assistant',
    });
    expect(thread1Again.id).toBe(thread1.id);

    // Calling with a different mode creates a separate thread for that mode
    const threadSocratic = await getOrCreate.execute({
      materialId: 'doc-cardio',
      mode: 'socratic',
    });
    expect(threadSocratic.id).not.toBe(thread1.id);
    expect(threadSocratic.mode).toBe('socratic');
  });

  it('retrieves chronological messages for a thread', async () => {
    const getOrCreate = new GetOrCreateAiThreadUseCase(chatRepo);
    const getMessages = new GetAiThreadMessagesUseCase(chatRepo);

    const thread = await getOrCreate.execute({
      materialId: 'doc-1',
      mode: 'assistant',
    });

    await chatRepo.saveMessage({
      id: 'm1',
      threadId: thread.id,
      role: 'user',
      content: 'Turn 1',
      status: 'complete',
      createdAt: '2026-08-25T01:00:00.000Z',
    });
    await chatRepo.saveMessage({
      id: 'm2',
      threadId: thread.id,
      role: 'assistant',
      content: 'Turn 2',
      status: 'complete',
      createdAt: '2026-08-25T01:01:00.000Z',
    });

    const messages = await getMessages.execute({ threadId: thread.id });
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Turn 1');
    expect(messages[1].content).toBe('Turn 2');
  });

  it('deletes thread and clears chat history', async () => {
    const getOrCreate = new GetOrCreateAiThreadUseCase(chatRepo);
    const deleteThread = new DeleteAiThreadUseCase(chatRepo);
    const clearHistory = new ClearChatHistoryUseCase(chatRepo);

    const thread1 = await getOrCreate.execute({
      materialId: 'doc-1',
      mode: 'assistant',
    });
    await getOrCreate.execute({
      materialId: 'doc-2',
      mode: 'assistant',
    });

    await deleteThread.execute({ threadId: thread1.id });
    const remainingForDoc1 = await chatRepo.listThreads('doc-1');
    expect(remainingForDoc1).toHaveLength(0);

    const remainingForDoc2 = await chatRepo.listThreads('doc-2');
    expect(remainingForDoc2).toHaveLength(1);

    await clearHistory.execute({ materialId: 'doc-2' });
    expect(await chatRepo.listThreads('doc-2')).toHaveLength(0);
  });
});
