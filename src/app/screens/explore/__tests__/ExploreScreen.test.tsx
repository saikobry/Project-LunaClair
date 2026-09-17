import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExploreScreen, type ExploreFilters } from '../ExploreScreen';
import { ApplicationContext } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const mockPublicShares = {
  items: [
    {
      id: 'share_chem',
      format: 'lcpack',
      schemaVersion: 1,
      title: 'Organic Chemistry High Yield',
      description: 'Reaction mechanisms and synthesis',
      author: 'prof_dan',
      viewCount: 120,
      downloadCount: 45,
      createdAt: '2026-08-28T00:00:00.000Z',
    },
    {
      id: 'share_bio',
      format: 'lcpack',
      schemaVersion: 1,
      title: 'Cell Biology Master Pack',
      description: 'Official curriculum cell biology package',
      author: 'Saiko Interactive',
      isVerified: true,
      viewCount: 300,
      downloadCount: 80,
      createdAt: '2026-08-29T00:00:00.000Z',
    },
  ],
  nextCursor: null,
  hasMore: false,
};

describe('ExploreScreen (shares-only)', () => {
  let mockContext: any;
  // Declared with the prop signatures so the spies satisfy `ExploreScreenProps`.
  let onOpenShare: (shareId: string) => void;
  let onFiltersChange: (next: ExploreFilters) => void;
  let onOpenMaterial: (materialId: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    onOpenShare = vi.fn();
    onFiltersChange = vi.fn();
    onOpenMaterial = vi.fn();

    mockContext = {
      repositories: {
        library: {
          getMaterials: vi.fn().mockResolvedValue([]),
        },
      },
      useCases: {
        sharing: {
          listPublicShares: {
            execute: vi.fn().mockImplementation((params: any) => {
              const q = params?.q?.toLowerCase() || '';
              const filtered = mockPublicShares.items.filter(
                (item) =>
                  !q ||
                  item.title.toLowerCase().includes(q) ||
                  (item.description && item.description.toLowerCase().includes(q)),
              );
              return Promise.resolve({
                items: filtered,
                nextCursor: null,
                hasMore: false,
              });
            }),
          },
          clonePublishedShare: {
            execute: vi.fn().mockResolvedValue({
              share: mockPublicShares.items[0],
              importResult: { materialIds: ['mat_new_chem'], questionIds: [], quizIds: [], assetIds: [], idMap: new Map() },
            }),
          },
        },
      },
    };
  });

  // `q`/`sort` are URL state, so the screen receives them and reports changes
  // upward; the shell owns applying them.
  const renderComponent = (filters: { q?: string; sort?: 'popular' | 'recent' } = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContext}>
          <ToastProvider>
            <ExploreScreen
              q={filters.q}
              sort={filters.sort}
              onFiltersChange={onFiltersChange}
              onOpenShare={onOpenShare}
              onOpenMaterial={onOpenMaterial}
            />
          </ToastProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );

  it('renders unified share cards with verified/community badges, author, and stats', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
      expect(screen.getByText('Cell Biology Master Pack')).toBeInTheDocument();
    });

    expect(screen.getByText('Verified Course')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('prof_dan')).toBeInTheDocument();
    // Byline stats render icon + bare number; the wording lives on aria-label.
    expect(screen.getByLabelText('45 downloads')).toBeInTheDocument();
    expect(screen.getByLabelText('120 views')).toBeInTheDocument();
  });

  it('derives exact clone identity from originShareId (no title matching)', async () => {
    // A local material cloned from share_chem — but with a completely
    // different title than the share, proving identity is ID-based.
    mockContext.repositories.library.getMaterials.mockResolvedValue([
      {
        id: 'local_mat_1',
        title: 'My Renamed Chem Notes',
        originShareId: 'share_chem',
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('In My Library')).toBeInTheDocument();
    });

    // The cloned share's card is no longer a dead end: its action is the next
    // step into the library, and no Clone control remains for it.
    expect(
      screen.getByRole('button', { name: 'Open Organic Chemistry High Yield in your library' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: /Clone Organic Chemistry High Yield/ }),
    ).not.toBeInTheDocument();

    const freshButton = screen.getByRole('button', { name: /Clone Cell Biology Master Pack/ });
    expect(freshButton).toBeEnabled();
  });

  it('opens the cloned share\'s local material from the card next step', async () => {
    mockContext.repositories.library.getMaterials.mockResolvedValue([
      {
        id: 'local_mat_1',
        title: 'My Renamed Chem Notes',
        originShareId: 'share_chem',
      },
    ]);

    renderComponent();

    const openInLibrary = await screen.findByRole('button', {
      name: 'Open Organic Chemistry High Yield in your library',
    });

    fireEvent.click(openInLibrary);

    // The local material behind the card — resolved through originShareId,
    // never title matching — not the share landing route.
    expect(onOpenMaterial).toHaveBeenCalledWith('local_mat_1');
    expect(onOpenShare).not.toHaveBeenCalled();
  });

  it('keeps a stable Open-in-library target when a share was cloned twice', async () => {
    mockContext.repositories.library.getMaterials.mockResolvedValue([
      { id: 'local_first', title: 'Chem copy A', originShareId: 'share_chem' },
      { id: 'local_second', title: 'Chem copy B', originShareId: 'share_chem' },
    ]);

    renderComponent();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Open Organic Chemistry High Yield in your library',
      }),
    );

    expect(onOpenMaterial).toHaveBeenCalledWith('local_first');
  });

  it('does not mark shares as in-library on title collision alone', async () => {
    mockContext.repositories.library.getMaterials.mockResolvedValue([
      {
        id: 'local_mat_1',
        title: 'organic chemistry high yield', // same title, no originShareId
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    expect(screen.queryByText('In My Library')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clone Organic Chemistry High Yield/ })).toBeEnabled();
  });

  it('passes the committed query to the public shares fetch', async () => {
    renderComponent({ q: 'mechanisms' });

    await waitFor(() => {
      expect(mockContext.useCases.sharing.listPublicShares.execute).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'mechanisms' }),
        expect.anything(),
      );
    });
  });

  it('debounces typing into a single committed filter change', async () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText('Search study packages, authors...');
    fireEvent.change(searchInput, { target: { value: 'mech' } });
    fireEvent.change(searchInput, { target: { value: 'mechanisms' } });

    // The input is responsive immediately; the URL is not touched per keystroke.
    expect(searchInput).toHaveValue('mechanisms');
    expect(onFiltersChange).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledTimes(1);
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ q: 'mechanisms', sort: undefined });
  });

  it('commits a cleared query as undefined so the URL stays canonical', async () => {
    // A query with no matches, so the empty state (and its Clear search
    // action) is on screen.
    renderComponent({ q: 'quantum chromodynamics' });

    await waitFor(() => {
      expect(screen.getByText('No study packages found')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onFiltersChange).toHaveBeenCalledWith({ q: undefined, sort: undefined });
  });

  it('does not publish a stale query when the URL changes from outside (Back)', async () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContext}>
          <ToastProvider>
            <ExploreScreen
              q="mechanisms"
              onFiltersChange={onFiltersChange}
              onOpenShare={onOpenShare}
              onOpenMaterial={onOpenMaterial}
            />
          </ToastProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    // Back/Forward drops the query from the URL. The draft re-seeds, and the
    // settling debounce must not re-publish the pre-Back query.
    rerender(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContext}>
          <ToastProvider>
            <ExploreScreen
              onFiltersChange={onFiltersChange}
              onOpenShare={onOpenShare}
              onOpenMaterial={onOpenMaterial}
            />
          </ToastProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cell Biology Master Pack')).toBeInTheDocument();
    });

    expect(onFiltersChange).not.toHaveBeenCalled();
  });

  it('reports a sort change upward instead of storing it locally', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    // Sort is the shared segmented control (a radiogroup), not a bespoke
    // select — the vocabulary every other screen uses.
    expect(screen.getByRole('radiogroup', { name: 'Sort explore items' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Recent' }));

    expect(onFiltersChange).toHaveBeenCalledWith({ q: undefined, sort: 'recent' });
  });

  it('shows how many results are on screen, pluralized', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });
  });

  it('counts only the results that matched the committed query', async () => {
    renderComponent({ q: 'mechanisms' });

    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });

    expect(screen.queryByText('2 results')).not.toBeInTheDocument();
  });

  it('omits the result count when the empty state is showing', async () => {
    renderComponent({ q: 'quantum chromodynamics' });

    await waitFor(() => {
      expect(screen.getByText('No study packages found')).toBeInTheDocument();
    });

    expect(screen.queryByText(/\d+ results?/)).not.toBeInTheDocument();
  });

  it('opens the share from the card title — a real button, not a button-role shell', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    const openControl = screen.getByRole('button', { name: 'Organic Chemistry High Yield' });
    // The accessible name is the visible title text, and the control is a real
    // <button> — the keyboard/AT path to the share. No role="button" shell is
    // left on the card wrapping the nested action buttons.
    expect(openControl.tagName).toBe('BUTTON');

    fireEvent.click(openControl);

    expect(onOpenShare).toHaveBeenCalledWith('share_chem');
  });

  it('opens the share from a card-body click (whole-card pointer affordance)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Reaction mechanisms and synthesis')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reaction mechanisms and synthesis'));

    expect(onOpenShare).toHaveBeenCalledWith('share_chem');
  });

  it('does not open the share when a nested action is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Clone Organic Chemistry High Yield/ }));

    expect(onOpenShare).not.toHaveBeenCalled();
  });

  it('triggers 1-click clone on Clone button click', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Clone Organic Chemistry High Yield/ }));

    await waitFor(() => {
      expect(mockContext.useCases.sharing.clonePublishedShare.execute).toHaveBeenCalledWith({
        shareId: 'share_chem',
        passcode: undefined,
      });
    });
  });
});
