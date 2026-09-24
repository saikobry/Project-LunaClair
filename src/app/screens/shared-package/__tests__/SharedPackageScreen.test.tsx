import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SharedPackageScreen } from '../SharedPackageScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { AppRoute } from '../../../routing/routing';
import type { StudyPackage } from '../../../../domain/package/models/package.types';
import type { PublishedShare } from '../../../../domain/sharing/models/sharing.types';
import * as fileDownloadModule from '../../../../shared/utils/fileDownload';

vi.mock('../../../../shared/utils/fileDownload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/utils/fileDownload')>();
  return {
    ...actual,
    triggerBlobDownload: vi.fn(),
  };
});

describe('SharedPackageScreen', () => {
  const mockPackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Cellular Biochemistry',
      description: 'Metabolic pathways and enzyme kinetics.',
      author: 'Prof. Krebs',
      createdAt: '2026-08-28T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Glycolysis Pathway',
        documentContent: '# Glycolysis\nOverview of the 10 enzyme-catalyzed steps.',
      },
    ],
    questions: [
      {
        id: 'pkg_q_1',
        materialId: 'pkg_mat_1',
        type: 'multiple_choice',
        prompt: 'What is the net yield of ATP per glucose in glycolysis?',
        payload: {
          type: 'multiple_choice',
          choices: ['2 ATP', '4 ATP', '36 ATP'],
          correctIndex: 0,
        },
        difficulty: 'easy',
        points: 5,
      },
      {
        id: 'pkg_q_2',
        materialId: 'pkg_mat_1',
        type: 'true_false',
        prompt: 'Phosphofructokinase-1 is a key regulatory enzyme in glycolysis.',
        payload: {
          type: 'true_false',
          correctAnswer: true,
        },
        difficulty: 'medium',
        points: 10,
      },
    ],
    quizzes: [
      {
        id: 'pkg_quiz_1',
        materialId: 'pkg_mat_1',
        title: 'Glycolysis Check',
        items: [
          { questionId: 'pkg_q_1', order: 1 },
          { questionId: 'pkg_q_2', order: 2 },
        ],
      },
    ],
    flashcards: [
      {
        id: 'pkg_card_1',
        materialId: 'pkg_mat_1',
        front: 'Hexokinase',
        back: 'Phosphorylates glucose to glucose-6-phosphate.',
      },
    ],
    assets: [
      {
        id: 'pkg_asset_1',
        materialId: 'pkg_mat_1',
        filename: 'glycolysis_chart.png',
        mimeType: 'image/png',
        dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    ],
  };

  const mockPublicShare: PublishedShare = {
    id: 'share_public_123',
    format: 'lcpack',
    schemaVersion: 1,
    title: 'Cellular Biochemistry',
    description: 'Metabolic pathways and enzyme kinetics.',
    author: 'Prof. Krebs',
    accessType: 'public',
    package: mockPackage,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    viewCount: 42,
    downloadCount: 7,
  };

  let queryClient: QueryClient;
  let mockFetchPublishedShare: ReturnType<typeof vi.fn>;
  let mockTrackShareDownload: ReturnType<typeof vi.fn>;
  let mockImportStudyPackage: ReturnType<typeof vi.fn>;
  /** Local library behind `originShareId` membership (exact clone identity). */
  let mockGetMaterials: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    mockFetchPublishedShare = vi.fn().mockResolvedValue(mockPublicShare);
    mockTrackShareDownload = vi.fn().mockResolvedValue({ success: true, downloadCount: 8 });
    mockImportStudyPackage = vi.fn().mockResolvedValue({
      materialIds: ['local_mat_101'],
      questionIds: ['local_q_101', 'local_q_102'],
      quizIds: ['local_quiz_101'],
      assetIds: ['local_asset_101'],
      idMap: new Map([['pkg_mat_1', 'local_mat_101']]),
    });
    mockGetMaterials = vi.fn().mockResolvedValue([]);
  });

  function renderScreen(props: {
    shareId?: string;
    from?: AppRoute;
    onOpenMaterial?: (materialId: string) => void;
    onCancel?: () => void;
  } = {}) {
    const onOpenMaterial = props.onOpenMaterial ?? vi.fn();
    const onCancel = props.onCancel ?? vi.fn();
    const shareId = props.shareId ?? 'share_public_123';

    const mockContextValue = {
      repositories: {
        library: {
          getMaterials: mockGetMaterials,
        },
      },
      useCases: {
        sharing: {
          fetchPublishedShare: { execute: mockFetchPublishedShare },
          trackShareDownload: { execute: mockTrackShareDownload },
        },
        package: {
          importStudyPackage: { execute: mockImportStudyPackage },
        },
      },
    } as unknown as ApplicationContextValue;

    const utils = render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <SharedPackageScreen
              shareId={shareId}
              from={props.from}
              onOpenMaterial={onOpenMaterial}
              onCancel={onCancel}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );

    return {
      ...utils,
      onOpenMaterial,
      onCancel,
    };
  }

  it('renders loading state initially while fetching share', () => {
    // Return unresolved promise to observe loading
    mockFetchPublishedShare.mockReturnValue(new Promise(() => {}));

    renderScreen();

    expect(screen.getByText('Loading shared study package...')).toBeInTheDocument();
  });

  it('renders error state on 404 not found and allows navigating back', async () => {
    const error404 = new Error('Not Found');
    (error404 as unknown as { status: number }).status = 404;
    mockFetchPublishedShare.mockRejectedValue(error404);

    const { onCancel } = renderScreen({ shareId: 'share_missing' });

    await waitFor(() => {
      expect(screen.getByText('Unable to load study package')).toBeInTheDocument();
      expect(
        screen.getByText('This shared study package could not be found or has been deleted.'),
      ).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Library');
    fireEvent.click(backButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders error state on 410 expired share', async () => {
    const error410 = new Error('Gone');
    (error410 as unknown as { status: number }).status = 410;
    mockFetchPublishedShare.mockRejectedValue(error410);

    renderScreen({ shareId: 'share_expired' });

    await waitFor(() => {
      expect(screen.getByText('This shared study package has expired.')).toBeInTheDocument();
    });
  });

  it('renders locked passcode challenge when 401 / passcode required, and allows unlocking', async () => {
    const error401 = new Error('HTTP 401 Unauthorized: Passcode required');
    (error401 as unknown as { status: number }).status = 401;
    mockFetchPublishedShare.mockRejectedValueOnce(error401);

    renderScreen({ shareId: 'share_locked' });

    await waitFor(() => {
      expect(screen.getByText('Passcode Protected')).toBeInTheDocument();
      expect(
        screen.getByText('This study package is passcode protected. Enter passcode to view.'),
      ).toBeInTheDocument();
    });

    const passcodeField = screen.getByPlaceholderText('Enter passcode');
    expect(passcodeField).toBeInTheDocument();

    // Now mock successful unlock on second attempt
    mockFetchPublishedShare.mockResolvedValueOnce({
      ...mockPublicShare,
      accessType: 'passcode',
    });

    fireEvent.change(passcodeField, { target: { value: 'secret123' } });

    const unlockButton = screen.getByRole('button', { name: /Unlock Package/i });
    fireEvent.click(unlockButton);

    await waitFor(() => {
      expect(mockFetchPublishedShare).toHaveBeenCalledWith({
        shareId: 'share_locked',
        passcode: 'secret123',
      });
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });
  });

  it('displays error prompt when incorrect passcode is submitted', async () => {
    const error401 = new Error('HTTP 401 Unauthorized');
    (error401 as unknown as { status: number }).status = 401;
    mockFetchPublishedShare.mockRejectedValue(error401);

    renderScreen({ shareId: 'share_locked' });

    await waitFor(() => {
      expect(screen.getByText('Passcode Protected')).toBeInTheDocument();
    });

    const passcodeField = screen.getByPlaceholderText('Enter passcode');
    fireEvent.change(passcodeField, { target: { value: 'wrong_password' } });

    const unlockButton = screen.getByRole('button', { name: /Unlock Package/i });
    fireEvent.click(unlockButton);

    await waitFor(() => {
      expect(screen.getByText('Incorrect passcode. Please try again.')).toBeInTheDocument();
    });
  });

  it('renders package metadata, statistics, and question types from inspectStudyPackage', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
      expect(screen.getByText('Metabolic pathways and enzyme kinetics.')).toBeInTheDocument();
      expect(screen.getByText(/Prof\. Krebs/)).toBeInTheDocument();
    });

    // Stat cards
    const materialsCard = screen.getByText('Materials').closest('div')?.parentElement;
    expect(materialsCard).not.toBeNull();
    expect(within(materialsCard!).getByText('1')).toBeInTheDocument();

    const questionsCard = screen.getByText('Questions').closest('div')?.parentElement;
    expect(questionsCard).not.toBeNull();
    expect(within(questionsCard!).getByText('2')).toBeInTheDocument();

    const pointsCard = screen.getByText('Total Points').closest('div')?.parentElement;
    expect(pointsCard).not.toBeNull();
    expect(within(pointsCard!).getByText('15')).toBeInTheDocument();

    // Badges for question types
    expect(screen.getByText(/Multiple Choice/)).toBeInTheDocument();
    expect(screen.getByText(/True \/ False/)).toBeInTheDocument();
  });

  it('clones package to library, tracks download only after commit, and allows opening cloned material', async () => {
    const { onOpenMaterial } = renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    const cloneButton = screen.getByRole('button', { name: /Clone to Library/i });
    fireEvent.click(cloneButton);

    await waitFor(() => {
      // 1. Verify importStudyPackage was called — WITH exact clone identity, so
      // the share stays recognisable after this screen unmounts.
      expect(mockImportStudyPackage).toHaveBeenCalledWith({
        package: mockPackage,
        originShareId: 'share_public_123',
      });

      // 2. Strict Requirement: trackShareDownload called ONLY after import succeeds
      expect(mockTrackShareDownload).toHaveBeenCalledWith({
        shareId: 'share_public_123',
      });

      // 3. Success banner rendered
      expect(
        screen.getByText('Study package successfully cloned to your library!'),
      ).toBeInTheDocument();
    });

    // 4. No clone control remains on offer once cloned — a second one would
    // import a duplicate copy of the same package.
    expect(screen.queryByRole('button', { name: /Clone to Library/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cloned to Library/i })).toBeDisabled();

    // 5. Click Open Cloned Material
    const openButton = screen.getByRole('button', { name: /Open Cloned Material/i });
    fireEvent.click(openButton);

    expect(onOpenMaterial).toHaveBeenCalledWith('local_mat_101');
  });

  it('recognises an already-cloned share on a fresh visit instead of offering a duplicate clone', async () => {
    // The share was cloned by an earlier session (or by the Explore hub): the
    // only evidence is `originShareId` on the local material.
    mockGetMaterials.mockResolvedValue([
      { id: 'local_mat_earlier', title: 'Glycolysis Pathway', originShareId: 'share_public_123' },
    ]);

    const { onOpenMaterial } = renderScreen();

    const openInLibrary = await screen.findByRole('button', { name: /Open in library/i });

    // No second clone is on offer, and nothing was imported on arrival.
    expect(screen.queryByRole('button', { name: /Clone to Library/i })).not.toBeInTheDocument();
    expect(mockImportStudyPackage).not.toHaveBeenCalled();

    fireEvent.click(openInLibrary);

    expect(onOpenMaterial).toHaveBeenCalledWith('local_mat_earlier');
  });

  it('does not treat a material cloned from a different share as this one', async () => {
    mockGetMaterials.mockResolvedValue([
      { id: 'local_mat_other', title: 'Cellular Biochemistry', originShareId: 'share_other_456' },
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    // Title collision alone must never mark a share as cloned.
    expect(screen.getByRole('button', { name: /Clone to Library/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Open in library/i })).not.toBeInTheDocument();
  });

  it('points its breadcrumb at the Library when there is no in-app origin', async () => {
    const { onCancel } = renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    // An external /s/:code link has no origin: Library is the honest default.
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Library' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('points its breadcrumb and back control at Explore when opened from the hub', async () => {
    // The hub's filters are URL state, so "back" must mean back to that view —
    // not to the library, which would drop them.
    renderScreen({ from: { kind: 'explore', q: 'biology', sort: 'recent' } });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    const crumbs = within(screen.getByLabelText('Breadcrumb'));

    expect(crumbs.getByRole('button', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Explore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Library' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Library' })).not.toBeInTheDocument();
  });

  it('ends the trail with the package name, like the material workspace trail does', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    const crumbs = within(screen.getByLabelText('Breadcrumb'));

    // Trail ends with the thing you are looking at; the generic surface name is
    // only a placeholder for the states that cannot know the title yet.
    expect(crumbs.getByText('Cellular Biochemistry')).toBeInTheDocument();
    expect(crumbs.queryByText('Shared Package')).not.toBeInTheDocument();
  });

  it('falls back to the surface name in the trail while the package is still unknown', () => {
    // Unresolved fetch → the loading state, where no title exists to show.
    mockFetchPublishedShare.mockReturnValue(new Promise(() => {}));

    renderScreen();

    expect(within(screen.getByLabelText('Breadcrumb')).getByText('Shared Package')).toBeInTheDocument();
  });

  it('shows the tags the clone will carry, on the share surface', async () => {
    mockFetchPublishedShare.mockResolvedValue({
      ...mockPublicShare,
      package: {
        ...mockPackage,
        materials: [{ ...mockPackage.materials[0], tags: ['glycolysis', 'atp'] }],
      },
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    // Material tags are portable package data — visible before cloning, in the
    // same pill vocabulary the library card uses.
    expect(screen.getByText('#glycolysis')).toBeInTheDocument();
    expect(screen.getByText('#atp')).toBeInTheDocument();
  });

  it('shows no tag pills for an untagged package', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it('serializes package to blob, triggers file download, and tracks download metric', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole('button', { name: /Download \.lcpack/i });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(fileDownloadModule.triggerBlobDownload).toHaveBeenCalledWith(
        expect.any(Blob),
        'Cellular Biochemistry.lcpack',
      );
      expect(mockTrackShareDownload).toHaveBeenCalledWith({
        shareId: 'share_public_123',
      });
    });
  });

  it('does NOT track download metric if importStudyPackage fails', async () => {
    mockImportStudyPackage.mockRejectedValueOnce(new Error('IndexedDB storage quota exceeded'));

    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cellular Biochemistry' })).toBeInTheDocument();
    });

    const cloneButton = screen.getByRole('button', { name: /Clone to Library/i });
    fireEvent.click(cloneButton);

    await waitFor(() => {
      expect(mockImportStudyPackage).toHaveBeenCalledTimes(1);
    });

    // Verification: trackShareDownload must NOT have been called
    expect(mockTrackShareDownload).not.toHaveBeenCalled();
  });
});
