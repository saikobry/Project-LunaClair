import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { usePublishStudyPackage } from '../usePublishStudyPackage';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { PublishShareResult } from '../../../../domain/sharing/models/sharing.types';

const showToastMock = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('usePublishStudyPackage', () => {
  const mockPublishResult: PublishShareResult = {
    id: 'share_abc123',
    format: 'lcpack',
    schemaVersion: 1,
    title: 'Cell Biology Notes',
    description: 'A study pack on cellular structures',
    accessType: 'public',
    shareUrl: '/share/share_abc123',
    createdAt: '2026-08-28T00:00:00.000Z',
  };

  let mockPublishExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishExecute = vi.fn().mockResolvedValue(mockPublishResult);
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        sharing: {
          publishStudyPackage: {
            execute: mockPublishExecute,
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

  it('publishes package successfully with default options, updates state, and fires toast & onSuccess', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => usePublishStudyPackage({ onSuccess, onError }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isPublishing).toBe(false);
    expect(result.current.publishResult).toBeNull();

    let res: PublishShareResult | undefined;
    await act(async () => {
      res = await result.current.publish('mat-123');
    });

    expect(mockPublishExecute).toHaveBeenCalledWith({
      materialId: 'mat-123',
      accessType: 'public',
      passcode: undefined,
      expiresAt: undefined,
    });
    expect(res).toEqual(mockPublishResult);
    expect(result.current.publishResult).toEqual(mockPublishResult);
    expect(result.current.isPublishing).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith('Published "Cell Biology Notes" to Cloud', {
      intent: 'success',
    });
    expect(onSuccess).toHaveBeenCalledWith(mockPublishResult);
    expect(onError).not.toHaveBeenCalled();
  });

  it('passes custom accessType, passcode, and expiresAt options to execute', async () => {
    const customResult: PublishShareResult = {
      ...mockPublishResult,
      accessType: 'passcode',
    };
    mockPublishExecute.mockResolvedValueOnce(customResult);

    const { result } = renderHook(
      () => usePublishStudyPackage(),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.publish('mat-456', {
        accessType: 'passcode',
        passcode: 'secret123',
        expiresAt: '2026-09-28T00:00:00.000Z',
      });
    });

    expect(mockPublishExecute).toHaveBeenCalledWith({
      materialId: 'mat-456',
      accessType: 'passcode',
      passcode: 'secret123',
      expiresAt: '2026-09-28T00:00:00.000Z',
    });
    expect(result.current.publishResult).toEqual(customResult);
  });

  it('handles execution error, triggers toast & onError callback, and rethrows', async () => {
    const error = new Error('Network timeout');
    mockPublishExecute.mockRejectedValueOnce(error);

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => usePublishStudyPackage({ onSuccess, onError }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await expect(result.current.publish('mat-err')).rejects.toThrow('Network timeout');
    });

    expect(result.current.isPublishing).toBe(false);
    expect(result.current.publishResult).toBeNull();
    expect(showToastMock).toHaveBeenCalledWith('Network timeout', {
      intent: 'error',
    });
    expect(onError).toHaveBeenCalledWith(error);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('resets publishResult when reset() is called', async () => {
    const { result } = renderHook(
      () => usePublishStudyPackage(),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.publish('mat-123');
    });

    expect(result.current.publishResult).toEqual(mockPublishResult);

    act(() => {
      result.current.reset();
    });

    expect(result.current.publishResult).toBeNull();
  });
});
