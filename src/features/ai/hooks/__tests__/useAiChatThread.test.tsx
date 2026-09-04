import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import 'fake-indexeddb/auto';
import { useAiChatThread } from '../useAiChatThread';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { LunaClairDatabase } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { SendChatMessageUseCase } from '../../../../application/use-cases/ai/SendChatMessageUseCase';
import { GetOrCreateAiThreadUseCase } from '../../../../application/use-cases/ai/GetOrCreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../../../application/use-cases/ai/ClearChatHistoryUseCase';
import type { UseCases } from '../../../../app/bootstrap/createUseCases';
import type { Infrastructure, Repositories } from '../../../../app/bootstrap/createInfrastructure';

function createTestHarness(db: LunaClairDatabase, mockAi: MockAiAdapter) {
  const aiChatRepository = new DexieAiChatRepository(db);
  const sendChatMessage = new SendChatMessageUseCase(mockAi, aiChatRepository);
  const getOrCreateThread = new GetOrCreateAiThreadUseCase(aiChatRepository);
  const getThreadMessages = new GetAiThreadMessagesUseCase(aiChatRepository);
  const deleteThread = new DeleteAiThreadUseCase(aiChatRepository);
  const clearChatHistory = new ClearChatHistoryUseCase(aiChatRepository);

  const contextValue = {
    repositories: {
      aiChat: aiChatRepository,
    } as unknown as Repositories,
    infrastructure: {
      repositories: {
        aiChat: aiChatRepository,
      },
    } as unknown as Infrastructure,
    useCases: {
      ai: {
        sendChatMessage,
        getOrCreateThread,
        getThreadMessages,
        deleteThread,
        clearChatHistory,
      },
    } as unknown as UseCases,
  } as unknown as ApplicationContextValue;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApplicationContext.Provider value={contextValue}>
      {children}
    </ApplicationContext.Provider>
  );

  return { contextValue, wrapper, aiChatRepository };
}

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

  it('hydrates thread and persists conversation across remounts (reload persistence)', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['The SA node ', 'is the heart’s ', 'pacemaker.'],
    });
    const harness = createTestHarness(db, mockAi);

    // 1. Initial mount
    const { result, unmount } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio', mode: 'assistant' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.thread).toBeDefined();
    expect(result.current.messages).toHaveLength(0);

    // 2. Send message and wait for stream completion
    await act(async () => {
      await result.current.sendMessage('What is the SA node?');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('What is the SA node?');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('The SA node is the heart’s pacemaker.');
    expect(result.current.messages[1].status).toBe('complete');

    // 3. Simulate page reload by unmounting and mounting a fresh hook
    unmount();

    const { result: remountedResult } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio', mode: 'assistant' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(remountedResult.current.isLoading).toBe(false);
    });

    expect(remountedResult.current.messages).toHaveLength(2);
    expect(remountedResult.current.messages[0].content).toBe('What is the SA node?');
    expect(remountedResult.current.messages[1].content).toBe('The SA node is the heart’s pacemaker.');
  });

  it('clears thread history', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['Pacemaker.'],
    });
    const harness = createTestHarness(db, mockAi);

    const { result } = renderHook(
      () => useAiChatThread({ materialId: 'doc-cardio', mode: 'assistant' }),
      { wrapper: harness.wrapper },
    );

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

    // Verify Dexie records are cleared
    const messagesInDb = await harness.aiChatRepository.getMessages(result.current.thread!.id);
    expect(messagesInDb).toHaveLength(0);
  });

  it('recovers interrupted streaming turns after reload without getting stuck in streaming state', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['Pacemaker.'],
    });
    const harness = createTestHarness(db, mockAi);

    // 1. Initial mount and create thread
    const { result, unmount } = renderHook(
      () => useAiChatThread({ materialId: 'doc-crash', mode: 'assistant' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const threadId = result.current.thread!.id;

    // 2. Simulate browser crash while assistant was streaming
    await harness.aiChatRepository.saveMessage({
      id: 'u-crashed',
      threadId,
      role: 'user',
      content: 'Tell me about the heart',
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

    // 3. Unmount and remount (simulating page reload)
    unmount();

    const { result: reloadedResult } = renderHook(
      () => useAiChatThread({ materialId: 'doc-crash', mode: 'assistant' }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(reloadedResult.current.isLoading).toBe(false);
    });

    // 4. Assertions: UI is not streaming, interrupted turn is recovered
    expect(reloadedResult.current.isStreaming).toBe(false);
    expect(reloadedResult.current.messages).toHaveLength(2);
    expect(reloadedResult.current.messages[0].content).toBe('Tell me about the heart');
    expect(reloadedResult.current.messages[1].status).toBe('error');
    expect(reloadedResult.current.messages[1].metadata?.errorCode).toBe('INTERRUPTED');
    expect(reloadedResult.current.messages[1].metadata?.errorMessage).toBe('Generation was interrupted.');

    // 5. Verify user can retry / send a new message successfully
    await act(async () => {
      await reloadedResult.current.sendMessage('Let me try asking again.');
    });

    expect(reloadedResult.current.messages).toHaveLength(4);
    expect(reloadedResult.current.messages[2].content).toBe('Let me try asking again.');
    expect(reloadedResult.current.messages[3].content).toBe('Pacemaker.');
    expect(reloadedResult.current.messages[3].status).toBe('complete');
  });
});
