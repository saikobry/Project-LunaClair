import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionWorkspaceScreen } from '../CollectionWorkspaceScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
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
          <ApplicationContext.Provider value={mockContextValue}>
            <CollectionWorkspaceScreen collectionId="c-1" onNavigate={mockNavigate} onStartQuiz={onStartQuiz} />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the collection header and its materials', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Physics Playlist' })).toBeInTheDocument();
    });

    expect(screen.getByText('Kinematics')).toBeInTheDocument();
    expect(screen.getByText('1 material in this collection')).toBeInTheDocument();
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

  it('removes a material from the collection on card action', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Kinematics from collection' }));

    await waitFor(() => {
      expect(mockRemoveExecute).toHaveBeenCalledWith('c-1', 'm-1');
    });
  });

  it('edits the collection through the edit modal', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit Collection' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Collection' }));

    const titleInput = screen.getByLabelText('Title');
    expect(titleInput).toHaveValue('Physics Playlist');
    fireEvent.change(titleInput, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpdateExecute).toHaveBeenCalledWith('c-1', expect.objectContaining({ title: 'Renamed' }));
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

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Quizzes' }));

    await waitFor(() => {
      expect(screen.getByText('Kinematics Quiz')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Kinematics Quiz' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start Quiz' }));

    expect(onStartQuiz).toHaveBeenCalledWith({
      type: 'quiz',
      quizId: 'quiz-1',
      source: 'library',
    });
  });
});
