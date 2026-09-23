import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImporterScreen } from '../ImporterScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

// Mock WriterEditor & MarkdownViewer for isolated React DOM testing
vi.mock('../../../../features/writer/components/WriterEditor', () => ({
  WriterEditor: ({ initialMarkdown, onChange }: { initialMarkdown: string; onChange: (md: string) => void }) => (
    <textarea
      data-testid="mock-writer-editor"
      value={initialMarkdown}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../../../../features/reader/components/MarkdownViewer', () => ({
  default: ({ text }: { text: string }) => (
    <div data-testid="mock-markdown-viewer">{text}</div>
  ),
}));

describe('ImporterScreen', () => {
  let queryClient: QueryClient;
  let mockExtractExecute: ReturnType<typeof vi.fn>;
  let mockCommitExecute: ReturnType<typeof vi.fn>;
  let mockCleanupExecute: ReturnType<typeof vi.fn>;
  let mockImportPackageExecute: ReturnType<typeof vi.fn>;

  const mockCreatedMaterial: StudyMaterial = {
    id: 'mat-imported-1',
    documentId: 'doc-imported-1',
    title: 'Extracted Lecture Notes',
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  };

  const samplePackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Biochemistry Pack',
      createdAt: '2026-09-02T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Enzymes and Kinetics',
        documentContent: '# Enzymes\nCatalytic activity and Michaelis-Menten kinetics.',
      },
    ],
    questions: [],
    quizzes: [],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockExtractExecute = vi.fn().mockResolvedValue({
      status: 'review',
      markdown: '# Extracted Lecture Notes\n\n- Cell structure\n- Membrane transport',
      title: 'Extracted Lecture Notes',
      importMetadata: {
        source: 'pdf',
        originalFilename: 'lecture_notes.pdf',
        importedAt: '2026-09-02T12:00:00.000Z',
        pageCount: 2,
        usedOcr: false,
      },
    });

    mockCommitExecute = vi.fn().mockResolvedValue(mockCreatedMaterial);

    mockCleanupExecute = vi.fn().mockResolvedValue({
      original: '# Extracted Lecture Notes',
      cleaned: '# Cleaned Lecture Notes',
    });

    mockImportPackageExecute = vi.fn().mockResolvedValue({
      materialIds: ['mat-pkg-1'],
      questionIds: [],
      quizIds: [],
      assetIds: [],
      idMap: new Map(),
    });
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        importer: {
          extractContent: {
            execute: mockExtractExecute,
          },
          commitImport: {
            execute: mockCommitExecute,
          },
          cleanupWithAi: {
            execute: mockCleanupExecute,
          },
        },
        package: {
          importStudyPackage: {
            execute: mockImportPackageExecute,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            {children}
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  it('renders Step 1 (Select Files) initially with the Page header, stepper, drop zone, and back affordance', () => {
    const onCancel = vi.fn();
    render(<ImporterScreen onCancel={onCancel} />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Import Material' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5: Select Files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload files/i })).toBeInTheDocument();

    // The Page back affordance is the screen's cancel path before completion.
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('adds candidate files and enables Start Extraction', async () => {
    const { container } = render(<ImporterScreen />, { wrapper: createWrapper() });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'lecture_notes.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('lecture_notes.pdf')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument();
    });
  });

  it('walks through complete 5-step wizard flow: selecting -> extracting -> review -> details -> completed', async () => {
    const onOpenMaterial = vi.fn();
    const { container } = render(<ImporterScreen onOpenMaterial={onOpenMaterial} />, {
      wrapper: createWrapper(),
    });

    // Step 1: Add File
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'lecture_notes.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('lecture_notes.pdf')).toBeInTheDocument();
    });

    // Step 2 & 3: Start Extraction -> transitions automatically to Step 3 Review upon finish
    const startExtractionBtn = screen.getByRole('button', { name: /start extraction/i });
    fireEvent.click(startExtractionBtn);

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
      expect(screen.getByText('Edit Content')).toBeInTheDocument();
      expect(screen.getByText('Live Rendered Preview')).toBeInTheDocument();
    });

    // Test back button from Review to Files. Everything is already extracted,
    // so the primary action must offer a plain return to Review instead of
    // re-running extraction over the reviewed candidate.
    const backToFilesBtn = screen.getByRole('button', { name: /back: files/i });
    fireEvent.click(backToFilesBtn);
    expect(screen.getByText('Step 1 of 5: Select Files')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /continue to review/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start extraction/i })).not.toBeInTheDocument();
    // Engine config is hidden because there are zero pending or error candidates
    expect(screen.queryByText('Extraction Engine')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue to review/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
    });

    // The reviewed candidate was never re-extracted.
    expect(mockExtractExecute).toHaveBeenCalledTimes(1);

    // Step 4: Advance from Review to Material Details
    const nextDetailsBtn = screen.getByRole('button', { name: /next: material details/i });
    fireEvent.click(nextDetailsBtn);

    await waitFor(() => {
      expect(screen.getByText('Step 4 of 5: Material Details')).toBeInTheDocument();
      expect(screen.getByText('Material Details')).toBeInTheDocument();
    });

    // Test back button from Details to Review
    const backToReviewBtn = screen.getByRole('button', { name: /back: review/i });
    fireEvent.click(backToReviewBtn);
    expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();

    // Advance back to Details and save
    fireEvent.click(screen.getByRole('button', { name: /next: material details/i }));

    const saveBtn = screen.getByRole('button', { name: /save to library/i });
    fireEvent.click(saveBtn);

    // Step 5: Completed Step
    await waitFor(() => {
      expect(screen.getByText('Step 5 of 5: Completed')).toBeInTheDocument();
      expect(screen.getByText('Import Successful')).toBeInTheDocument();
      expect(screen.getByText('Extracted Lecture Notes')).toBeInTheDocument();
    });

    // Verify Open in Workspace CTA
    const openBtn = screen.getByRole('button', { name: /open in workspace/i });
    fireEvent.click(openBtn);
    expect(onOpenMaterial).toHaveBeenCalledWith('mat-imported-1');
  });

  it('stages and opens preview modal when an .lcpack study package is added', async () => {
    const { container } = render(<ImporterScreen />, { wrapper: createWrapper() });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const packageBlob = new File([JSON.stringify(samplePackage)], 'biochem.lcpack', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [packageBlob] } });

    await waitFor(() => {
      expect(screen.getByText('Biochemistry Pack')).toBeInTheDocument();
      expect(screen.getByText('Package Contents')).toBeInTheDocument();
      expect(screen.getByText('Import to Library')).toBeInTheDocument();
    });
  });

  it('offers Extract New Files when a pending file joins already-extracted candidates', async () => {
    const { container } = render(<ImporterScreen />, { wrapper: createWrapper() });

    const addFile = async (name: string) => {
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], name, { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    };

    await addFile('lecture_notes.pdf');
    fireEvent.click(screen.getByRole('button', { name: /start extraction/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
    });

    // Back to Files, then add a second, still-pending document.
    fireEvent.click(screen.getByRole('button', { name: /back: files/i }));
    await addFile('appendix.pdf');

    const extractNewBtn = screen.getByRole('button', { name: /extract new files/i });
    fireEvent.click(extractNewBtn);

    await waitFor(() => {
      expect(mockExtractExecute).toHaveBeenCalledTimes(2);
    });
  });

  it('passes selected ocrEngine to extraction execution', async () => {
    const { container } = render(<ImporterScreen />, { wrapper: createWrapper() });

    // Add file so engine configuration appears
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'scan.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Switch OCR engine to AI Vision
    const visionRadio = await screen.findByRole('radio', { name: /ai vision/i });
    fireEvent.click(visionRadio);
    expect(visionRadio).toBeChecked();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /start extraction/i }));

    await waitFor(() => {
      expect(mockExtractExecute).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          ocrEngine: 'ai-vision',
        }),
      );
    });
  });

  it('reveals Extraction Engine when a reviewed candidate is re-extracted back to pending', async () => {
    const { container } = render(<ImporterScreen />, { wrapper: createWrapper() });

    // 1. Stage file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'lecture.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // File is pending -> Engine config is visible
    expect(screen.getByText('Extraction Engine')).toBeInTheDocument();

    // 2. Run extraction
    fireEvent.click(screen.getByRole('button', { name: /start extraction/i }));
    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
    });

    // 3. Return to files view
    fireEvent.click(screen.getByRole('button', { name: /back: files/i }));
    expect(screen.getByText('Step 1 of 5: Select Files')).toBeInTheDocument();

    // All candidates are in review -> Engine config is hidden
    expect(screen.queryByText('Extraction Engine')).not.toBeInTheDocument();

    // 4. Click "Re-extract" on the file card
    const reExtractBtn = screen.getByRole('button', { name: /re-extract/i });
    fireEvent.click(reExtractBtn);

    // Candidate is reset to pending -> Engine config immediately reappears
    await waitFor(() => {
      expect(screen.getByText('Extraction Engine')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument();
    });
  });

  it('steps backwards through the wizard using the Page header back button instead of exiting to library', async () => {
    const onCancel = vi.fn();
    const { container } = render(<ImporterScreen onCancel={onCancel} />, { wrapper: createWrapper() });

    // 1. Stage and extract
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'lecture.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start extraction/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /start extraction/i }));

    // Reaches Step 3 (Review)
    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
    });

    // Advance to Step 4 (Details)
    fireEvent.click(screen.getByRole('button', { name: /next: material details/i }));
    await waitFor(() => {
      expect(screen.getByText('Step 4 of 5: Material Details')).toBeInTheDocument();
    });

    // Click the Page header back button: "Back to Review"
    const headerBackToReview = screen.getByRole('button', { name: /back to review/i });
    fireEvent.click(headerBackToReview);

    // Returns to Step 3 (Review), does NOT cancel or exit
    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
    });
    expect(onCancel).not.toHaveBeenCalled();

    // Click the Page header back button: "Back to Files"
    const headerBackToFiles = screen.getByRole('button', { name: /back to files/i });
    fireEvent.click(headerBackToFiles);

    // Returns to Step 1 (Files), does NOT cancel or exit
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 5: Select Files')).toBeInTheDocument();
    });
    expect(onCancel).not.toHaveBeenCalled();

    // On Step 1, clicking the Page header back button ("Back") calls onCancel to exit
    const headerExitBack = screen.getByRole('button', { name: /^back$/i });
    fireEvent.click(headerExitBack);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
