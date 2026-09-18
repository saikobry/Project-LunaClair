import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useStudyPackageSize, SHARE_PACKAGE_SIZE_LIMIT_BYTES } from '../useStudyPackageSize';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import * as serializer from '../../../../domain/package/engines/StudyPackageSerializer';

describe('useStudyPackageSize', () => {
  let mockMaterializeExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaterializeExecute = vi.fn().mockResolvedValue({ metadata: { title: 't' } });
  });

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const mockContextValue = {
      useCases: {
        package: {
          materializeStudyPackage: {
            execute: mockMaterializeExecute,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <ApplicationContext.Provider value={mockContextValue}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApplicationContext.Provider>
    );
  }

  it('exposes the 5 MiB share guard next to the worker constant', () => {
    expect(SHARE_PACKAGE_SIZE_LIMIT_BYTES).toBe(5 * 1024 * 1024);
  });

  it('materializes the package and reports the serialized byte size without downloading', async () => {
    vi.spyOn(serializer, 'serializePackageToBlob').mockReturnValue(
      new Blob(['0123456789'], { type: 'application/octet-stream' }),
    );
    const { result } = renderHook(() => useStudyPackageSize('m-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockMaterializeExecute).toHaveBeenCalledWith({ materialId: 'm-1' });
    expect(result.current.sizeBytes).toBe(10);
  });
});
