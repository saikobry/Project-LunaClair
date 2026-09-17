import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MaterialCard } from '../MaterialCard';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Collection } from '../../../../domain/collections/models/Collection';

const now = '2026-09-01T00:00:00.000Z';

const material: StudyMaterial = {
  id: 'mat-1',
  title: 'Cell Biology',
  documentId: 'doc-1',
  createdAt: now,
  updatedAt: now,
};

const collections: Collection[] = [
  { id: 'c-1', title: 'Physics', order: 0, createdAt: now, updatedAt: now },
  { id: 'c-2', title: 'Math', order: 1, createdAt: now, updatedAt: now },
];

/**
 * The card popover is now the single material-to-collection assignment surface
 * (the former `ManageMaterialCollectionsModal` was removed in favour of it), so
 * these behaviours are load-bearing:
 *  - it stays open across toggles (multi-assign in one pass)
 *  - a row is disabled while its mutation is in flight (no double-fire)
 */
describe('MaterialCard collection popover', () => {
  let queryClient: QueryClient;
  let mockGetByMaterialId: ReturnType<typeof vi.fn>;
  let mockAddExecute: ReturnType<typeof vi.fn>;
  let mockRemoveExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetByMaterialId = vi.fn().mockResolvedValue([]);
    mockAddExecute = vi.fn().mockResolvedValue(undefined);
    mockRemoveExecute = vi.fn().mockResolvedValue(undefined);
  });

  function renderCard() {
    const mockContextValue = {
      repositories: {
        collection: { getAll: vi.fn().mockResolvedValue(collections) },
        collectionMaterial: { getByMaterialId: mockGetByMaterialId },
        library: { getMaterials: vi.fn().mockResolvedValue([material]) },
      },
      useCases: {
        collections: {
          addMaterialToCollection: { execute: mockAddExecute },
          removeMaterialFromCollection: { execute: mockRemoveExecute },
        },
      },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <MaterialCard material={material} onOpen={vi.fn()} />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  /** The popover's toggle list — scoped so card badges don't match the same names. */
  async function openPopover() {
    fireEvent.click(
      screen.getByRole('button', { name: `Add ${material.title} to collections` }),
    );
    const list = await waitFor(() => screen.getByRole('group', { name: 'Collections' }));
    // The collection list resolves asynchronously; the popover mounts before it.
    await waitFor(() => {
      expect(within(list).getByRole('button', { name: /Physics/ })).toBeInTheDocument();
    });
    return list;
  }

  it('stays open after toggling a collection so several can be assigned in one pass', async () => {
    renderCard();
    const list = await openPopover();

    fireEvent.click(within(list).getByRole('button', { name: /Physics/ }));

    await waitFor(() => {
      expect(mockAddExecute).toHaveBeenCalledWith('c-1', 'mat-1');
    });

    // The popover must still be mounted after the mutation resolves.
    expect(screen.getByText('Add to collections')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /Math/ })).toBeInTheDocument();
  });

  it('disables the toggled row while its mutation is in flight', async () => {
    let resolveToggle: (() => void) | undefined;
    mockAddExecute.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveToggle = resolve;
        }),
    );

    renderCard();
    const list = await openPopover();

    const physicsRow = within(list).getByRole('button', { name: /Physics/ });
    fireEvent.click(physicsRow);

    await waitFor(() => {
      expect(physicsRow).toBeDisabled();
    });
    expect(physicsRow).toHaveAttribute('aria-busy', 'true');

    // Resolving releases the row.
    resolveToggle?.();
    await waitFor(() => {
      expect(physicsRow).not.toBeDisabled();
    });
  });

  it('removes a material from a collection it already belongs to', async () => {
    mockGetByMaterialId.mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'mat-1', order: 0, addedAt: now },
    ]);

    renderCard();
    const list = await openPopover();

    fireEvent.click(within(list).getByRole('button', { name: /Physics/ }));

    await waitFor(() => {
      expect(mockRemoveExecute).toHaveBeenCalledWith('c-1', 'mat-1');
    });
    expect(mockAddExecute).not.toHaveBeenCalled();
  });
});

/**
 * Whole-card pointer affordance: body clicks open the
 * material, while badges, the filing trigger, and menu items keep their own
 * actions without double-firing into `onOpen`.
 */
