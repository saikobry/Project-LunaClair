import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollectionQuizTree } from '../useCollectionQuizTree';
import { ApplicationContext, type ApplicationContextValue } from '../../../../../app/providers/ApplicationContext';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';
import type { Quiz } from '../../../../../domain/quiz/models/Quiz';

describe('useCollectionQuizTree', () => {
  let queryClient: QueryClient;
  let mockGetQuizzesForMaterials: ReturnType<typeof vi.fn>;

  const now = '2026-08-01T00:00:00.000Z';
  const materials: StudyMaterial[] = [
    { id: 'm-1', title: 'First', documentId: 'doc-1', createdAt: now, updatedAt: now },
    { id: 'm-2', title: 'Second', documentId: 'doc-2', createdAt: now, updatedAt: now },
  ];

  function makeQuiz(id: string, materialId: string, title: string, questionCount: number): Quiz {
    return {
      id,
      materialId,
      title,
      status: 'published',
      questionIds: Array.from({ length: questionCount }, (_, i) => `q-${id}-${i}`),
      items: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetQuizzesForMaterials = vi.fn().mockResolvedValue([
      makeQuiz('quiz-2', 'm-2', 'Second Quiz', 3),
      makeQuiz('quiz-1', 'm-1', 'First Quiz', 2),
    ]);
  });

  function createWrapper() {
    const mockContextValue = {
      repositories: { quiz: { getQuizzesForMaterials: mockGetQuizzesForMaterials } },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {children}
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );
  }

  it('fetches quizzes for the collection material ids', async () => {
    const { result } = renderHook(() => useCollectionQuizTree('c-1', materials), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetQuizzesForMaterials).toHaveBeenCalledWith(['m-1', 'm-2'], expect.anything());
  });

  it('groups quizzes by material in collection material order with question counts', async () => {
    const { result } = renderHook(() => useCollectionQuizTree('c-1', materials), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tree.map((g) => g.materialId)).toEqual(['m-1', 'm-2']);
    expect(result.current.tree[0]).toEqual({
      materialId: 'm-1',
      materialTitle: 'First',
      quizzes: [
        {
          id: 'quiz-1',
          materialId: 'm-1',
          title: 'First Quiz',
          questionCount: 2,
          description: undefined,
        },
      ],
    });
    expect(result.current.tree[1]?.quizzes[0]?.questionCount).toBe(3);
  });

  it('omits materials that have no quizzes', async () => {
    mockGetQuizzesForMaterials.mockResolvedValueOnce([makeQuiz('quiz-1', 'm-1', 'First Quiz', 1)]);
    const { result } = renderHook(() => useCollectionQuizTree('c-1', materials), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tree.map((g) => g.materialId)).toEqual(['m-1']);
  });

  it('returns an empty tree when the collection has no materials', async () => {
    const { result } = renderHook(() => useCollectionQuizTree('c-1', []), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tree).toEqual([]);
    expect(mockGetQuizzesForMaterials).not.toHaveBeenCalled();
  });
});
