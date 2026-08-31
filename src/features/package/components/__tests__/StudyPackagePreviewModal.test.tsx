import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StudyPackagePreviewModal, type ImportOptions } from '../StudyPackagePreviewModal';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { StudyPackage } from '../../../../domain/package/package.types';

describe('StudyPackagePreviewModal', () => {
  const mockPackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Neurobiology Essentials',
      description: 'Comprehensive overview of neural circuitry.',
      author: 'Dr. Santiago',
      createdAt: '2026-08-28T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Neural Networks Overview',
        documentContent: '# Neural Networks\nSynaptic connections explained.',
      },
    ],
    questions: [
      {
        id: 'pkg_q_1',
        materialId: 'pkg_mat_1',
        type: 'multiple_choice',
        prompt: 'What is the primary excitatory neurotransmitter in the brain?',
        payload: {
          type: 'multiple_choice',
          choices: ['Glutamate', 'GABA'],
          correctIndex: 0,
        },
        difficulty: 'medium',
        points: 10,
      },
      {
        id: 'pkg_q_2',
        materialId: 'pkg_mat_1',
        type: 'true_false',
        prompt: 'GABA is typically inhibitory.',
        payload: {
          type: 'true_false',
          correctAnswer: true,
        },
        difficulty: 'easy',
        points: 5,
      },
    ],
    quizzes: [
      {
        id: 'pkg_quiz_1',
        materialId: 'pkg_mat_1',
        title: 'Synapse Quiz',
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
        front: 'Action Potential',
        back: 'A rapid rise and subsequent fall in voltage or membrane potential across a cellular membrane.',
      },
    ],
    assets: [
      {
        id: 'pkg_asset_1',
        materialId: 'pkg_mat_1',
        filename: 'synapse_diagram.png',
        mimeType: 'image/png',
        dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    ],
  };

  const mockSubjects = [
    { id: 'sub-bio', title: 'Biology', order: 1 },
    { id: 'sub-chem', title: 'Chemistry', order: 2 },
  ];

  const mockTerms = [
    { id: 'term-prelim', title: 'Prelim Term' },
    { id: 'term-midterm', title: 'Midterm' },
  ];

  let queryClient: QueryClient;
  let mockSubjectRepository: { getSubjects: ReturnType<typeof vi.fn> };
  let mockSubjectTermRepository: { getTermsBySubject: ReturnType<typeof vi.fn> };
  let mockTermRepository: { getTerms: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
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

  function renderModal(props: Partial<Parameters<typeof StudyPackagePreviewModal>[0]> = {}) {
    const onClose = vi.fn();
    const onConfirmImport = vi.fn().mockResolvedValue(undefined);

    const mockContextValue = {
      infrastructure: {
        repositories: {
          subject: mockSubjectRepository,
          subjectTerm: mockSubjectTermRepository,
          term: mockTermRepository,
        },
      },
    } as unknown as ApplicationContextValue;

    const utils = render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          <StudyPackagePreviewModal
            isOpen={true}
            onClose={onClose}
            packageData={mockPackage}
            onConfirmImport={onConfirmImport}
            isImporting={false}
            {...props}
          />
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );

    return {
      ...utils,
      onClose,
      onConfirmImport,
    };
  }

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when packageData is null', () => {
    renderModal({ packageData: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders package metadata (title, description, author, creation date)', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Neurobiology Essentials')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive overview of neural circuitry.')).toBeInTheDocument();
    expect(screen.getByText(/Dr\. Santiago/)).toBeInTheDocument();
  });

  it('renders summary stat cards and metrics computed purely via inspectStudyPackage', () => {
    renderModal();

    // Section headers
    expect(screen.getByText('Package Contents')).toBeInTheDocument();
    expect(screen.getByText('Question Types')).toBeInTheDocument();

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

    // Question type badges
    expect(screen.getByText(/Multiple Choice/)).toBeInTheDocument();
    expect(screen.getByText(/True\/False/)).toBeInTheDocument();
  });

  it('populates subject and term options from catalog hooks', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Biology')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });

    const subjectSelect = screen.getByLabelText(/Subject \(Optional\)/i);
    fireEvent.change(subjectSelect, { target: { value: 'sub-bio' } });

    await waitFor(() => {
      expect(screen.getByText('Prelim Term')).toBeInTheDocument();
      expect(screen.getByText('Midterm')).toBeInTheDocument();
    });
  });

  it('confirms import with selected external destination context without mutating packageData', async () => {
    const frozenPackage = JSON.parse(JSON.stringify(mockPackage));
    Object.freeze(frozenPackage);

    const { onConfirmImport } = renderModal({ packageData: frozenPackage });

    await waitFor(() => {
      expect(screen.getByText('Biology')).toBeInTheDocument();
    });

    const subjectSelect = screen.getByLabelText(/Subject \(Optional\)/i);
    fireEvent.change(subjectSelect, { target: { value: 'sub-bio' } });

    await waitFor(() => {
      expect(screen.getByText('Prelim Term')).toBeInTheDocument();
    });

    const termSelect = screen.getByLabelText(/Term \(Optional\)/i);
    fireEvent.change(termSelect, { target: { value: 'term-prelim' } });

    const importButton = screen.getByText('Import to Library');
    fireEvent.click(importButton);

    expect(onConfirmImport).toHaveBeenCalledWith<[ImportOptions]>({
      subjectId: 'sub-bio',
      termId: 'term-prelim',
    });

    // Verify original package is untouched
    expect(frozenPackage.materials[0].title).toBe('Neural Networks Overview');
  });

  it('handles closing via Cancel button and Close button', () => {
    const { onClose } = renderModal();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeIconButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeIconButton);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('disables actions and displays loading spinner when isImporting is true', () => {
    renderModal({ isImporting: true });

    expect(screen.getByText('Importing...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByLabelText('Close dialog')).toBeDisabled();
  });
});
