import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAiCleanup } from '../useAiCleanup';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';

describe('useAiCleanup', () => {
  let mockCleanupExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCleanupExecute = vi.fn().mockResolvedValue({
      original: '# Raw Extracted Heading',
      cleaned: '# Formatted Clean Heading\n\n- Point 1\n- Point 2',
    });
  });

  function createWrapper(executeFn = mockCleanupExecute) {
    const mockContextValue = {
      useCases: {
        importer: {
          cleanupWithAi: {
            execute: executeFn,
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

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('executes cleanWithAi successfully and updates diffResult', async () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    let res: { original: string; cleaned: string } | null = null;
    await act(async () => {
      res = await result.current.cleanWithAi('# Raw Extracted Heading', 'Document Title');
    });

    expect(mockCleanupExecute).toHaveBeenCalledWith('# Raw Extracted Heading', 'Document Title');
    expect(res).toEqual({
      original: '# Raw Extracted Heading',
      cleaned: '# Formatted Clean Heading\n\n- Point 1\n- Point 2',
    });
    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toEqual({
      original: '# Raw Extracted Heading',
      cleaned: '# Formatted Clean Heading\n\n- Point 1\n- Point 2',
    });
    expect(result.current.error).toBeNull();
  });

  it('handles cleanWithAi failure and sets error message', async () => {
    const failingExecute = vi.fn().mockRejectedValue(new Error('AI Service Unavailable'));
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(failingExecute),
    });

    let res: { original: string; cleaned: string } | null = null;
    await act(async () => {
      res = await result.current.cleanWithAi('# Raw Text');
    });

    expect(res).toBeNull();
    expect(result.current.isCleaning).toBe(false);
    expect(result.current.diffResult).toBeNull();
    expect(result.current.error).toBe('AI Service Unavailable');
  });

  it('handles cleanWithAi failure with fallback error message when error has no message', async () => {
    const failingExecute = vi.fn().mockRejectedValue({});
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(failingExecute),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Text');
    });

    expect(result.current.error).toBe('Failed to clean with AI');
  });

  it('acceptCleanup returns cleaned content and clears diffResult', async () => {
    const { result } = renderHook(() => useAiCleanup(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.cleanWithAi('# Raw Extracted Heading');
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
      await result.current.cleanWithAi('# Raw Extracted Heading');
    });

    expect(result.current.diffResult).not.toBeNull();

    act(() => {
      result.current.rejectCleanup();
    });

    expect(result.current.diffResult).toBeNull();
  });
});
