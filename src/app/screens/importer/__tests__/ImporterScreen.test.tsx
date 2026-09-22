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

  it('renders Step 1 (Select Files) initially with drop zone and cancel button', () => {
    const onCancel = vi.fn();
    render(<ImporterScreen onCancel={onCancel} />, { wrapper: createWrapper() });

    expect(screen.getByText('Import Content')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5: Select Files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload files/i })).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
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

    // Test back button from Review to Files
    const backToFilesBtn = screen.getByRole('button', { name: /back: files/i });
    fireEvent.click(backToFilesBtn);
    expect(screen.getByText('Step 1 of 5: Select Files')).toBeInTheDocument();

    // Advance back to Review
    const reStartExtractionBtn = screen.getByRole('button', { name: /start extraction/i });
    fireEvent.click(reStartExtractionBtn);

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5: Review Content')).toBeInTheDocument();
    });

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

  it('passes selected ocrEngine to extraction execution', async () => {
    const { container } = render(<ImporterScreen />, { wrapper: createWrapper() });

    // Switch OCR engine to AI Vision
    const visionRadio = screen.getByRole('radio', { name: /ai vision/i });
    fireEvent.click(visionRadio);
    expect(visionRadio).toBeChecked();

    // Add file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'scan.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

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
});
