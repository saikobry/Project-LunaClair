import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useAiChatThread } from '../useAiChatThread';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { createAiChatHarness } from '../../../../test/mocks/aiChatHarness';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';
import type { AiService } from '../../../../domain/ai/services/AiService';

describe('useAiChatThread', () => {
  let db: LunaClairDatabase;

  beforeEach(async () => {
    // The cooldown deadline is persisted by design, so a test that starts one would otherwise hand
    // its remaining seconds to every test after it.
    localStorage.clear();
    db = new LunaClairDatabase();
    await db.open();
  });

  afterEach(async () => {
    localStorage.clear();
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

    expect(result.current.isStreaming).toBe(false);
    // The turn is settled as an empty error turn rather than left pending: the user turn must never
    // be stranded without a partner, and the failure stays visible and retryable in the transcript.
    // The banner is cleared once that persisted turn is reloaded, so the failure is reported once.
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toHaveLength(2);
    const [userTurn, assistantTurn] = result.current.messages;
    expect(userTurn.role).toBe('user');
    expect(assistantTurn.role).toBe('assistant');
    expect(assistantTurn.status).toBe('error');
    expect(assistantTurn.content).toBe('');
    expect(assistantTurn.metadata?.errorCode).toBe('EMPTY_RESPONSE');
  });

  it('keeps a retryable banner when a failure persists no turn at all', async () => {
    // A save that rolls back (or a validation/missing-thread refusal) persists
    // nothing for the refresh to reload. Clearing the banner then would dissolve
    // the failure into an empty transcript with no explanation, so the coded
    // error stays visible and the prompt stays retryable from hook state.
    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const harness = createAiChatHarness(db, mockAi);
    vi.spyOn(harness.aiChatRepository, 'saveMessagePair').mockRejectedValueOnce(
      new Error('simulated write failure'),
    );

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('What is the SA node?');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error?.code).toBe('PERSISTENCE_ERROR');

    await act(async () => {
      await result.current.retryLastPrompt();
    });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.error).toBeNull();
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

  it('opens a distinct session without history when freshSession is requested', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Fresh answer.'] });
    const received: Array<Array<{ role: string; content: string }>> = [];
    const original = mockAi.streamChat.bind(mockAi);
    mockAi.streamChat = (request) => {
      received.push(request.messages.map((m) => ({ role: m.role, content: m.content })));
      return original(request);
    };
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
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      await result.current.sendMessage('Selection follow-up', { freshSession: true });
    });

    // A distinct session carries only the new turn; the previous one is untouched.
    expect(result.current.thread!.id).not.toBe(firstSessionId);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Selection follow-up');
    expect(result.current.sessions).toHaveLength(2);
    // The provider never saw the previous conversation.
    expect(received).toHaveLength(2);
    expect(received[1]).toHaveLength(1);
    expect(received[1][0].content).toBe('Selection follow-up');
  });

  it('sends the selected model and leaves it unset when none is chosen', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const received: Array<string | undefined> = [];
    const original = mockAi.streamChat.bind(mockAi);
    mockAi.streamChat = (request) => {
      received.push(request.model);
      return original(request);
    };
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio', model: 'ukisai-swift-max' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('Explain the SA node.');
    });

    expect(received).toEqual(['ukisai-swift-max']);
  });

  it('holds off sending during a rate-limit cooldown and says how long', async () => {
    // A shared-capacity model refuses on its own schedule; spending the next request on a second
    // refusal helps nobody.
    const mockAi = new MockAiAdapter({
      shouldFail: true,
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Rate limit: 5 prompts per minute per IP. Try again in 6s.',
      retryAfterSeconds: 6,
    });
    const streamChat = vi.spyOn(mockAi, 'streamChat');
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('First try.');
    });

    // The wait the provider named is honored, not the fallback.
    expect(result.current.cooldownSeconds).toBeGreaterThan(0);
    expect(result.current.cooldownSeconds).toBeLessThanOrEqual(6);
    // The refusal is persisted as its own turn, so the transcript carries it rather than the banner.
    expect(
      result.current.messages.some((message) => message.metadata?.errorCode === 'RATE_LIMITED'),
    ).toBe(true);

    const attemptsAfterFirst = streamChat.mock.calls.length;

    await act(async () => {
      await result.current.sendMessage('Second try.');
    });

    // The retry never reached the service, and the user was told why.
    expect(streamChat.mock.calls.length).toBe(attemptsAfterFirst);
    expect(result.current.error?.code).toBe('RATE_LIMITED');
    expect(result.current.error?.message).toMatch(/Shared capacity is busy/);
  });

  it('resumes a persisted cooldown after a reload instead of re-arming the request', async () => {
    // The wait describes the provider's window, not this tab: a reload must not spend the next
    // request on another refusal.
    localStorage.setItem(
      STORAGE_KEYS.ai.rateLimitUntil,
      String(Date.now() + 30_000),
    );

    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const streamChat = vi.spyOn(mockAi, 'streamChat');
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cooldownSeconds).toBeGreaterThan(0);

    await act(async () => {
      await result.current.sendMessage('Too soon?');
    });

    expect(streamChat).not.toHaveBeenCalled();
    expect(result.current.error?.code).toBe('RATE_LIMITED');
  });

  it('ignores a persisted cooldown that has already elapsed', async () => {
    localStorage.setItem(STORAGE_KEYS.ai.rateLimitUntil, String(Date.now() - 1_000));

    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cooldownSeconds).toBe(0);

    await act(async () => {
      await result.current.sendMessage('A question.');
    });

    expect(result.current.messages).toHaveLength(2);
  });

  it('reports no cooldown when a turn succeeds', async () => {
    const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
    const harness = createAiChatHarness(db, mockAi);

    const { result } = renderHook(() => useAiChatThread({ materialId: 'doc-cardio' }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.sendMessage('A question.');
    });

    expect(result.current.cooldownSeconds).toBe(0);
  });
});
