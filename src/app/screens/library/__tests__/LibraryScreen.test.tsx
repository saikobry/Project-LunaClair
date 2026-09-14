import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LibraryScreen } from '../LibraryScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { MaterialMembershipFilter } from '../../../../features/materials/types/libraryFilter.types';
import type { LibraryViewMode } from '../../../routing/routing';

describe('LibraryScreen', () => {
  let queryClient: QueryClient;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;
  let mockFilterChange: ReturnType<typeof vi.fn<(filter: MaterialMembershipFilter) => void>>;
  let mockViewChange: ReturnType<typeof vi.fn<(view: LibraryViewMode) => void>>;
  let mockOpenCollection: ReturnType<typeof vi.fn<(collectionId: string) => void>>;

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
    mockFilterChange = vi.fn();
    mockViewChange = vi.fn();
    mockOpenCollection = vi.fn();
  });

  function renderScreen(
    filter?: MaterialMembershipFilter,
    overrideMaterials?: StudyMaterial[],
    view?: LibraryViewMode,
  ) {
    if (overrideMaterials) mockGetMaterials.mockResolvedValue(overrideMaterials);

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
            <LibraryScreen
              filter={filter}
              onFilterChange={mockFilterChange}
              view={view}
              onViewChange={mockViewChange}
              onOpenMaterial={vi.fn()}
              onStartQuiz={vi.fn()}
              onManage={vi.fn()}
              onOpenCollection={mockOpenCollection}
              onBrowseAvailable={vi.fn()}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the collections shelf above the materials section', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    });

    // The shelf resolves asynchronously — wait for the collection card.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Physics/ })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument();

    // Both materials render under the default `all` lens.
    expect(await screen.findByText('Kinematics')).toBeInTheDocument();
    expect(screen.getByText('Loose Note')).toBeInTheDocument();
  });

  it('reports the membership lens change when a filter is chosen', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Not in a collection' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Not in a collection' }));
    expect(mockFilterChange).toHaveBeenCalledWith('uncollected');
  });

  it('shows only unassigned materials under the uncollected lens', async () => {
    renderScreen('uncollected');

    await waitFor(() => {
      expect(screen.getByText('Loose Note')).toBeInTheDocument();
    });

    expect(screen.queryByText('Kinematics')).not.toBeInTheDocument();
    expect(
      screen.getByText('Materials in no collection.'),
    ).toBeInTheDocument();
  });

  it('shows only collection members under the collected lens', async () => {
    renderScreen('collected');

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    expect(screen.queryByText('Loose Note')).not.toBeInTheDocument();
    expect(
      screen.getByText('Materials that belong to at least one collection.'),
    ).toBeInTheDocument();
  });

  it('shows the cleared-uncollected empty state with a browse action', async () => {
    // Every material is assigned — the uncollected lens has nothing to show.
    mockGetByCollectionId.mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now },
      { id: 2, collectionId: 'c-1', materialId: 'm-2', order: 1, addedAt: now },
    ]);
    renderScreen('uncollected');

    await waitFor(() => {
      expect(screen.getByText('Everything has a home.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Browse all materials' }));
    expect(mockFilterChange).toHaveBeenCalledWith('all');
  });

  it('shows the empty-library state with an explore action when nothing exists', async () => {
    renderScreen(undefined, []);

    await waitFor(() => {
      expect(screen.getByText('Your library is empty')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Explore Study Packages/ })).toBeInTheDocument();
  });

  it('reports the view change when a switcher option is chosen', async () => {
    renderScreen();

    // The switcher resolves with the collections query — wait for it.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Collections' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
    expect(mockViewChange).toHaveBeenCalledWith('collections');

    fireEvent.click(screen.getByRole('button', { name: 'Materials' }));
    expect(mockViewChange).toHaveBeenCalledWith('materials');
  });

  it('shows only the shelf under the collections view', async () => {
    renderScreen(undefined, undefined, 'collections');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Physics/ })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument();
    expect(screen.queryByText('Kinematics')).not.toBeInTheDocument();
  });

  it('shows only materials under the materials view', async () => {
    renderScreen(undefined, undefined, 'materials');

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Collections' })).not.toBeInTheDocument();
  });

  it('caps the tag pills at eight with a frequency-ranked expander', async () => {
    renderScreen(undefined, [
      { id: 'm-1', title: 'Alpha', documentId: 'doc-1', tags: ['tag-a', 'tag-b', 'tag-c', 'tag-d'], createdAt: now, updatedAt: now },
      { id: 'm-2', title: 'Beta', documentId: 'doc-2', tags: ['tag-a', 'tag-e', 'tag-f'], createdAt: now, updatedAt: now },
      { id: 'm-3', title: 'Gamma', documentId: 'doc-3', tags: ['tag-a', 'tag-g', 'tag-h', 'tag-i', 'tag-j'], createdAt: now, updatedAt: now },
    ]);

    // tag-a leads on frequency (3 materials); the rest tie at 1, alphabetical.
    // (The `#` sigil is aria-hidden, so pill names read as the bare tag.)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tag-a' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'tag-h' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tag-i' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more tags' }));
    expect(screen.getByRole('button', { name: 'tag-j' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByRole('button', { name: 'tag-j' })).not.toBeInTheDocument();
  });

  it('matches materials tagged with any selected tag', async () => {
    renderScreen(undefined, [
      { id: 'm-1', title: 'Alpha', documentId: 'doc-1', tags: ['tag-a'], createdAt: now, updatedAt: now },
      { id: 'm-2', title: 'Beta', documentId: 'doc-2', tags: ['tag-b'], createdAt: now, updatedAt: now },
    ]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'tag-a' })).toBeInTheDocument();
    });

    // Selecting both keeps both materials (OR within the tag facet —
    // AND would empty the grid here).
    fireEvent.click(screen.getByRole('button', { name: 'tag-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'tag-b' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Matching any selected tag · 2 results')).toBeInTheDocument();
  });

  it('expands the overview shelf fully in place at or below 25 collections', async () => {
    mockGetAll.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `c-${i + 1}`,
        title: `Collection ${i + 1}`,
        order: i,
        createdAt: now,
        updatedAt: now,
      })),
    );
    renderScreen();

    // Shelf card names concatenate title + count without a space. Here every
    // collection counts 1 link, so "Collection 1" reads as "Collection 11 material".
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Collection 11 material/ })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Six preview cards; the rest stay behind the stepper.
    expect(screen.getByRole('button', { name: /Collection 61 material/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Collection 7\d material/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more collections' }));
    expect(screen.getByRole('button', { name: /Collection 7\d material/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 8 of 8')).toBeInTheDocument();

    // Eight fits the last step — no tab jump, the shelf just shows everything.
    expect(screen.queryByRole('button', { name: /View all \d+ collections/ })).not.toBeInTheDocument();
    expect(mockViewChange).not.toHaveBeenCalled();
  });

  it('hides Show more once the stepper already reveals every material', async () => {
    renderScreen(undefined, [
      { id: 'm-1', title: 'M1', documentId: 'doc-1', createdAt: now, updatedAt: now },
      { id: 'm-2', title: 'M2', documentId: 'doc-2', createdAt: now, updatedAt: now },
      { id: 'm-3', title: 'M3', documentId: 'doc-3', createdAt: now, updatedAt: now },
      { id: 'm-4', title: 'M4', documentId: 'doc-4', createdAt: now, updatedAt: now },
      { id: 'm-5', title: 'M5', documentId: 'doc-5', createdAt: now, updatedAt: now },
      { id: 'm-6', title: 'M6', documentId: 'doc-6', createdAt: now, updatedAt: now },
      { id: 'm-7', title: 'M7', documentId: 'doc-7', createdAt: now, updatedAt: now },
    ]);

    await waitFor(() => {
      expect(screen.getByText('M6')).toBeInTheDocument();
    });
    expect(screen.queryByText('M7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more materials' }));
    expect(screen.getByText('M7')).toBeInTheDocument();
    expect(screen.getByText('Showing 7 of 7')).toBeInTheDocument();

    // All seven show at level 1 — no further step to offer, no tab jump.
    expect(screen.queryByRole('button', { name: 'Show more materials' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show fewer materials' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View all \d+ materials/ })).not.toBeInTheDocument();
  });

  it('keeps the view-all tab jump past 25 collections', async () => {
    mockGetAll.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        id: `c-${i + 1}`,
        title: `Collection ${i + 1}`,
        order: i,
        createdAt: now,
        updatedAt: now,
      })),
    );
    renderScreen();

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Collection 11 material/ })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show more collections' }));
    expect(screen.getByText('Showing 12 of 30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View all 30 collections' }));
    expect(mockViewChange).toHaveBeenCalledWith('collections');
  });

  it('scopes tag pills to the search result set', async () => {
    renderScreen(undefined, [
      { id: 'm-1', title: 'Biology Basics', documentId: 'doc-1', tags: ['biology', 'cell'], createdAt: now, updatedAt: now },
      { id: 'm-2', title: 'Algebra', documentId: 'doc-2', tags: ['math'], createdAt: now, updatedAt: now },
    ]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'math' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Search your materials/), {
      target: { value: 'biology' },
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'math' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'biology' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cell' })).toBeInTheDocument();
  });

  it('scopes tag pills to the membership lens', async () => {
    renderScreen('collected', [
      { id: 'm-1', title: 'Kinematics', documentId: 'doc-1', tags: ['physics'], createdAt: now, updatedAt: now },
      { id: 'm-2', title: 'Loose Note', documentId: 'doc-2', tags: ['personal'], createdAt: now, updatedAt: now },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Kinematics')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'physics' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'personal' })).not.toBeInTheDocument();
  });
});
