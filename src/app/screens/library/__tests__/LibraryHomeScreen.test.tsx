import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LibraryHomeScreen } from '../LibraryHomeScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('LibraryHomeScreen unfiled mode', () => {
  let queryClient: QueryClient;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;
  let mockBrowseLibrary: ReturnType<typeof vi.fn<() => void>>;

  const now = '2026-08-01T00:00:00.000Z';
  const materials: StudyMaterial[] = [
    { id: 'm-1', title: 'Kinematics', documentId: 'doc-1', createdAt: now, updatedAt: now },
    { id: 'm-2', title: 'Loose Note', documentId: 'doc-2', createdAt: now, updatedAt: now },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetMaterials = vi.fn().mockResolvedValue(materials);
    mockGetAll = vi.fn().mockResolvedValue([
      { id: 'c-1', title: 'Physics', order: 0, createdAt: now, updatedAt: now },
    ]);
    // m-1 lives in c-1; m-2 is unassigned.
    mockGetByCollectionId = vi.fn().mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now },
    ]);
    mockBrowseLibrary = vi.fn();
  });

  function renderScreen(unfiledOnly: boolean) {
    const mockContextValue = {
      repositories: {
        library: { getMaterials: mockGetMaterials },
        collection: { getAll: mockGetAll },
        collectionMaterial: { getByCollectionId: mockGetByCollectionId },
      },
      useCases: { materials: {}, collections: {} },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <LibraryHomeScreen
              unfiledOnly={unfiledOnly}
              onOpenMaterial={vi.fn()}
              onStartQuiz={vi.fn()}
              onManage={vi.fn()}
              onBrowseAvailable={vi.fn()}
              onBrowseLibrary={mockBrowseLibrary}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('shows only unassigned materials with the unfiled title', async () => {
    renderScreen(true);

    // Heading renders during load — wait for content before asserting.
    await waitFor(() => {
      expect(screen.getByText('Loose Note')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Unfiled' })).toBeInTheDocument();
    expect(
      screen.getByText('Room to find a home · Materials not in any collection'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Kinematics')).not.toBeInTheDocument();
  });

  it('shows the cleared unfiled empty state with a browse action', async () => {
    // Every material assigned — unfiled list is empty.
    mockGetByCollectionId.mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now },
      { id: 2, collectionId: 'c-1', materialId: 'm-2', order: 1, addedAt: now },
    ]);
    renderScreen(true);

    await waitFor(() => {
      expect(screen.getByText('Everything has a home.')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Your unfiled list is clear. Materials can still live in more than one collection.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browse all materials' }));
    expect(mockBrowseLibrary).toHaveBeenCalledTimes(1);
  });

  it('keeps the full library view in default mode', async () => {
    renderScreen(false);

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Study Library' })).toBeInTheDocument();
    expect(screen.getByText('Loose Note')).toBeInTheDocument();
  });
});
