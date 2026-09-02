import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useImportStudyPackage } from '../useImportStudyPackage';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

describe('useImportStudyPackage', () => {
  const mockValidPackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Genetics 101',
      description: 'Fundamentals of Mendelian inheritance.',
      author: 'Gregor Mendel',
      createdAt: '2026-08-28T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Mendelian Genetics',
        documentContent: '# Genetics\nPunnett squares and allele segregation.',
      },
    ],
    questions: [
      {
        id: 'pkg_q_1',
        materialId: 'pkg_mat_1',
        type: 'multiple_choice',
        prompt: 'What is a phenotype?',
        payload: {
          type: 'multiple_choice',
          choices: ['Observable characteristics', 'Genetic makeup'],
          correctIndex: 0,
        },
        difficulty: 'easy',
        points: 5,
      },
    ],
    quizzes: [
      {
        id: 'pkg_quiz_1',
        materialId: 'pkg_mat_1',
        title: 'Genetics Quiz',
        items: [{ questionId: 'pkg_q_1', order: 1 }],
      },
    ],
  };

  let queryClient: QueryClient;
  let mockImportExecute: ReturnType<typeof vi.fn>;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockImportExecute = vi.fn().mockResolvedValue({
      materialIds: ['mat-1'],
      questionIds: ['q-1'],
      quizIds: ['quiz-1'],
      assetIds: [],
      idMap: new Map(),
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        package: {
          importStudyPackage: {
            execute: mockImportExecute,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            {children}
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  it('initializes with default empty and closed state', () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    expect(result.current.stagedPackage).toBeNull();
    expect(result.current.isPreviewOpen).toBe(false);
    expect(result.current.isImporting).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('successfully parses, validates, and stages a valid package from Blob', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const json = JSON.stringify(mockValidPackage);
    const blob = new Blob([json], { type: 'application/json' });

    let success = false;
    await act(async () => {
      success = await result.current.stagePackageFromFile(blob);
    });

    expect(success).toBe(true);
    expect(result.current.stagedPackage).toEqual(mockValidPackage);
    expect(result.current.isPreviewOpen).toBe(true);
    expect(result.current.errorMessage).toBeNull();
  });

  it('rejects an invalid package with schema errors and does not open preview or mutate Dexie', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const invalidPackage = {
      format: 'unknown_format',
      schemaVersion: 99,
      metadata: {},
      materials: [],
      questions: [],
      quizzes: [],
    };
    const blob = new Blob([JSON.stringify(invalidPackage)], { type: 'application/json' });

    let success = true;
    await act(async () => {
      success = await result.current.stagePackageFromFile(blob);
    });

    expect(success).toBe(false);
    expect(result.current.stagedPackage).toBeNull();
    expect(result.current.isPreviewOpen).toBe(false);
    expect(result.current.errorMessage).toContain('Invalid study package');
    expect(mockImportExecute).not.toHaveBeenCalled();
  });

  it('handles malformed non-JSON file gracefully', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob(['{ not valid json ...'], { type: 'application/octet-stream' });

    let success = true;
    await act(async () => {
      success = await result.current.stagePackageFromFile(blob);
    });

    expect(success).toBe(false);
    expect(result.current.stagedPackage).toBeNull();
    expect(result.current.isPreviewOpen).toBe(false);
    expect(result.current.errorMessage).toBeDefined();
    expect(mockImportExecute).not.toHaveBeenCalled();
  });

  it('resets state when closePreview is called', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob([JSON.stringify(mockValidPackage)], { type: 'application/json' });
    await act(async () => {
      await result.current.stagePackageFromFile(blob);
    });

    expect(result.current.isPreviewOpen).toBe(true);

    act(() => {
      result.current.closePreview();
    });

    expect(result.current.isPreviewOpen).toBe(false);
    expect(result.current.stagedPackage).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it('executes confirmImport with destination context, invalidates query keys, and closes preview', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob([JSON.stringify(mockValidPackage)], { type: 'application/json' });
    await act(async () => {
      await result.current.stagePackageFromFile(blob);
    });

    await act(async () => {
      await result.current.confirmImport({
        subjectId: 'sub-genetics',
        termId: 'term-finals',
      });
    });

    expect(mockImportExecute).toHaveBeenCalledWith({
      package: mockValidPackage,
      targetSubjectId: 'sub-genetics',
      targetTermId: 'term-finals',
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['catalog'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['materials'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['quizzes'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['questions'] });

    expect(result.current.isPreviewOpen).toBe(false);
    expect(result.current.stagedPackage).toBeNull();
    expect(result.current.isImporting).toBe(false);
  });

  it('handles execution failures during confirmImport and resets isImporting state', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const error = new Error('Database transaction timeout');
    mockImportExecute.mockRejectedValueOnce(error);

    const blob = new Blob([JSON.stringify(mockValidPackage)], { type: 'application/json' });
    await act(async () => {
      await result.current.stagePackageFromFile(blob);
    });

    await act(async () => {
      await expect(result.current.confirmImport()).rejects.toThrow('Database transaction timeout');
    });

    expect(result.current.isImporting).toBe(false);
  });
});
