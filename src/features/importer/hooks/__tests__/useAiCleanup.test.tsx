import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAiCleanup, type AiCleanupDiffResult } from '../useAiCleanup';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { AiModelCatalog } from '../../../../domain/ai/services/aiModelCatalog';

describe('useAiCleanup', () => {
  let mockCleanupExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCleanupExecute = vi.fn().mockImplementation(async ({ markdown }) => ({
      original: markdown,
      cleaned: '# Formatted Clean Heading\n\n- Point 1\n- Point 2',
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createWrapper(
    executeFn = mockCleanupExecute,
    extraMethods: {
      retryCleanupRemaining?: any;
      hasPendingCleanupResume?: any;
      clearPendingCleanupResume?: any;
    } = {},
  ) {
    const mockContextValue = {
      useCases: {
        importer: {
          cleanupWithAi: {
            execute: executeFn,
            retryCleanupRemaining: extraMethods.retryCleanupRemaining,
            hasPendingCleanupResume: extraMethods.hasPendingCleanupResume,
            clearPendingCleanupResume: extraMethods.clearPendingCleanupResume,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <ApplicationContext.Provider value={mockContextValue}>
        {children}
      </ApplicationContext.Provider>
    );
  }

  it('initializes with idle state and zero cooldownSeconds', () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.cooldownSeconds).toBe(0);
  });

  it('executes cleanWithAi successfully and updates diffResult with candidateId', async () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    let res: AiCleanupDiffResult | null = null;
    await act(async () => {
      res = await result.current.cleanWithAi('# Raw Extracted Heading', 'cand-1', 'Document Title');
    });

    expect(mockCleanupExecute).toHaveBeenCalledWith({
      markdown: '# Raw Extracted Heading',
      title: 'Document Title',
      model: undefined,
      catalog: undefined,
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    });
    expect(res).toEqual({
      candidateId: 'cand-1',
      original: '# Raw Extracted Heading',
      cleaned: '# Formatted Clean Heading\n\n- Point 1\n- Point 2',
    });
    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toEqual({
      candidateId: 'cand-1',
      original: '# Raw Extracted Heading',
      cleaned: '# Formatted Clean Heading\n\n- Point 1\n- Point 2',
    });
    expect(result.current.error).toBeNull();
  });

  it('forwards model and catalog to execute and stores candidateId and original in diffResult', async () => {
    const dummyCatalog: AiModelCatalog = {
      version: 'test-ver',
      defaultModelId: 'ukisai-swift-max',
      models: [],
    };

    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Text', 'cand-99', 'Doc Title', {
        model: 'ukisai-swift-max',
        catalog: dummyCatalog,
      });
    });

    expect(mockCleanupExecute).toHaveBeenCalledWith({
      markdown: '# Raw Text',
      title: 'Doc Title',
      model: 'ukisai-swift-max',
      catalog: dummyCatalog,
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    });
    expect(result.current.diffResult?.candidateId).toBe('cand-99');
    expect(result.current.diffResult?.original).toBe('# Raw Text');
  });

  it('aborts prior in-flight request on retry and clears prior diffResult/error', async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveFirst: ((val: any) => void) | undefined;
    mockCleanupExecute
      .mockImplementationOnce(({ signal }) => {
        firstSignal = signal;
        return new Promise((res) => {
          resolveFirst = res;
        });
      })
      .mockImplementationOnce(() => new Promise(() => {}));

    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    // Start first cleanup
    act(() => {
      result.current.cleanWithAi('First text', 'cand-1');
    });
    expect(result.current.isCleaning).toBe(true);

    // Start second cleanup (retry)
    act(() => {
      result.current.cleanWithAi('Second text', 'cand-1');
    });

    expect(firstSignal?.aborted).toBe(true);

    // Resolve first (should be ignored)
    await act(async () => {
      resolveFirst?.({ original: 'First text', cleaned: 'Cleaned first' });
    });
    expect(result.current.isCleaning).toBe(true);
    expect(result.current.diffResult).toBeNull();
  });

  it('aborts in-flight request on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockCleanupExecute.mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // never resolves
    });

    const { result, unmount } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.cleanWithAi('Text', 'cand-1');
    });

    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('abortCleanup aborts in-flight request and clears isCleaning, diffResult, and error', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockCleanupExecute.mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // never resolves
    });

    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.cleanWithAi('Text', 'cand-1');
    });

    expect(result.current.isCleaning).toBe(true);
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.abortCleanup();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles cleanWithAi failure and sets error message', async () => {
    const failingExecute = vi.fn().mockRejectedValue(new Error('AI Service Unavailable'));
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(failingExecute),
    });

    let res: AiCleanupDiffResult | null = null;
    await act(async () => {
      res = await result.current.cleanWithAi('# Raw Text', 'cand-1');
    });

    expect(res).toBeNull();
    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toBeNull();
    expect(result.current.error).toBe('AI Service Unavailable');
    expect(result.current.cooldownSeconds).toBe(0);
  });

  it('handles cleanWithAi failure with fallback error message when error has no message', async () => {
    const failingExecute = vi.fn().mockRejectedValue({});
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(failingExecute),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Text', 'cand-1');
    });

    expect(result.current.error).toBe('Failed to clean with AI');
  });

  it('extracts retryAfterSeconds from error and runs countdown timer', async () => {
    vi.useFakeTimers();

    const rateLimitError = Object.assign(new Error('Too many requests'), {
      retryAfterSeconds: 15,
    });
    const failingExecute = vi.fn().mockRejectedValue(rateLimitError);
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(failingExecute),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Text', 'cand-1');
    });

    expect(result.current.error).toBe('Too many requests');
    expect(result.current.cooldownSeconds).toBe(15);

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.cooldownSeconds).toBe(10);

    // Advance remaining 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.cooldownSeconds).toBe(0);
  });

  it('extracts cooldown seconds from regex pattern in error message', async () => {
    vi.useFakeTimers();

    const regexError = new Error('Shared capacity busy: please try again in 8s.');
    const failingExecute = vi.fn().mockRejectedValue(regexError);
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(failingExecute),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Text', 'cand-1');
    });

    expect(result.current.cooldownSeconds).toBe(8);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.cooldownSeconds).toBe(5);
  });

  it('acceptCleanup returns cleaned content and clears diffResult', async () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Extracted Heading', 'cand-1');
    });

    expect(result.current.diffResult).not.toBeNull();

    let accepted: string | undefined;
    act(() => {
      accepted = result.current.acceptCleanup();
    });

    expect(accepted).toBe('# Formatted Clean Heading\n\n- Point 1\n- Point 2');
    expect(result.current.diffResult).toBeNull();
  });

  it('rejectCleanup clears diffResult without returning content', async () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Extracted Heading', 'cand-1');
    });

    expect(result.current.diffResult).not.toBeNull();

    act(() => {
      result.current.rejectCleanup();
    });

    expect(result.current.diffResult).toBeNull();
  });

  it('cleanSelection returns cleaned string directly without modifying diffResult', async () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    let res: string | null = null;
    await act(async () => {
      res = await result.current.cleanSelection('Selected markdown snippet', 'Title');
    });

    expect(res).toBe('# Formatted Clean Heading\n\n- Point 1\n- Point 2');
    expect(result.current.diffResult).toBeNull();
    expect(result.current.isCleaning).toBe(false);
    expect(result.current.canRetryRemaining).toBe(false);
  });

  it('retryRemaining resumes remaining chunks when pending resume exists', async () => {
    const mockRetry = vi.fn().mockResolvedValue({
      original: 'Full original text',
      cleaned: 'Full cleaned text with all sections',
    });
    const mockHasResume = vi.fn().mockReturnValue(true);

    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(mockCleanupExecute, {
        retryCleanupRemaining: mockRetry,
        hasPendingCleanupResume: mockHasResume,
      }),
    });

    let res: AiCleanupDiffResult | null = null;
    await act(async () => {
      res = await result.current.retryRemaining('cand-42');
    });

    expect(mockRetry).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    });
    expect(res).toEqual({
      candidateId: 'cand-42',
      original: 'Full original text',
      cleaned: 'Full cleaned text with all sections',
    });
    expect(result.current.diffResult).toEqual(res);
    expect(result.current.isCleaning).toBe(false);
  });
});
