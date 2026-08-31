import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SharedPackageScreen } from '../SharedPackageScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { StudyPackage } from '../../../../domain/package/package.types';
import type { PublishedShare } from '../../../../domain/sharing/sharing.types';
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

  const mockSubjects = [
    { id: 'sub-biochem', title: 'Biochemistry', order: 1 },
    { id: 'sub-genetics', title: 'Genetics', order: 2 },
  ];

  const mockTerms = [
    { id: 'term-prelim', title: 'Prelim Term' },
    { id: 'term-midterm', title: 'Midterm Term' },
  ];

  let queryClient: QueryClient;
  let mockFetchPublishedShare: ReturnType<typeof vi.fn>;
  let mockTrackShareDownload: ReturnType<typeof vi.fn>;
  let mockImportStudyPackage: ReturnType<typeof vi.fn>;
  let mockSubjectRepository: { getSubjects: ReturnType<typeof vi.fn> };
  let mockSubjectTermRepository: { getTermsBySubject: ReturnType<typeof vi.fn> };
  let mockTermRepository: { getTerms: ReturnType<typeof vi.fn> };

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

    mockSubjectRepository = {
      getSubjects: vi.fn().mockResolvedValue(mockSubjects),
    };

    mockSubjectTermRepository = {
      getTermsBySubject: vi.fn().mockResolvedValue(mockTerms),
    };

    mockTermRepository = {
      getTerms: vi.fn().mockResolvedValue(mockTerms),
    };
  });

  function renderScreen(props: {
    shareId?: string;
    onOpenMaterial?: (materialId: string, subjectId?: string) => void;
    onCancel?: () => void;
  } = {}) {
    const onOpenMaterial = props.onOpenMaterial ?? vi.fn();
    const onCancel = props.onCancel ?? vi.fn();
    const shareId = props.shareId ?? 'share_public_123';

    const mockContextValue = {
      infrastructure: {
        repositories: {
          subject: mockSubjectRepository,
          subjectTerm: mockSubjectTermRepository,
          term: mockTermRepository,
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
      expect(screen.getByText('Cellular Biochemistry')).toBeInTheDocument();
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
      expect(screen.getByText('Cellular Biochemistry')).toBeInTheDocument();
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
    expect(screen.getByText(/True\/False/)).toBeInTheDocument();
  });

  it('clones package to library, tracks download only after commit, and allows opening cloned material', async () => {
    const { onOpenMaterial } = renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Cellular Biochemistry')).toBeInTheDocument();
    });

    // Select Subject & Term destination
    const subjectSelect = screen.getByLabelText(/Subject \(Optional\)/i);
    fireEvent.change(subjectSelect, { target: { value: 'sub-biochem' } });

    await waitFor(() => {
      expect(screen.getByText('Prelim Term')).toBeInTheDocument();
    });

    const termSelect = screen.getByLabelText(/Term \(Optional\)/i);
    fireEvent.change(termSelect, { target: { value: 'term-prelim' } });

    const cloneButton = screen.getByRole('button', { name: /Clone to Library/i });
    fireEvent.click(cloneButton);

    await waitFor(() => {
      // 1. Verify importStudyPackage was called
      expect(mockImportStudyPackage).toHaveBeenCalledWith({
        package: mockPackage,
        targetSubjectId: 'sub-biochem',
        targetTermId: 'term-prelim',
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

    // 4. Click Open Cloned Material
    const openButton = screen.getByRole('button', { name: /Open Cloned Material/i });
    fireEvent.click(openButton);

    expect(onOpenMaterial).toHaveBeenCalledWith('local_mat_101', 'sub-biochem');
  });

  it('serializes package to blob, triggers file download, and tracks download metric', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Cellular Biochemistry')).toBeInTheDocument();
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
      expect(screen.getByText('Cellular Biochemistry')).toBeInTheDocument();
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
