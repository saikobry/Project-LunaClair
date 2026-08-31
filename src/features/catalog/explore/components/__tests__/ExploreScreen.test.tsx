import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExploreScreen } from '../ExploreScreen';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../../app/providers/ToastContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const mockOfficialCatalog = {
  subjects: [{ id: 'sub_bio', title: 'Biology' }],
  terms: [{ id: 'term_1', title: 'Prelim' }],
  subjectTerms: [],
  materials: [
    {
      id: 'mat_cell',
      title: 'Cell Structure',
      description: 'Introduction to cell organelles',
      subjectId: 'sub_bio',
      termId: 'term_1',
      updatedAt: '2026-08-28T00:00:00.000Z',
    },
  ],
};

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
  ],
  nextCursor: null,
  hasMore: false,
};

describe('ExploreScreen', () => {
  let mockContext: any;
  const onOpenMaterial = vi.fn();
  const onPreview = vi.fn();
  const onOpenShare = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    mockContext = {
      infrastructure: {
        repositories: {
          catalog: {
            getCatalog: vi.fn().mockResolvedValue(mockOfficialCatalog),
          },
          library: {
            getMaterials: vi.fn().mockResolvedValue([]),
          },
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
              importResult: { materials: [{ id: 'mat_new_chem' }] },
            }),
          },
        },
        library: {
          importMaterial: {
            execute: vi.fn().mockResolvedValue({}),
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
            <ExploreScreen
              onOpenMaterial={onOpenMaterial}
              onPreview={onPreview}
              onOpenShare={onOpenShare}
            />
          </ToastProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );

  it('renders both official course materials and community study packages in All tab', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument();
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    expect(screen.getByText('Verified Course')).toBeInTheDocument();
    expect(screen.getAllByText('Community').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('prof_dan')).toBeInTheDocument();
    expect(screen.getByText('45 downloads')).toBeInTheDocument();
  });

  it('filters by source tab when Official or Community is selected', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument();
    });

    // Click Official filter tab
    const officialTab = screen.getByRole('radio', { name: 'Official' });
    fireEvent.click(officialTab);

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument();
      expect(screen.queryByText('Organic Chemistry High Yield')).not.toBeInTheDocument();
    });

    // Click Community filter tab
    const communityTab = screen.getByRole('radio', { name: 'Community' });
    fireEvent.click(communityTab);

    await waitFor(() => {
      expect(screen.queryByText('Cell Structure')).not.toBeInTheDocument();
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });
  });

  it('filters items by search input', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search materials, subjects, authors...');
    fireEvent.change(searchInput, { target: { value: 'organelles' } });

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument();
      expect(screen.queryByText('Organic Chemistry High Yield')).not.toBeInTheDocument();
    });
  });

  it('navigates to preview on official Preview button click', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument();
    });

    const previewBtn = screen.getByRole('button', { name: 'Preview' });
    fireEvent.click(previewBtn);

    expect(onPreview).toHaveBeenCalledWith('mat_cell');
  });

  it('navigates to share landing on community View Share button click', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    const viewBtn = screen.getByRole('button', { name: 'View Share' });
    fireEvent.click(viewBtn);

    expect(onOpenShare).toHaveBeenCalledWith('share_chem');
  });

  it('triggers 1-click clone on community Clone button click', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Organic Chemistry High Yield')).toBeInTheDocument();
    });

    const cloneBtn = screen.getByRole('button', { name: /Clone/i });
    fireEvent.click(cloneBtn);

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
