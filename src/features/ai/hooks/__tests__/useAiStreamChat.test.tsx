import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAiStreamChat } from '../useAiStreamChat';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { SendChatMessageUseCase } from '../../../../application/use-cases/ai/SendChatMessageUseCase';
import { AiGroundingResolver } from '../../../../application/use-cases/ai/AiGroundingResolver';
import { InMemoryAiChatRepository } from '../../../../application/use-cases/ai/__tests__/inMemoryAiChatRepository';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { UseCases } from '../../../../app/bootstrap/createUseCases';

function createMockContext(mockAi: MockAiAdapter): ApplicationContextValue {
  // This hook sends with no `threadId`, so grounding is never consulted; the resolver exists only
  // because a send path must not be constructible without one.
  const groundingResolver = new AiGroundingResolver(
    new InMemoryAiChatRepository(),
    { getMaterialById: async () => null } as unknown as LibraryRepository,
    { getDocumentByMaterial: async () => ({}) } as unknown as DocumentRepository,
  );
  const sendChatMessage = new SendChatMessageUseCase(mockAi, groundingResolver);

  return {
    useCases: {
      ai: { sendChatMessage },
    } as unknown as UseCases,
  } as unknown as ApplicationContextValue;
}

describe('useAiStreamChat', () => {
  it('sends message and accumulates tokens into messages list', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['Natural', ' pacemaker', '.'],
    });
    const mockContext = createMockContext(mockAi);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    );

    const { result } = renderHook(() => useAiStreamChat(), { wrapper });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);

    await act(async () => {
      await result.current.sendMessage('What is the SA node?');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('What is the SA node?');
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('Natural pacemaker.');
    expect(result.current.isStreaming).toBe(false);
  });

  it('handles simulated error event', async () => {
    const mockAi = new MockAiAdapter({
      shouldFail: true,
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Rate limit exceeded.',
    });
    const mockContext = createMockContext(mockAi);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    );

    const { result } = renderHook(() => useAiStreamChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded.',
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it('aborts active stream', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['A', 'B', 'C'],
      delayMs: 100,
    });
    const mockContext = createMockContext(mockAi);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    );

    const { result } = renderHook(() => useAiStreamChat(), { wrapper });

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage('Test');
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.abort();
    });

    await act(async () => {
      await sendPromise;
    });

    expect(result.current.isStreaming).toBe(false);
  });
});
