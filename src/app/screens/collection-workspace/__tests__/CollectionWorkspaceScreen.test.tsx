import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionWorkspaceScreen } from '../CollectionWorkspaceScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { FocusModeProvider } from '../../../providers/FocusModeContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { Collection } from '../../../../domain/collections/models/Collection';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { AppRoute } from '../../../routing/routing';

describe('CollectionWorkspaceScreen', () => {
  let queryClient: QueryClient;
  let mockGetById: ReturnType<typeof vi.fn>;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockRemoveExecute: ReturnType<typeof vi.fn>;
  let mockUpdateExecute: ReturnType<typeof vi.fn>;
  let mockDeleteExecute: ReturnType<typeof vi.fn>;
  let mockGetQuizzesForMaterials: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn<(route: AppRoute) => void>>;

  const now = '2026-08-01T00:00:00.000Z';
  const collection: Collection = {
    id: 'c-1',
    title: 'Physics Playlist',
    description: 'Mechanics',
    color: '#3b82f6',
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
  const materials: StudyMaterial[] = [
    { id: 'm-1', title: 'Kinematics', documentId: 'doc-1', createdAt: now, updatedAt: now },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetById = vi.fn().mockResolvedValue(collection);
    mockGetByCollectionId = vi.fn().mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now },
    ]);
    mockGetMaterials = vi.fn().mockResolvedValue(materials);
    mockRemoveExecute = vi.fn().mockResolvedValue(undefined);
    mockUpdateExecute = vi.fn().mockResolvedValue({ ...collection, title: 'Renamed' });
    mockDeleteExecute = vi.fn().mockResolvedValue(undefined);
    mockGetQuizzesForMaterials = vi.fn().mockResolvedValue([]);
    mockNavigate = vi.fn();
  });

  function renderScreen(onStartQuiz?: (request: import('../../../../features/quiz/types/quizFeature.types').QuizLaunchRequest) => void) {
    const mockContextValue = {
      repositories: {
        collection: { getById: mockGetById },
        collectionMaterial: { getByCollectionId: mockGetByCollectionId },
        library: { getMaterials: mockGetMaterials },
        quiz: { getQuizzesForMaterials: mockGetQuizzesForMaterials },
      },
      useCases: {
        collections: {
          removeMaterialFromCollection: { execute: mockRemoveExecute },
          updateCollection: { execute: mockUpdateExecute },
          deleteCollection: { execute: mockDeleteExecute },
        },
      },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {/* The Quizzes tab hosts `CollectionQuizExplorer`, which is nav-aware
              through `useFocusMode`; in the app the provider comes from AppShell. */}
          <FocusModeProvider isFocusMode={false}>
            <ApplicationContext.Provider value={mockContextValue}>
              <CollectionWorkspaceScreen collectionId="c-1" onNavigate={mockNavigate} onStartQuiz={onStartQuiz} />
            </ApplicationContext.Provider>
          </FocusModeProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the collection hero and its materials', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Physics Playlist' })).toBeInTheDocument();
    });

    expect(screen.getByText('Kinematics')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === '1 Material · 0 Quizzes · 0% Average mastery',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Collection title, edit inline')).toHaveValue('Physics Playlist');
    expect(screen.getByLabelText('Collection description, edit inline')).toHaveValue('Mechanics');
  });

  it('commits inline title edits on blur', async () => {
    renderScreen();

    const titleInput = await screen.findByLabelText('Collection title, edit inline');
    fireEvent.change(titleInput, { target: { value: 'Renamed Inline' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(mockUpdateExecute).toHaveBeenCalledWith('c-1', { title: 'Renamed Inline' });
    });
  });

  it('reverts an empty inline title instead of saving', async () => {
    renderScreen();

    const titleInput = await screen.findByLabelText('Collection title, edit inline');
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(titleInput).toHaveValue('Physics Playlist');
    });
    expect(mockUpdateExecute).not.toHaveBeenCalled();
  });

  it('commits inline description edits on blur', async () => {
    renderScreen();

    const descriptionInput = await screen.findByLabelText('Collection description, edit inline');
    fireEvent.change(descriptionInput, { target: { value: 'New purpose' } });
    fireEvent.blur(descriptionInput);

    await waitFor(() => {
      expect(mockUpdateExecute).toHaveBeenCalledWith('c-1', { description: 'New purpose' });
    });
  });

  it('disables Quick Study when the collection has no quizzes', async () => {
    renderScreen();

    expect(await screen.findByRole('button', { name: 'Quick Study' })).toBeDisabled();
  });

  it('launches Quick Study with all collection quizzes', async () => {
    const onStartQuiz = vi.fn();
    mockGetQuizzesForMaterials.mockResolvedValueOnce([
      {
        id: 'quiz-1',
        materialId: 'm-1',
        title: 'Kinematics Quiz',
        status: 'published',
        questionIds: ['q-1', 'q-2'],
        items: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    renderScreen(onStartQuiz);

    const quickStudy = await screen.findByRole('button', { name: 'Quick Study' });
    await waitFor(() => {
      expect(quickStudy).toBeEnabled();
    });

    fireEvent.click(quickStudy);

    expect(onStartQuiz).toHaveBeenCalledWith({
      type: 'quizzes',
      quizIds: ['quiz-1'],
      source: 'library',
    });
  });

  it('renders an empty state when the collection has no materials', async () => {
    mockGetByCollectionId.mockResolvedValueOnce([]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('No materials in this collection yet')).toBeInTheDocument();
    });
  });

  it('renders a not-found state for a missing collection', async () => {
    mockGetById.mockResolvedValueOnce(null);
    mockGetByCollectionId.mockResolvedValueOnce([]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Collection could not be found')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Library' }));
    expect(mockNavigate).toHaveBeenCalledWith({ kind: 'library' });
  });

  it('removes a material after confirming the removal dialog', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Kinematics from collection' }));

    expect(
      await screen.findByText('Remove "Kinematics" from this collection? (The material stays in your Library)'),
    ).toBeInTheDocument();
    expect(mockRemoveExecute).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(mockRemoveExecute).toHaveBeenCalledWith('c-1', 'm-1');
    });
  });

  it('keeps the material when the removal dialog is cancelled', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Kinematics from collection' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });
    expect(mockRemoveExecute).not.toHaveBeenCalled();
  });

  it('edits the collection through the edit modal', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Collection' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Collection' }));

    const greenSwatch = screen.getByLabelText('Green color');
    fireEvent.click(greenSwatch);
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateExecute).toHaveBeenCalledWith('c-1', expect.objectContaining({ color: '#4ade80' }));
    });
  });

  it('deletes the collection through the confirmation dialog and returns to the library', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Collection' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Collection' }));

    await waitFor(() => {
      expect(
        screen.getByText('Delete this collection? (Materials inside will not be deleted)'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteExecute).toHaveBeenCalledWith('c-1');
      expect(mockNavigate).toHaveBeenCalledWith({ kind: 'library' });
    });
  });

  it('switches between the Materials and Quizzes tabs', async () => {
    // Persistent mock: both the workspace hero and the quiz explorer observe
    // the quiz-tree query, so the repository can be hit more than once.
    mockGetQuizzesForMaterials.mockResolvedValue([
      {
        id: 'quiz-1',
        materialId: 'm-1',
        title: 'Kinematics Quiz',
        status: 'published',
        questionIds: ['q-1', 'q-2'],
        items: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Materials' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quizzes' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quizzes' }));

    await waitFor(() => {
      expect(screen.getByText('Kinematics Quiz')).toBeInTheDocument();
    });
    expect(mockGetQuizzesForMaterials).toHaveBeenCalledWith(['m-1'], expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Materials' }));

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });
  });

  it('forwards quiz launches from the quiz explorer', async () => {
    const onStartQuiz = vi.fn();
    // Persistent mock: both the workspace hero and the quiz explorer observe
    // the quiz-tree query, so the repository can be hit more than once.
    mockGetQuizzesForMaterials.mockResolvedValue([
      {
        id: 'quiz-1',
        materialId: 'm-1',
        title: 'Kinematics Quiz',
        status: 'published',
        questionIds: ['q-1', 'q-2'],
        items: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    renderScreen(onStartQuiz);

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Quizzes' }));

    await waitFor(() => {
      expect(screen.getByText('Kinematics Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Kinematics Quiz' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start Quiz: Kinematics Quiz' }));

    expect(onStartQuiz).toHaveBeenCalledWith({
      type: 'quiz',
      quizId: 'quiz-1',
      source: 'library',
    });
  });
});
