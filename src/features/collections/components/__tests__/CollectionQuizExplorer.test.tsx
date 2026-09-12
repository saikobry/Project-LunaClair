import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionQuizExplorer } from '../CollectionQuizExplorer';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { FocusModeProvider } from '../../../../app/providers/FocusModeContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { QuizLaunchRequest } from '../../../quiz/types/quizFeature.types';

describe('CollectionQuizExplorer', () => {
  let queryClient: QueryClient;
  let mockGetQuizzesForMaterials: ReturnType<typeof vi.fn>;

  const now = '2026-08-01T00:00:00.000Z';
  const materials: StudyMaterial[] = [
    { id: 'm-1', title: 'Kinematics', documentId: 'doc-1', createdAt: now, updatedAt: now },
    { id: 'm-2', title: 'Dynamics', documentId: 'doc-2', createdAt: now, updatedAt: now },
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

  const quizzes = [
    makeQuiz('quiz-1', 'm-1', 'Motion Quiz', 2),
    makeQuiz('quiz-2', 'm-1', 'Velocity Quiz', 3),
    makeQuiz('quiz-3', 'm-2', 'Force Quiz', 4),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetQuizzesForMaterials = vi.fn().mockResolvedValue(quizzes);
  });

  function renderExplorer(onStartQuiz?: (request: QuizLaunchRequest) => void) {
    const mockContextValue = {
      repositories: { quiz: { getQuizzesForMaterials: mockGetQuizzesForMaterials } },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          <FocusModeProvider isFocusMode={false}>
            <CollectionQuizExplorer collectionId="c-1" materials={materials} onStartQuiz={onStartQuiz} />
          </FocusModeProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );
  }

  it('shows an empty state when the collection has no quizzes', async () => {
    mockGetQuizzesForMaterials.mockResolvedValueOnce([]);
    renderExplorer();

    await waitFor(() => {
      expect(
        screen.getByText('No quizzes available yet in this collection.'),
      ).toBeInTheDocument();
    });
  });

  it('renders material groups with quiz titles and question count chips', async () => {
    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    expect(screen.getByText('Kinematics')).toBeInTheDocument();
    expect(screen.getByText('Dynamics')).toBeInTheDocument();
    expect(screen.getByText('2 questions')).toBeInTheDocument();
    expect(screen.getByText('3 questions')).toBeInTheDocument();
    expect(screen.getByText('4 questions')).toBeInTheDocument();
  });

  it('shows the floating action bar with counts when quizzes are selected', async () => {
    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Motion Quiz' }));

    await waitFor(() => {
      expect(screen.getByText('A little focus goes a long way.')).toBeInTheDocument();
    });
    expect(screen.getByText('1 selected · 2 questions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Quiz: Motion Quiz' })).toBeInTheDocument();
  });

  it('clears the selection from the floating action bar', async () => {
    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Motion Quiz' }));

    await waitFor(() => {
      expect(screen.getByText('A little focus goes a long way.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    await waitFor(() => {
      expect(screen.queryByText('A little focus goes a long way.')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Start Quiz: Motion Quiz' })).not.toBeInTheDocument();
  });

  it('shows difficulty badges and the toolbar summary', async () => {
    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    expect(screen.getByText('Select All (3)')).toBeInTheDocument();
    expect(screen.getByText('3 quizzes · 9 questions')).toBeInTheDocument();
    expect(screen.getAllByText('Foundations')).toHaveLength(2);
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('starts a single quiz with a quiz launch request', async () => {
    const onStartQuiz = vi.fn();
    renderExplorer(onStartQuiz);

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Motion Quiz' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start Quiz: Motion Quiz' }));

    expect(onStartQuiz).toHaveBeenCalledWith({ type: 'quiz', quizId: 'quiz-1', source: 'library' });
  });

  it('starts a unified quiz when multiple quizzes are selected', async () => {
    const onStartQuiz = vi.fn();
    renderExplorer(onStartQuiz);

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Motion Quiz' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Force Quiz' }));

    const unifiedButton = await screen.findByRole('button', {
      name: 'Start Unified Quiz (2 quizzes · 6 questions)',
    });
    expect(screen.getByText('One session. Connected knowledge.')).toBeInTheDocument();
    expect(screen.getByText('2 selected · 6 questions')).toBeInTheDocument();
    fireEvent.click(unifiedButton);

    expect(onStartQuiz).toHaveBeenCalledWith({
      type: 'quizzes',
      quizIds: expect.arrayContaining(['quiz-1', 'quiz-3']),
      source: 'library',
    });
  });

  it('selects and deselects all quizzes from the toolbar', async () => {
    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select All (3)' }));

    await waitFor(() => {
      expect(screen.getByText('3 selected · 9 questions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select All (3)' }));

    await waitFor(() => {
      expect(screen.queryByText(/selected ·/)).not.toBeInTheDocument();
    });
  });

  it('filters quizzes by the debounced search input', async () => {
    renderExplorer();

    await waitFor(() => {
      expect(screen.getByText('Motion Quiz')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Search materials and quizzes…'), {
      target: { value: 'force' },
    });

    await waitFor(
      () => {
        expect(screen.getByText('Force Quiz')).toBeInTheDocument();
        expect(screen.queryByText('Motion Quiz')).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});