describe('MaterialCard whole-card open', () => {
  let queryClient: QueryClient;
  let mockGetByMaterialId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetByMaterialId = vi.fn().mockResolvedValue([]);
  });

  function renderOverflowCard() {
    const collections3: Collection[] = [
      ...collections,
      { id: 'c-3', title: 'Chemistry', order: 2, createdAt: now, updatedAt: now },
    ];
    const mockContextValue = {
      repositories: {
        collection: { getAll: vi.fn().mockResolvedValue(collections3) },
        collectionMaterial: { getByMaterialId: mockGetByMaterialId },
        library: { getMaterials: vi.fn().mockResolvedValue([material]) },
      },
      useCases: {
        collections: {
          addMaterialToCollection: { execute: vi.fn().mockResolvedValue(undefined) },
          removeMaterialFromCollection: { execute: vi.fn().mockResolvedValue(undefined) },
        },
      },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <MaterialCard material={material} onOpen={vi.fn()} />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    return { rerenderWithCollections: () => undefined };
  }

  function renderOpenCard(handlers: {
    onOpen?: (m: StudyMaterial) => void;
    onNavigate?: (id: string) => void;
    onToggleTag?: (tag: string) => void;
    selectedTags?: string[];
    onStartQuiz?: (m: StudyMaterial) => void;
  }) {
    const mockContextValue = {
      repositories: {
        collection: { getAll: vi.fn().mockResolvedValue(collections) },
        collectionMaterial: { getByMaterialId: mockGetByMaterialId },
        library: { getMaterials: vi.fn().mockResolvedValue([material]) },
      },
      useCases: {
        collections: {
          addMaterialToCollection: { execute: vi.fn().mockResolvedValue(undefined) },
          removeMaterialFromCollection: { execute: vi.fn().mockResolvedValue(undefined) },
        },
      },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <MaterialCard
              material={{ ...material, description: 'A body click opens me', tags: ['physics'] }}
              onOpen={handlers.onOpen ?? vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
              onNavigate={handlers.onNavigate}
              onToggleTag={handlers.onToggleTag}
              selectedTags={handlers.selectedTags}
              onStartQuiz={handlers.onStartQuiz}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  function renderTagOverflowCard(handlers: {
    onToggleTag: (tag: string) => void;
    selectedTags?: string[];
  }) {
    const tagged: StudyMaterial = {
      ...material,
      tags: ['tag-a', 'tag-b', 'tag-c', 'tag-d', 'tag-e'],
    };
    const mockContextValue = {
      repositories: {
        collection: { getAll: vi.fn().mockResolvedValue(collections) },
        collectionMaterial: { getByMaterialId: mockGetByMaterialId },
        library: { getMaterials: vi.fn().mockResolvedValue([tagged]) },
      },
      useCases: {
        collections: {
          addMaterialToCollection: { execute: vi.fn().mockResolvedValue(undefined) },
          removeMaterialFromCollection: { execute: vi.fn().mockResolvedValue(undefined) },
        },
      },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <MaterialCard
              material={tagged}
              onOpen={vi.fn()}
              onToggleTag={handlers.onToggleTag}
              selectedTags={handlers.selectedTags}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('opens the material when the card body is clicked', async () => {
    const onOpen = vi.fn();
    renderOpenCard({ onOpen });

    await waitFor(() => {
      expect(screen.getByText('A body click opens me')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('A body click opens me'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mat-1' }),
    );
  });

  it('opens the material from the action menu', async () => {
    const onOpen = vi.fn();
    renderOpenCard({ onOpen });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Card actions' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Card actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Open/ }));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mat-1' }),
    );
  });

  it('navigates without opening when a collection badge is clicked', async () => {
    mockGetByMaterialId.mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'mat-1', order: 0, addedAt: now },
    ]);
    const onOpen = vi.fn();
    const onNavigate = vi.fn();
    renderOpenCard({ onOpen, onNavigate });

    const badge = await waitFor(() =>
      screen.getByRole('button', { name: 'Physics' }),
    );
    fireEvent.click(badge);

    expect(onNavigate).toHaveBeenCalledWith('c-1');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('toggles the library tag filter without opening when a card tag is clicked', async () => {
    const onOpen = vi.fn();
    const onToggleTag = vi.fn();
    renderOpenCard({ onOpen, onToggleTag });

    const tag = await waitFor(() =>
      screen.getByRole('button', { name: '#physics' }),
    );
    expect(tag).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tag);

    expect(onToggleTag).toHaveBeenCalledWith('physics');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('marks selected filter tags as pressed on the card', async () => {
    renderOpenCard({ onToggleTag: vi.fn(), selectedTags: ['physics'] });

    const tag = await waitFor(() =>
      screen.getByRole('button', { name: '#physics' }),
    );
    expect(tag).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts the quiz from the footer link without opening the card twice', async () => {
    const onOpen = vi.fn();
    const onStartQuiz = vi.fn();
    renderOpenCard({ onOpen, onStartQuiz });

    const quiz = await waitFor(() =>
      screen.getByRole('button', { name: 'Start quiz for Cell Biology' }),
    );
    fireEvent.click(quiz);

    expect(onStartQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mat-1' }),
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('collapses badges past two into a +N pill that opens the filing popover', async () => {
    mockGetByMaterialId.mockResolvedValue([
      { id: 1, collectionId: 'c-1', materialId: 'mat-1', order: 0, addedAt: now },
      { id: 2, collectionId: 'c-2', materialId: 'mat-1', order: 1, addedAt: now },
      { id: 3, collectionId: 'c-3', materialId: 'mat-1', order: 2, addedAt: now },
    ]);
    renderOverflowCard();

    const overflow = await waitFor(() =>
      screen.getByRole('button', { name: '+1' }),
    );
    fireEvent.click(overflow);

    const list = await waitFor(() =>
      screen.getByRole('group', { name: 'Collections' }),
    );
    expect(within(list).getByRole('button', { name: /Physics/ })).toBeInTheDocument();
  });

  it('collapses tags past three into a +N pill opening the all-tags popover', async () => {
    const onToggleTag = vi.fn();
    renderTagOverflowCard({ onToggleTag });

    const overflow = await waitFor(() =>
      screen.getByRole('button', { name: '+2' }),
    );
    // A hidden selected tag highlights the overflow pill.
    expect(overflow).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(overflow);

    const list = await waitFor(() =>
      screen.getByRole('group', { name: 'Tags' }),
    );
    fireEvent.click(within(list).getByRole('button', { name: '#tag-d' }));
    expect(onToggleTag).toHaveBeenCalledWith('tag-d');
    // The viewer stays open across toggles.
    expect(screen.getByRole('group', { name: 'Tags' })).toBeInTheDocument();
  });
});
