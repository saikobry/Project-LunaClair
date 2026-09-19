import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useAiChatThread } from '../useAiChatThread';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { createAiChatHarness } from '../../../../test/mocks/aiChatHarness';
import type { AiService } from '../../../../domain/ai/services/AiService';

describe('useAiChatThread', () => {
  let db: LunaClairDatabase;

  beforeEach(async () => {
    db = new LunaClairDatabase();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('starts with no session until a prompt is sent, then persists across remounts', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['The SA node ', 'is the heart’s ', 'pacemaker.'],
    });
    const harness = createAiChatHarness(db, mockAi);

    const { result, unmount } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Opening the drawer must not manufacture an empty conversation.
    expect(result.current.thread).toBeNull();
    expect(result.current.sessions).toHaveLength(0);

    await act(async () => {
      await result.current.sendMessage('What is the SA node?');
    });

    expect(result.current.thread).not.toBeNull();
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('What is the SA node?');
    expect(result.current.messages[1].content).toBe('The SA node is the heart’s pacemaker.');
    expect(result.current.messages[1].status).toBe('complete');

    // Simulate page reload
    unmount();

    const { result: remounted } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(remounted.current.isLoading).toBe(false);
    });

    expect(remounted.current.messages).toHaveLength(2);
    expect(remounted.current.sessions).toHaveLength(1);
    expect(remounted.current.sessions[0].title).toBe('What is the SA node?');
  });

  it('surfaces a retryable error when a turn completes without producing any text', async () => {
    // A 200 that streams a start and a done but no tokens: without an explicit error the pending
    // bubble simply vanishes and the user waits for a reply that will never arrive.
    const mockAi = new MockAiAdapter({ tokens: [] });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('What is the SA node?');
    });

    expect(result.current.error?.code).toBe('EMPTY_RESPONSE');
    expect(result.current.isStreaming).toBe(false);
    // Nothing was persisted, so no phantom assistant turn is left in the transcript.
    expect(result.current.messages).toHaveLength(1);
  });

  it('starts a new session without deleting the previous conversation', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('First question');
    });
    const firstSessionId = result.current.thread!.id;

    act(() => {
      result.current.startNewSession();
    });

    // The switch must be synchronous: the draft branch of the load effect is
    // async, so a prompt sent straight after "New chat" would otherwise be
    // appended to the conversation the user just left.
    expect(result.current.thread).toBeNull();
    expect(result.current.messages).toHaveLength(0);

    await act(async () => {
      await result.current.sendMessage('Second question');
    });

    expect(result.current.thread!.id).not.toBe(firstSessionId);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.sessions).toHaveLength(2);

    // The earlier conversation is still intact and selectable.
    act(() => {
      result.current.selectSession(firstSessionId);
    });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe('First question');
    });
    expect(result.current.messages).toHaveLength(2);
  });

  it('deletes a single session and hands the drawer to the remaining one', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('First question');
    });
    const firstSessionId = result.current.thread!.id;

    act(() => {
      result.current.startNewSession();
    });
    await act(async () => {
      await result.current.sendMessage('Second question');
    });

    await act(async () => {
      await result.current.deleteSession(firstSessionId);
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.thread!.id).not.toBe(firstSessionId);
  });

  it('clears every session for the material', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('Test message');
    });
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.sessions).toHaveLength(0);
  });

  it('recovers interrupted streaming turns after reload without getting stuck in streaming state', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Pacemaker.'] });
    const harness = createAiChatHarness(db, mockAi);

    const { result, unmount } = renderHook(
      () => useAiChatThread({ materialId: 'doc-crash' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('Tell me about the heart');
    });
    const threadId = result.current.thread!.id;

    // Simulate the browser dying mid-stream on the following turn
    await harness.aiChatRepository.saveMessage({
      id: 'u-crashed',
      threadId,
      role: 'user',
      content: 'And the ventricles?',
      status: 'complete',
      createdAt: '2024-01-01T01:00:00.000Z',
    });
    await harness.aiChatRepository.saveMessage({
      id: 'a-crashed',
      threadId,
      role: 'assistant',
      content: 'Incomplete sentence when page reloaded...',
      status: 'streaming',
      createdAt: '2024-01-01T01:00:01.000Z',
    });

    unmount();

    const { result: reloaded } = renderHook(
      () => useAiChatThread({ materialId: 'doc-crash' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(reloaded.current.isLoading).toBe(false);
    });

    expect(reloaded.current.isStreaming).toBe(false);
    // The completed first turn, then the user turn and the crashed assistant turn.
    expect(reloaded.current.messages).toHaveLength(4);

    const crashedTurn = reloaded.current.messages.find((m) => m.id === 'a-crashed');
    expect(crashedTurn?.status).toBe('error');
    expect(crashedTurn?.metadata?.errorCode).toBe('INTERRUPTED');
    expect(crashedTurn?.metadata?.errorMessage).toBe('Generation was interrupted.');
  });

  it('surfaces the wait label before the first token and clears it once text flows', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Pacemaker.'], delayMs: 150 });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = result.current.sendMessage('What keeps the heart beating?');
    });

    await waitFor(() => {
      expect(result.current.activity).not.toBeNull();
    });
    expect(result.current.activity?.label).toBe('Thinking…');
    expect(result.current.activity?.isStalled).toBe(false);

    await act(async () => {
      await sendPromise;
    });

    expect(result.current.activity).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('abandons a request that never produces a token and offers a retry', async () => {
    // A service that accepts the request and then stays silent forever.
    const silentAi = {
      async *streamChat() {
        await new Promise(() => undefined);
        // Unreachable: the await above never settles. Present so the iterator
        // contract is explicit rather than a generator with no yield.
        yield { type: 'done' as const };
      },
    } as unknown as AiService;

    const harness = createAiChatHarness(db, silentAi);

    // A short threshold keeps the watchdog deterministic without fake timers.
    const { result } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio', firstTokenTimeoutMs: 80 }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      void result.current.sendMessage('Are you there?');
    });

    await waitFor(() => {
      expect(result.current.error?.code).toBe('TIMEOUT');
    }, { timeout: 3000 });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.activity).toBeNull();
    expect(result.current.retryLastPrompt).toBeTypeOf('function');
  });
});
