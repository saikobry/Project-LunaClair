import { describe, it, expect, beforeEach } from 'vitest';
import { CreateAiThreadUseCase } from '../CreateAiThreadUseCase';
import { InMemoryAiChatRepository } from './inMemoryAiChatRepository';

describe('CreateAiThreadUseCase', () => {
  let chatRepo: InMemoryAiChatRepository;
  let createThread: CreateAiThreadUseCase;

  beforeEach(() => {
    chatRepo = new InMemoryAiChatRepository();
    createThread = new CreateAiThreadUseCase(chatRepo);
  });

  it('always creates a distinct session for the same material', async () => {
    const first = await createThread.execute({ materialId: 'doc-cardio' });
    const second = await createThread.execute({ materialId: 'doc-cardio' });

    expect(first.id).not.toBe(second.id);
    expect(first.materialId).toBe('doc-cardio');
    expect(await chatRepo.listThreads('doc-cardio')).toHaveLength(2);
  });

  it('scopes the session to the material and titles it generically until named', async () => {
    const thread = await createThread.execute({ materialId: 'doc-cardio' });
    expect(thread.title).toBe('New chat');

    const global = await createThread.execute();
    expect(global.materialId).toBeUndefined();
    expect(global.title).toBe('New global chat');
  });

  it('honours an explicit title and trims it', async () => {
    const thread = await createThread.execute({ materialId: 'doc-cardio', title: '  Cardiac cycle  ' });
    expect(thread.title).toBe('Cardiac cycle');
  });

  it('stamps createdAt and updatedAt from the same instant', async () => {
    const thread = await createThread.execute({ materialId: 'doc-cardio' });
    expect(thread.createdAt).toBe(thread.updatedAt);
    expect(Number.isNaN(new Date(thread.createdAt).getTime())).toBe(false);
  });
});
