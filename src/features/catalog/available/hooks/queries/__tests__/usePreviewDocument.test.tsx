import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePreviewDocument } from '../usePreviewDocument';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../../app/providers/ApplicationContext';
import type { StudyMaterial } from '../../../../../../domain/library/models/StudyMaterial';
import type { Document } from '../../../../../../domain/reader/models/Document';

describe('usePreviewDocument', () => {
  let queryClient: QueryClient;
  let mockGetDocumentByMaterial: ReturnType<typeof vi.fn>;

  const mockMaterial: StudyMaterial = {
    id: 'mat-anatomy',
    title: 'Gross Anatomy of the Human Heart',
    description: 'Chambers, valves, and coronary circulation.',
    documentId: 'doc-heart',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const mockDocument: Document = {
    id: 'doc-heart',
    title: 'Gross Anatomy of the Human Heart',
    content: '# Cardiac Anatomy\nThe myocardium is composed of specialized muscle fibers.',
    format: 'markdown',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetDocumentByMaterial = vi.fn().mockResolvedValue(mockDocument);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: {
        document: {
          getDocumentByMaterial: mockGetDocumentByMaterial,
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {children}
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );
  }

  it('stays idle/disabled when material is null without calling repository', () => {
    const { result } = renderHook(() => usePreviewDocument(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(mockGetDocumentByMaterial).not.toHaveBeenCalled();
  });

  it('fetches document content when a valid material is supplied', async () => {
    const { result } = renderHook(() => usePreviewDocument(mockMaterial), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDocument);
    expect(mockGetDocumentByMaterial).toHaveBeenCalledWith(mockMaterial, expect.anything());
  });

  it('handles document fetch errors gracefully', async () => {
    mockGetDocumentByMaterial.mockRejectedValueOnce(new Error('Document not found'));

    const { result } = renderHook(() => usePreviewDocument(mockMaterial), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Document not found');
  });
});
