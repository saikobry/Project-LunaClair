import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useImportStudyPackage } from '../useImportStudyPackage';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

const showToastMock = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

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

  /**
   * A genuinely malformed package, NOT a hand-written warnings array on a mocked result.
   *
   * This is the shape the tolerant read tier used to admit: two `___` markers against one answer.
   * It is driven through the REAL `validateStudyPackage` (the hook calls it directly on the parsed
   * file), so the test exercises the live rejection surface rather than a stub describing a path
   * that no longer exists.
   */
  const malformedPackage: StudyPackage = {
    ...mockValidPackage,
    questions: [
      {
        id: 'pkg_q_broken_cloze',
        materialId: 'pkg_mat_1',
        type: 'fill_in_blank',
        prompt: 'Fill in the blanks.',
        payload: {
          type: 'fill_in_blank',
          template: 'The ___ is the ___ of the cell.',
          blanks: ['nucleus'],
        },
        difficulty: 'medium',
        points: 1,
      },
    ],
  };

  let queryClient: QueryClient;
  let mockImportExecute: ReturnType<typeof vi.fn>;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The toast mock is module-level, so a call recorded by an earlier case would otherwise
    // satisfy a "no error was shown" assertion in a later one.
    vi.clearAllMocks();

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

  it('shows a success toast and no error for a well-formed import', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob([JSON.stringify(mockValidPackage)], { type: 'application/json' });
    await act(async () => {
      await result.current.stagePackageFromFile(blob);
    });

    await act(async () => {
      await result.current.confirmImport();
    });

    // The negative case is the load-bearing one: a well-formed package must reach no error
    // channel at all, or the refusal below stops meaning anything.
    expect(result.current.errorMessage).toBeNull();
    expect(showToastMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ intent: 'error' }),
    );
    expect(showToastMock).toHaveBeenCalledWith('Study package imported successfully', {
      intent: 'success',
    });
  });

  /**
   * The live rejection surface, exercised with a genuinely malformed package.
   *
   * The validator is the REAL one the hook calls on the parsed file, so this is the production
   * path: the user picks a `.lcpack` whose question payload is structurally invalid, and is told
   * which question and which field — before anything touches Dexie. There is no "imported in a
   * reduced form" outcome to report any more; the import does not happen.
   */
  it('refuses a malformed package at the file, names the offending question, and never calls the import use case', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob([JSON.stringify(malformedPackage)], { type: 'application/json' });

    let success = true;
    await act(async () => {
      success = await result.current.stagePackageFromFile(blob);
    });

    expect(success).toBe(false);
    expect(result.current.stagedPackage).toBeNull();
    expect(result.current.isPreviewOpen).toBe(false);
    // Both the package id and the specific field are named, so the user can act on it.
    expect(result.current.errorMessage).toContain('pkg_q_broken_cloze');
    expect(result.current.errorMessage).toContain('exactly one answer per "___" placeholder');

    // The toast carries the same single finding, and nothing reached persistence.
    expect(showToastMock).toHaveBeenCalledWith(
      'Invalid study package: Question "pkg_q_broken_cloze": fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 1 supplied).',
      { intent: 'error' },
    );
    expect(mockImportExecute).not.toHaveBeenCalled();
  });

  it('refuses a package whose identification answer is empty, naming the field', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob(
      [
        JSON.stringify({
          ...mockValidPackage,
          questions: [
            {
              id: 'pkg_q_broken_ident',
              materialId: 'pkg_mat_1',
              type: 'identification',
              prompt: 'Name the organelle.',
              payload: { type: 'identification', correctAnswer: '' },
              difficulty: 'medium',
              points: 1,
            },
          ],
        }),
      ],
      { type: 'application/json' },
    );

    let success = true;
    await act(async () => {
      success = await result.current.stagePackageFromFile(blob);
    });

    expect(success).toBe(false);
    expect(result.current.errorMessage).toContain('requires a non-empty "correctAnswer" string');
    expect(mockImportExecute).not.toHaveBeenCalled();
  });

  it('executes confirmImport, invalidates query keys, and closes preview', async () => {
    const { result } = renderHook(() => useImportStudyPackage(), {
      wrapper: createWrapper(),
    });

    const blob = new Blob([JSON.stringify(mockValidPackage)], { type: 'application/json' });
    await act(async () => {
      await result.current.stagePackageFromFile(blob);
    });

    await act(async () => {
      await result.current.confirmImport();
    });

    expect(mockImportExecute).toHaveBeenCalledWith({
      package: mockValidPackage,
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
