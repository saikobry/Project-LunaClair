import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SendChatMessageUseCase } from '../SendChatMessageUseCase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import type { AiStreamEvent } from '../../../../domain/ai/models/ai.types';

describe('SendChatMessageUseCase', () => {
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

  it('streams response events through AiService', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['Pacemaker', ' of ', 'the heart.'],
    });
    const useCase = new SendChatMessageUseCase(mockAi);

    const stream = useCase.execute({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'What is the SA node?',
          createdAt: new Date().toISOString(),
        },
      ],
      document: {
        id: 'doc-1',
        title: 'Anatomy & Physiology',
        markdown: '# Cardiovascular System\nThe sinoatrial node is the pacemaker.',
      },
      mode: 'assistant',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(2);
    expect(events[0].type).toBe('start');
    expect(events[1]).toEqual({ type: 'token', text: 'Pacemaker' });
    expect(events[events.length - 1].type).toBe('done');
  });

  it('persists user message and completed assistant message when threadId is provided', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['Natural', ' pacemaker.'],
    });
    const useCase = new SendChatMessageUseCase(mockAi, chatRepo);

    const thread = {
      id: 'thread-auto-save',
      materialId: 'doc-1',
      title: 'Test Thread',
      mode: 'assistant' as const,
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };
    await chatRepo.saveThread(thread);

    const stream = useCase.execute({
      threadId: thread.id,
      messages: [
        {
          id: 'u-1',
          role: 'user',
          content: 'What is SA node?',
          createdAt: '2026-08-25T01:05:00.000Z',
        },
      ],
      mode: 'assistant',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events[events.length - 1].type).toBe('done');

    // Verify messages saved to Dexie
    const savedMessages = await chatRepo.getMessages(thread.id);
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages[0].role).toBe('user');
    expect(savedMessages[0].content).toBe('What is SA node?');
    expect(savedMessages[1].role).toBe('assistant');
    expect(savedMessages[1].content).toBe('Natural pacemaker.');
    expect(savedMessages[1].status).toBe('complete');
  });

  it('persists error message record on stream error', async () => {
    const mockAi = new MockAiAdapter({
      shouldFail: true,
      errorCode: 'API_ERROR',
      errorMessage: 'Service failure',
    });
    const useCase = new SendChatMessageUseCase(mockAi, chatRepo);

    const thread = {
      id: 'thread-fail-save',
      materialId: 'doc-1',
      title: 'Fail Thread',
      mode: 'assistant' as const,
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };
    await chatRepo.saveThread(thread);

    const stream = useCase.execute({
      threadId: thread.id,
      messages: [
        {
          id: 'u-fail',
          role: 'user',
          content: 'Will this fail?',
          createdAt: '2026-08-25T01:05:00.000Z',
        },
      ],
      mode: 'assistant',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');

    const savedMessages = await chatRepo.getMessages(thread.id);
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages[1].role).toBe('assistant');
    expect(savedMessages[1].status).toBe('error');
    expect(savedMessages[1].metadata?.errorCode).toBe('API_ERROR');
  });

  it('yields validation error when messages array is empty', async () => {
    const mockAi = new MockAiAdapter();
    const useCase = new SendChatMessageUseCase(mockAi);

    const stream = useCase.execute({
      messages: [],
      mode: 'assistant',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      code: 'VALIDATION_ERROR',
      message: 'At least one message is required to send a chat request.',
    });
  });
});
