import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { SendChatMessageUseCase } from '../SendChatMessageUseCase';
import { AiGroundingResolver } from '../AiGroundingResolver';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import type { AiStreamEvent } from '../../../../domain/ai/models/ai.types';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const GROUNDING_MATERIAL: StudyMaterial = {
  id: 'doc-1',
  title: 'Anatomy & Physiology',
  documentId: 'document-doc-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/**
 * The material and document stubs a grounding context needs; the thread itself comes from the real
 * Dexie repository so the resolution path under test is the one production uses.
 */
function createGroundingResolver(
  chatRepo: DexieAiChatRepository,
  options: { material?: StudyMaterial | null; content?: string } = {},
): AiGroundingResolver {
  const material = options.material === undefined ? GROUNDING_MATERIAL : options.material;
  const libraryRepo = {
    getMaterialById: async () => material,
  } as unknown as LibraryRepository;
  const documentRepo = {
    getDocumentByMaterial: async () => ({
      id: 'document-doc-1',
      title: GROUNDING_MATERIAL.title,
      content: options.content ?? '# Cardiovascular System\nThe sinoatrial node is the pacemaker.',
      format: 'markdown' as const,
    }),
  } as unknown as DocumentRepository;

  return new AiGroundingResolver(chatRepo, libraryRepo, documentRepo);
}

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
    const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo));

    const stream = useCase.execute({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'What is the SA node?',
          createdAt: new Date().toISOString(),
        },
      ],
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
    const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

    const thread = {
      id: 'thread-auto-save',
      materialId: 'doc-1',
      title: 'Test Thread',
      grounding: 'whole' as const,
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
    const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

    const thread = {
      id: 'thread-fail-save',
      materialId: 'doc-1',
      title: 'Fail Thread',
      grounding: 'whole' as const,
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
    const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo));

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

  it('forwards the requested model to the AI service', async () => {
    const mockAi = new MockAiAdapter();
    const received: Array<string | undefined> = [];
    const original = mockAi.streamChat.bind(mockAi);
    mockAi.streamChat = (request) => {
      received.push(request.model);
      return original(request);
    };
    const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo));

    const stream = useCase.execute({
      messages: [
        { id: 'm1', role: 'user', content: 'Explain the SA node.', createdAt: new Date().toISOString() },
      ],
      model: 'ukisai-swift-max',
      mode: 'assistant',
    });
    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(received).toEqual(['ukisai-swift-max']);
  });

  it('sends no model when none is requested, leaving the Worker to resolve its default', async () => {
    const mockAi = new MockAiAdapter();
    const received: Array<string | undefined> = [];
    const original = mockAi.streamChat.bind(mockAi);
    mockAi.streamChat = (request) => {
      received.push(request.model);
      return original(request);
    };
    const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo));

    const stream = useCase.execute({
      messages: [
        { id: 'm1', role: 'user', content: 'Explain the SA node.', createdAt: new Date().toISOString() },
      ],
      mode: 'assistant',
    });
    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(received).toEqual([undefined]);
  });

  // The per-model document budget moved with the resolution: `AiGroundingResolver` owns the cap now,
  // so it is covered there rather than through the send path.

  describe('thread-scoped grounding', () => {
    async function saveThread(grounding: 'none' | 'whole', materialId?: string): Promise<string> {
      const id = `thread-${grounding}-${materialId ?? 'global'}`;
      await chatRepo.saveThread({
        id,
        materialId,
        title: 'Grounded',
        grounding,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      return id;
    }

    /** Records what the request actually carried, then delegates to the real adapter. */
    function recordDocuments(mockAi: MockAiAdapter): Array<string | undefined> {
      const seen: Array<string | undefined> = [];
      const original = mockAi.streamChat.bind(mockAi);
      mockAi.streamChat = (request) => {
        seen.push(request.documentContext?.markdown);
        return original(request);
      };
      return seen;
    }

    it('attaches the document from the thread, with no document passed by the caller', async () => {
      const mockAi = new MockAiAdapter({ tokens: ['Grounded.'] });
      const seen = recordDocuments(mockAi);
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      for await (const _ of useCase.execute({
        threadId,
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
      })) {
        // drained
      }

      expect(seen[0]).toContain('sinoatrial node');
    });

    it('keeps the document attached on a retry of the same conversation', async () => {
      // The original defect: retry re-sent the prompt without the material, because the document was
      // a per-call argument the retry path did not pass.
      const mockAi = new MockAiAdapter({ tokens: ['Grounded.'] });
      const seen = recordDocuments(mockAi);
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      const prompt = {
        id: 'u-1',
        role: 'user' as const,
        content: 'Explain.',
        createdAt: '2026-01-01T00:05:00.000Z',
      };
      for await (const _ of useCase.execute({ threadId, messages: [prompt] })) {
        // drained
      }
      for await (const _ of useCase.execute({ threadId, messages: [prompt] })) {
        // drained
      }

      expect(seen).toHaveLength(2);
      expect(seen[1]).toContain('sinoatrial node');
    });

    it('attaches nothing for an ungrounded conversation', async () => {
      const mockAi = new MockAiAdapter({ tokens: ['From knowledge.'] });
      const seen = recordDocuments(mockAi);
      const threadId = await saveThread('none', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      for await (const _ of useCase.execute({
        threadId,
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
      })) {
        // drained
      }

      expect(seen[0]).toBeUndefined();
    });

    it('leaves a recoverable placeholder when the turn is interrupted', async () => {
      const controller = new AbortController();
      const mockAi = new MockAiAdapter({ tokens: ['a', 'b', 'c'] });
      const original = mockAi.streamChat.bind(mockAi);
      mockAi.streamChat = (request) =>
        (async function* () {
          for await (const event of original(request)) {
            if (event.type === 'token') controller.abort();
            yield event;
          }
        })();
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      for await (const _ of useCase.execute({
        threadId,
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
        signal: controller.signal,
      })) {
        // drained
      }

      // The user turn is never stranded: its partner exists, still streaming, for recovery to repair.
      const messages = await chatRepo.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[0].status).toBe('complete');
      expect(messages[1].status).toBe('streaming');
      expect(await chatRepo.recoverInterruptedMessages()).toBe(1);
    });

    it('fails with a coded error and a retryable pair when the material is gone', async () => {
      const mockAi = new MockAiAdapter({ tokens: ['should not run'] });
      const seen = recordDocuments(mockAi);
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo, { material: null }),
        chatRepo,
      );

      const events: AiStreamEvent[] = [];
      for await (const event of useCase.execute({
        threadId,
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
      })) {
        events.push(event);
      }

      expect(seen).toHaveLength(0);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'error', code: 'GROUNDING_UNAVAILABLE' });

      const messages = await chatRepo.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].status).toBe('error');
      expect(messages[1].metadata?.errorCode).toBe('GROUNDING_UNAVAILABLE');
    });

    it('rejects a send against a conversation that no longer exists', async () => {
      // Reporting this as "ungrounded" would let the send persist turns under a parent that is gone.
      const mockAi = new MockAiAdapter({ tokens: ['should not run'] });
      const seen = recordDocuments(mockAi);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      const events: AiStreamEvent[] = [];
      for await (const event of useCase.execute({
        threadId: 'thread-deleted',
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
      })) {
        events.push(event);
      }

      expect(seen).toHaveLength(0);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'error', code: 'THREAD_NOT_FOUND' });
      expect(await db.aiMessages.where('threadId').equals('thread-deleted').toArray()).toEqual([]);
    });

    it('reports an empty completion as a coded error event as well as a turn', async () => {
      // Reported once, from the one place that knows the turn produced nothing, so the banner and the
      // persisted error turn cannot disagree about what happened.
      const mockAi = new MockAiAdapter({ tokens: [] });
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      const events: AiStreamEvent[] = [];
      for await (const event of useCase.execute({
        threadId,
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
      })) {
        events.push(event);
      }

      expect(events.filter((event) => event.type === 'error')).toEqual([
        { type: 'error', code: 'EMPTY_RESPONSE', message: 'The assistant returned an empty response. Please try again.' },
      ]);
    });

    it('settles an empty completion as a visible error turn rather than leaving it pending', async () => {
      const mockAi = new MockAiAdapter({ tokens: [] });
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo),
        chatRepo,
      );

      for await (const _ of useCase.execute({
        threadId,
        messages: [{ id: 'u-1', role: 'user', content: 'Explain.', createdAt: '2026-01-01T00:05:00.000Z' }],
      })) {
        // drained
      }

      const messages = await chatRepo.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[1].status).toBe('error');
      expect(messages[1].metadata?.errorCode).toBe('EMPTY_RESPONSE');
      expect(messages[1].content).toBe('');
    });
  });

  describe('per-turn grounding stamp', () => {
    async function saveThread(grounding: 'none' | 'whole', materialId?: string): Promise<string> {
      const id = `stamp-${grounding}-${materialId ?? 'global'}`;
      await chatRepo.saveThread({
        id,
        materialId,
        title: 'Stamp',
        grounding,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      return id;
    }

    function prompt(id: string, content: string, createdAt: string) {
      return { id, role: 'user' as const, content, createdAt };
    }

    async function drain(useCase: SendChatMessageUseCase, threadId: string, message: ReturnType<typeof prompt>) {
      for await (const _ of useCase.execute({ threadId, messages: [message] })) {
        // drained
      }
    }

    it('stamps the resolved mode onto both records of a grounded turn', async () => {
      const mockAi = new MockAiAdapter({ tokens: ['Grounded.'] });
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

      await drain(useCase, threadId, prompt('u-1', 'Explain.', '2026-01-01T00:05:00.000Z'));

      const messages = await chatRepo.getMessages(threadId);
      expect(messages.map((m) => m.metadata?.grounding)).toEqual(['whole', 'whole']);
    });

    it('writes an explicit "none" for a healthy ungrounded turn', async () => {
      // "Checked and off" must stay distinguishable from "never resolved": see the failed-turn test.
      const mockAi = new MockAiAdapter({ tokens: ['From knowledge.'] });
      const threadId = await saveThread('none', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

      await drain(useCase, threadId, prompt('u-1', 'Explain.', '2026-01-01T00:05:00.000Z'));

      const messages = await chatRepo.getMessages(threadId);
      expect(messages.map((m) => m.metadata?.grounding)).toEqual(['none', 'none']);
    });

    it('omits the stamp when grounding never resolved, rather than claiming "none"', async () => {
      const mockAi = new MockAiAdapter({ tokens: ['should not run'] });
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(
        mockAi,
        createGroundingResolver(chatRepo, { material: null }),
        chatRepo,
      );

      await drain(useCase, threadId, prompt('u-1', 'Explain.', '2026-01-01T00:05:00.000Z'));

      const messages = await chatRepo.getMessages(threadId);
      expect(messages.map((m) => m.metadata?.grounding)).toEqual([undefined, undefined]);
    });

    it('keeps each turn\'s mode after the thread grounding flips', async () => {
      // The transcript is mixed by design: earlier turns must not be rewritten by a later toggle.
      const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

      await drain(useCase, threadId, prompt('u-1', 'Explain.', '2026-01-01T00:05:00.000Z'));
      await chatRepo.setGrounding(threadId, 'none');
      await drain(useCase, threadId, prompt('u-2', 'Again.', '2026-01-01T00:06:00.000Z'));

      const messages = await chatRepo.getMessages(threadId);
      // Asserted per role: the assistant rows settle at wall-clock time, so the interleaved storage order
      // is not the conversational order here (the user prompts use fixed past timestamps).
      const byRole = (role: 'user' | 'assistant') =>
        messages.filter((m) => m.role === role).map((m) => m.metadata?.grounding);
      expect(byRole('user')).toEqual(['whole', 'none']);
      expect(byRole('assistant')).toEqual(['whole', 'none']);
      expect(messages).toHaveLength(4);
    });

    it('keeps the stamp on a turn that was interrupted before it settled', async () => {
      const controller = new AbortController();
      const mockAi = new MockAiAdapter({ tokens: ['a', 'b'] });
      const original = mockAi.streamChat.bind(mockAi);
      mockAi.streamChat = (request) =>
        (async function* () {
          for await (const event of original(request)) {
            if (event.type === 'token') controller.abort();
            yield event;
          }
        })();
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

      for await (const _ of useCase.execute({
        threadId,
        messages: [prompt('u-1', 'Explain.', '2026-01-01T00:05:00.000Z')],
        signal: controller.signal,
      })) {
        // drained
      }

      const messages = await chatRepo.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[1].status).toBe('streaming');
      expect(messages.map((m) => m.metadata?.grounding)).toEqual(['whole', 'whole']);
    });

    it('keeps the stamp on a grounded turn that settles as a stream error', async () => {
      // The request fact is about what was *sent*, not how the turn ended: grounding succeeded and the
      // material went into the prompt, so a provider failure must not erase that from the record.
      const mockAi = new MockAiAdapter({
        shouldFail: true,
        errorCode: 'API_ERROR',
        errorMessage: 'Service failure',
      });
      const threadId = await saveThread('whole', GROUNDING_MATERIAL.id);
      const useCase = new SendChatMessageUseCase(mockAi, createGroundingResolver(chatRepo), chatRepo);

      await drain(useCase, threadId, prompt('u-1', 'Explain.', '2026-01-01T00:05:00.000Z'));

      const messages = await chatRepo.getMessages(threadId);
      expect(messages).toHaveLength(2);
      expect(messages[1].status).toBe('error');
      expect(messages[1].metadata?.errorCode).toBe('API_ERROR');
      expect(messages.map((m) => m.metadata?.grounding)).toEqual(['whole', 'whole']);
    });
  });
});
