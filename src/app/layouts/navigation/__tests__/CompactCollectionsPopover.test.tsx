import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompactCollectionsPopover } from '../CompactCollectionsPopover';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { Collection } from '../../../../domain/collections/models/Collection';
import type { AppRoute } from '../../../routing/routing';

describe('CompactCollectionsPopover', () => {
  let queryClient: QueryClient;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockGetByCollectionId: ReturnType<typeof vi.fn>;
  let mockGetMaterialById: ReturnType<typeof vi.fn>;
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
    mockGetByCollectionId = vi
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(
          id === 'c-1'
            ? [{ id: 1, collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: now }]
            : [],
        ),
      );
    mockGetMaterialById = vi.fn().mockResolvedValue(null);
    mockCreateExecute = vi.fn().mockResolvedValue({ id: 'c-new', title: 'Chemistry', order: 2, createdAt: now, updatedAt: now });
    mockNavigate = vi.fn();

    Element.prototype.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 400,
          bottom: 444,
          left: 16,
          right: 60,
          width: 44,
          height: 44,
          x: 16,
          y: 400,
          toJSON: () => ({}),
        }) as DOMRect,
    );
  });

  function renderPopover(
    activeCollectionId?: string | null,
    placement: 'rail' | 'dock' = 'rail',
  ) {
    const mockContextValue = {
      repositories: {
        collection: { getAll: mockGetAll },
        collectionMaterial: { getByCollectionId: mockGetByCollectionId },
        library: { getMaterialById: mockGetMaterialById },
      },
      useCases: { collections: { createCollection: { execute: mockCreateExecute } } },
    } as unknown as ApplicationContextValue;

    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <CompactCollectionsPopover
              placement={placement}
              activeCollectionId={activeCollectionId}
              onNavigate={mockNavigate}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('opens the panel when the trigger is clicked and shows collections', async () => {
    
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Physics' })).toBeInTheDocument();
    });

    expect(screen.getByRole('menuitem', { name: 'Math' })).toBeInTheDocument();
  });

  it('shows count badges only for non-empty collections', async () => {
    
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));

    await waitFor(() => {
      expect(
        within(screen.getByRole('menuitem', { name: 'Physics' })).getByText('1'),
      ).toBeInTheDocument();
    });

    expect(
      within(screen.getByRole('menuitem', { name: 'Math' })).queryByText('0'),
    ).not.toBeInTheDocument();
  });

  it('navigates to a collection when its row is clicked', async () => {
    
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Physics' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Physics' }));
    expect(mockNavigate).toHaveBeenCalledWith({ kind: 'collection', collectionId: 'c-1' });
  });

  it('highlights the trigger and the active collection row when on a collection route', async () => {
    
    renderPopover('c-2');

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Math' })).toBeInTheDocument();
    });

    expect(screen.getByRole('menuitem', { name: 'Math' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('closes the panel on Escape', async () => {
    
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('opens CreateCollectionModal from the New Collection affordance and navigates on save', async () => {
    
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'New Collection' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('menuitem', { name: 'New Collection' }));

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

  it('shows the empty state when there are no collections', async () => {
    mockGetAll.mockResolvedValue([]);

    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
    await waitFor(() => {
      expect(screen.getByText(/No collections yet/i)).toBeInTheDocument();
    });
  });

  describe('mobile bottom drawer (placement="dock")', () => {
    it('opens as a bottom drawer dialog and locks body scroll', async () => {
      renderPopover(null, 'dock');

      const trigger = screen.getByRole('button', { name: 'Collections' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
      });

      expect(document.body.style.overflow).toBe('hidden');
      expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Physics' })).toBeInTheDocument();
      });
      expect(screen.getByRole('menuitem', { name: 'Math' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'New Collection' })).toBeInTheDocument();
    });

    it('closes the drawer and unlocks body scroll when the close button is clicked', async () => {
      renderPopover(null, 'dock');

      fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close collections' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Collections' })).not.toBeInTheDocument();
      });

      expect(document.body.style.overflow).toBe('');
    });

    it('closes the drawer when the backdrop is clicked', async () => {
      renderPopover(null, 'dock');

      fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
      });

      // The native modal renders its backdrop as a ::backdrop pseudo-element,
      // not a DOM node, so a backdrop click dispatches on the <dialog> itself.
      fireEvent.click(screen.getByRole('dialog', { name: 'Collections' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Collections' })).not.toBeInTheDocument();
      });
    });

    it('closes the drawer when swiped down by more than 60px', async () => {
      renderPopover(null, 'dock');

      fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
      });

      const heading = screen.getByRole('heading', { name: 'Collections' });
      fireEvent.touchStart(heading, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(heading, { touches: [{ clientY: 180 }] }); // delta = 80 > 60
      fireEvent.touchEnd(heading);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Collections' })).not.toBeInTheDocument();
      });
    });

    it('autohides the mobile bottom drawer when window width resizes beyond 768px', async () => {
      window.innerWidth = 400;
      renderPopover(null, 'dock');

      fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
      });

      // Resize window across mobile breakpoint into tablet/desktop (e.g. 800px)
      window.innerWidth = 800;
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Collections' })).not.toBeInTheDocument();
      });
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('viewport breakpoint autohide', () => {
    it('autohides the tablet rail popover when window resizes below 769px or above 1023px', async () => {
      window.innerWidth = 900;
      renderPopover(null, 'rail');

      fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
      await waitFor(() => {
        expect(screen.getByRole('menu', { name: 'Collections' })).toBeInTheDocument();
      });

      // Resize window into desktop (>1023px)
      window.innerWidth = 1200;
      fireEvent(window, new Event('resize'));

      await waitFor(() => {
        expect(screen.queryByRole('menu', { name: 'Collections' })).not.toBeInTheDocument();
      });
    });

    it('autohides via matchMedia change event when viewport media query stops matching', async () => {
      let listenerCallback: ((e: any) => void) | null = null;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, cb: any) => {
          if (event === 'change') listenerCallback = cb;
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderPopover(null, 'dock');

      fireEvent.click(screen.getByRole('button', { name: 'Collections' }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Collections' })).toBeInTheDocument();
      });

      // Trigger matchMedia change event with matches: false (e.g. rotated device or breakpoint switch)
      expect(listenerCallback).toBeTruthy();
      act(() => {
        listenerCallback!({ matches: false } as MediaQueryListEvent);
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Collections' })).not.toBeInTheDocument();
      });
    });
  });
});
