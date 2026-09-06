import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExploreScreen } from '../ExploreScreen';
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
  const onOpenShare = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

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

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContext}>
          <ToastProvider>
            <ExploreScreen onOpenShare={onOpenShare} />
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
    expect(screen.getByText('45 downloads')).toBeInTheDocument();
    expect(screen.getByText('120 views')).toBeInTheDocument();
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

    const clonedButton = screen.getByRole('button', { name: /Clone Organic Chemistry High Yield/ });
    expect(clonedButton).toBeDisabled();

    const freshButton = screen.getByRole('button', { name: /Clone Cell Biology Master Pack/ });
    expect(freshButton).toBeEnabled();
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

  it('filters shares through the public shares search query', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search study packages, authors...');
    fireEvent.change(searchInput, { target: { value: 'mechanisms' } });

    await waitFor(() => {
      expect(mockContext.useCases.sharing.listPublicShares.execute).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'mechanisms' }),
        expect.anything(),
      );
    });
  });

  it('navigates to share landing on View button click', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'View Share Organic Chemistry High Yield' }),
    );

    expect(onOpenShare).toHaveBeenCalledWith('share_chem');
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
        targetSubjectId: undefined,
        targetTermId: undefined,
      });
    });
  });
});
