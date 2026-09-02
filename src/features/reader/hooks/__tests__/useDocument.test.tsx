import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocument } from '../useDocument';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { DocumentNotFoundError } from '../../../../domain/reader/errors/DocumentNotFoundError';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Document } from '../../../../domain/reader/models/Document';

describe('useDocument', () => {
  let queryClient: QueryClient;
  let mockDocumentRepo: any;
  let mockContext: any;

  const mockMaterial1: StudyMaterial = {
    id: 'mat-cell-1',
    title: 'Cell Structure & Function',
    documentId: 'doc-cell-1',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  };

  const mockMaterial2: StudyMaterial = {
    id: 'mat-gen-1',
    title: 'Genetics & Heredity',
    documentId: 'doc-gen-1',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  };

  const mockDocument1: Document = {
    id: 'doc-cell-1',
    title: 'Cell Structure & Function',
    content: '# Cell Biology\n\nMitochondria is the powerhouse of the cell.',
    format: 'markdown',
  };

  const mockDocument2: Document = {
    id: 'doc-gen-1',
    title: 'Genetics & Heredity',
    content: '# Genetics\n\nDNA carries genetic instructions.',
    format: 'markdown',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockDocumentRepo = {
      getDocumentByMaterial: vi.fn().mockResolvedValue(mockDocument1),
    };

    mockContext = {
      repositories: {
        document: mockDocumentRepo,
      },
    };
  });

  const createWrapper = () => ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={mockContext}>
        {children}
      </ApplicationContext.Provider>
    </QueryClientProvider>
  );

  it('remains disabled and does not fetch when material is null', () => {
    const { result } = renderHook(() => useDocument(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPending).toBe(true);
    expect(mockDocumentRepo.getDocumentByMaterial).not.toHaveBeenCalled();
  });

  it('fetches and resolves document content when material is provided', async () => {
    const { result } = renderHook(() => useDocument(mockMaterial1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDocument1);
    expect(mockDocumentRepo.getDocumentByMaterial).toHaveBeenCalledWith(
      mockMaterial1,
      expect.anything(),
    );
  });

  it('updates document data when material input changes', async () => {
    mockDocumentRepo.getDocumentByMaterial.mockImplementation(async (mat: StudyMaterial) => {
      if (mat.id === 'mat-cell-1') return mockDocument1;
      if (mat.id === 'mat-gen-1') return mockDocument2;
      throw new Error('Not found');
    });

    const { result, rerender } = renderHook(
      ({ material }) => useDocument(material),
      {
        wrapper: createWrapper(),
        initialProps: { material: mockMaterial1 as StudyMaterial | null },
      },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockDocument1);
    });

    rerender({ material: mockMaterial2 });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockDocument2);
    });

    expect(mockDocumentRepo.getDocumentByMaterial).toHaveBeenCalledWith(
      mockMaterial2,
      expect.anything(),
    );
  });

  it('propagates DocumentNotFoundError when repository cannot resolve material document', async () => {
    mockDocumentRepo.getDocumentByMaterial.mockRejectedValue(
      new DocumentNotFoundError('doc-missing-1'),
    );

    const { result } = renderHook(() => useDocument(mockMaterial1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(DocumentNotFoundError);
    expect(result.current.error?.message).toContain('doc-missing-1');
  });

  it('handles unexpected network or repository failure gracefully', async () => {
    mockDocumentRepo.getDocumentByMaterial.mockRejectedValue(
      new Error('Dexie database locked or corrupted'),
    );

    const { result } = renderHook(() => useDocument(mockMaterial1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Dexie database locked or corrupted');
  });
});
