import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesktopSidebar } from '../DesktopSidebar';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { Collection } from '../../../../domain/collections/models/Collection';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { AppRoute } from '../../../routing/routing';
import type { NavActiveSection } from '../navigation.types';

describe('DesktopSidebar collections section', () => {
  let queryClient: QueryClient;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockCreateExecute: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn<(route: AppRoute) => void>>;

  const now = '2026-08-01T00:00:00.000Z';
  const collections: Collection[] = [
    { id: 'c-1', title: 'Physics', icon: 'star', color: '#60a5fa', order: 0, createdAt: now, updatedAt: now },
    { id: 'c-2', title: 'Math', order: 1, createdAt: now, updatedAt: now },
  ];
  const materials: StudyMaterial[] = [
    { id: 'm-1', title: 'Kinematics', documentId: 'doc-1', createdAt: now, updatedAt: now },
    { id: 'm-2', title: 'Algebra', documentId: 'doc-2', createdAt: now, updatedAt: now },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetAll = vi.fn().mockResolvedValue(collections);
    // c-1 holds m-1; c-2 is empty — m-2 stays unassigned (unfiled).
    mockGetByCollectionId = vi
      .fn()
      .mockImplementation((collectionId: string) =>
        Promise.resolve(
          collectionId === 'c-1'
            ? [{ id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now }]
            : [],
        ),
      );
    mockGetMaterials = vi.fn().mockResolvedValue(materials);
    mockCreateExecute = vi.fn().mockResolvedValue({
      id: 'c-new',
      title: 'Chemistry',
      order: 2,
      createdAt: now,
      updatedAt: now,
    });
    mockNavigate = vi.fn();
  });

  function renderSidebar(
    collectionId?: string | null,
    active: NavActiveSection = 'none',
    material?: StudyMaterial | null,
  ) {
    const mockGetMaterialById = vi.fn().mockResolvedValue(material);
    const mockContextValue = {
      repositories: {
        collection: { getAll: mockGetAll },
        collectionMaterial: { getByCollectionId: mockGetByCollectionId },
        library: { getMaterials: mockGetMaterials, getMaterialById: mockGetMaterialById },
      },
      useCases: { collections: { createCollection: { execute: mockCreateExecute } } },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <DesktopSidebar
              active={active}
              isFocusMode={false}
              onToggleFocusMode={vi.fn()}
              onNavigate={mockNavigate}
              material={material}
              materialTab={material ? 'write' : undefined}
              collectionId={collectionId}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('renders the Collections section with one nav item per collection', async () => {
    renderSidebar();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Physics' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Physics' })).toHaveAttribute(
      'title',
      'Collection: Physics',
    );
    expect(screen.getByRole('button', { name: 'Math' })).toBeInTheDocument();
  });

  it('shows material count badges for collections', async () => {
    renderSidebar();

    await waitFor(() => {
      expect(
        within(screen.getByRole('button', { name: 'Physics' })).getByText('1'),
      ).toBeInTheDocument();
    });

    // Empty collections render no badge.
    expect(
      within(screen.getByRole('button', { name: 'Math' })).queryByText('0'),
    ).not.toBeInTheDocument();
  });

  it('shows the unfiled nav item with the unassigned count and navigates to it', async () => {
    renderSidebar();

    const desktopNav = await screen.findByRole('navigation', { name: 'Desktop Navigation' });
    const unfiledButton = within(desktopNav).getByRole('button', { name: 'Unfiled' });
    await waitFor(() => {
      expect(within(unfiledButton).getByText('1')).toBeInTheDocument();
    });

    fireEvent.click(unfiledButton);
    expect(mockNavigate).toHaveBeenCalledWith({ kind: 'unfiled' });
  });

  it('marks the unfiled nav item active on the unfiled section', async () => {
    renderSidebar(null, 'unfiled');

    const desktopNav = await screen.findByRole('navigation', { name: 'Desktop Navigation' });
    expect(within(desktopNav).getByRole('button', { name: 'Unfiled' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('navigates to the collection route when a collection is clicked', async () => {
    renderSidebar();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Physics' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Physics' }));
    expect(mockNavigate).toHaveBeenCalledWith({ kind: 'collection', collectionId: 'c-1' });
  });

  it('marks the active collection with aria-current', async () => {
    renderSidebar('c-2');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Math' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Math' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Physics' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('creates a collection via quick-add and navigates to it', async () => {
    renderSidebar();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Collection' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New Collection' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Chemistry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Collection' }));

    await waitFor(() => {
      expect(mockCreateExecute).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Chemistry' }),
      );
      expect(mockNavigate).toHaveBeenCalledWith({ kind: 'collection', collectionId: 'c-new' });
    });
  });

  it('does not render an active material nav item in the sidebar', async () => {
    renderSidebar(undefined, 'none', materials[0]);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Desktop Navigation' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Kinematics' })).not.toBeInTheDocument();
  });
});
