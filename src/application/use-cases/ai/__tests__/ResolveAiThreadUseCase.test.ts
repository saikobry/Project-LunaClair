import { describe, it, expect, beforeEach } from 'vitest';
import { ResolveAiThreadUseCase } from '../ResolveAiThreadUseCase';
import { InMemoryAiChatRepository } from './inMemoryAiChatRepository';
import type { AiThread } from '../../../../domain/ai/models/ai.types';

function thread(id: string, materialId: string | undefined, updatedAt: string): AiThread {
  return {
    id,
    materialId,
    title: id,
    createdAt: '2026-08-25T01:00:00.000Z',
    updatedAt,
  };
}

describe('ResolveAiThreadUseCase', () => {
  let chatRepo: InMemoryAiChatRepository;
  let resolveThread: ResolveAiThreadUseCase;

  beforeEach(() => {
    chatRepo = new InMemoryAiChatRepository();
    resolveThread = new ResolveAiThreadUseCase(chatRepo);
  });

  it('returns null without creating a session when the material has no history', async () => {
    const result = await resolveThread.execute({ materialId: 'doc-cardio' });

    expect(result.thread).toBeNull();
    expect(result.recoveredMessageCount).toBe(0);
    expect(await chatRepo.listThreads('doc-cardio')).toHaveLength(0);
  });

  it('resolves the most recently updated session in scope', async () => {
    await chatRepo.saveThread(thread('older', 'doc-cardio', '2026-08-25T01:00:00.000Z'));
    await chatRepo.saveThread(thread('newest', 'doc-cardio', '2026-08-25T02:00:00.000Z'));
    await chatRepo.saveThread(thread('global', undefined, '2026-08-25T03:00:00.000Z'));

    const result = await resolveThread.execute({ materialId: 'doc-cardio' });
    expect(result.thread?.id).toBe('newest');
  });

  it('never leaks a session from another material', async () => {
    await chatRepo.saveThread(thread('other-material', 'doc-bio', '2026-08-25T02:00:00.000Z'));

    const result = await resolveThread.execute({ materialId: 'doc-cardio' });
    expect(result.thread).toBeNull();
  });

  it('recovers turns left mid-stream before resolving', async () => {
    await chatRepo.saveThread(thread('t1', 'doc-cardio', '2026-08-25T01:00:00.000Z'));
    await chatRepo.saveMessage({
      id: 'msg-orphan',
      threadId: 't1',
      role: 'assistant',
      content: 'partial',
      status: 'streaming',
      createdAt: '2026-08-25T01:05:00.000Z',
    });

    const result = await resolveThread.execute({ materialId: 'doc-cardio' });

    expect(result.recoveredMessageCount).toBe(1);
    const messages = await chatRepo.getMessages('t1');
    expect(messages[0].status).toBe('error');
    expect(messages[0].metadata?.errorCode).toBe('INTERRUPTED');
  });
});
