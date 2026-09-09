import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesktopSidebar } from '../DesktopSidebar';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { Collection } from '../../../../domain/collections/models/Collection';
import type { AppRoute } from '../../../routing/routing';

describe('DesktopSidebar collections section', () => {
  let queryClient: QueryClient;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockCreateExecute: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn<(route: AppRoute) => void>>;

  const now = '2026-08-01T00:00:00.000Z';
  const collections: Collection[] = [
    { id: 'c-1', title: 'Physics', icon: 'star', color: '#60a5fa', order: 0, createdAt: now, updatedAt: now },
    { id: 'c-2', title: 'Math', order: 1, createdAt: now, updatedAt: now },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetAll = vi.fn().mockResolvedValue(collections);
    mockCreateExecute = vi.fn().mockResolvedValue({
      id: 'c-new',
      title: 'Chemistry',
      order: 2,
      createdAt: now,
      updatedAt: now,
    });
    mockNavigate = vi.fn();
  });

  function renderSidebar(collectionId?: string | null) {
    const mockContextValue = {
      repositories: { collection: { getAll: mockGetAll } },
      useCases: { collections: { createCollection: { execute: mockCreateExecute } } },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <DesktopSidebar
              active="none"
              isFocusMode={false}
              onToggleFocusMode={vi.fn()}
              onNavigate={mockNavigate}
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
});
