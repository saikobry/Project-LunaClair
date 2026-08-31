import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { MaterialWriterTab } from '../../components/MaterialWriterTab';
import type { StudyMaterial } from '../../../../domain/library/StudyMaterial';
import type { Document } from '../../../../domain/reader/Document';
import type { DocumentContentRepository, ImportedDocumentContent } from '../../../../domain/reader/DocumentContentRepository';
import { UpdateDocumentContentUseCase } from '../../../../application/use-cases/content/UpdateDocumentContentUseCase';
import { HybridDocumentRepository } from '../../../../infrastructure/api/HybridDocumentRepository';

const showToastMock = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Lexical Composer & Editor to isolate component state testing in React DOM
vi.mock('../../components/WriterEditor', () => ({
  WriterEditor: ({ initialMarkdown, onChange }: { initialMarkdown: string; onChange: (md: string) => void }) => (
    <div data-testid="mock-writer-editor">
      <textarea
        data-testid="mock-lexical-textarea"
        value={initialMarkdown}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

describe('Stage 4C — MaterialWriterTab UI State & Lifecycle Component Tests', () => {
  let queryClient: QueryClient;

  const sampleMaterial1: StudyMaterial = {
    id: 'mat-1',
    documentId: 'doc-1',
    title: 'Anatomy Basics',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const sampleMaterial2: StudyMaterial = {
    id: 'mat-2',
    documentId: 'doc-2',
    title: 'Cellular Respiration',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  let localStore: Map<string, ImportedDocumentContent>;
  let localDocRepo: DocumentContentRepository;
  let remoteDocRepo: { getDocumentByMaterial: (mat: StudyMaterial) => Promise<Document> };
  let hybridDocRepo: HybridDocumentRepository;
  let shouldFailSave: boolean;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    showToastMock.mockReset();
    shouldFailSave = false;

    localStore = new Map<string, ImportedDocumentContent>();
    localStore.set('doc-1', {
      documentId: 'doc-1',
      title: 'Anatomy Basics',
      content: '# Initial Anatomy Content',
      updatedAt: '2026-08-01T00:00:00Z',
    });
    localStore.set('doc-2', {
      documentId: 'doc-2',
      title: 'Cellular Respiration',
      content: '# Initial Cell Content',
      updatedAt: '2026-08-01T00:00:00Z',
    });

    localDocRepo = {
      getByDocumentId: async (id: string) => localStore.get(id) ?? null,
      put: async (content: ImportedDocumentContent) => {
        if (shouldFailSave) {
          throw new Error('Disk Quota Exceeded in Dexie');
        }
        localStore.set(content.documentId, content);
      },
      deleteByDocumentId: async (id: string) => {
        localStore.delete(id);
      },
    };

    remoteDocRepo = {
      getDocumentByMaterial: async (mat: StudyMaterial) => ({
        id: mat.id,
        title: mat.title,
        content: `# Remote fallback for ${mat.title}`,
        format: 'markdown',
      }),
    };

    hybridDocRepo = new HybridDocumentRepository(localDocRepo, remoteDocRepo);
  });

  function renderWriterTab(materialId = 'mat-1') {
    const mockAppContext: ApplicationContextValue = {
      repositories: {
        document: hybridDocRepo,
        documentContent: localDocRepo,
        library: {
          getMaterials: async () => [sampleMaterial1, sampleMaterial2],
          getMaterialById: async (id: string) => (id === 'mat-1' ? sampleMaterial1 : id === 'mat-2' ? sampleMaterial2 : null),
          createMaterial: vi.fn(),
          updateMaterial: vi.fn(),
          deleteMaterial: vi.fn(),
        } as any,
      } as any,
      infrastructure: {
        repositories: {
          document: hybridDocRepo,
          documentContent: localDocRepo,
          library: {
            getMaterials: async () => [sampleMaterial1, sampleMaterial2],
            getMaterialById: async (id: string) => (id === 'mat-1' ? sampleMaterial1 : id === 'mat-2' ? sampleMaterial2 : null),
            createMaterial: vi.fn(),
            updateMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
          } as any,
        } as any,
      } as any,
      useCases: {
        content: {
          updateDocumentContent: new UpdateDocumentContentUseCase(localDocRepo),
        },
      } as any,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockAppContext}>
          <MaterialWriterTab materialId={materialId} />
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );
  }

  it('hydrates initial document content and displays "Saved to Library" badge', async () => {
    renderWriterTab('mat-1');

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('mock-lexical-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('# Initial Anatomy Content');
  });

  it('transitions SaveStatus to "Unsaved changes" on edit and saves cleanly on Save button click', async () => {
    renderWriterTab('mat-1');

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('mock-lexical-textarea');
    fireEvent.change(textarea, { target: { value: '# Updated Anatomy Notes' } });

    // Status transitions to unsaved
    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    expect(localStore.get('doc-1')?.content).toBe('# Updated Anatomy Notes');
    expect(showToastMock).toHaveBeenCalledWith('Changes saved to local library', { intent: 'success' });
  });

  it('preserves user draft and displays "Save failed" with Retry button when persistence rejects', async () => {
    shouldFailSave = true;
    renderWriterTab('mat-1');

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('mock-lexical-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '# Crucial Work That Failed' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
    });

    // Invariant: Draft remains intact in memory
    expect(textarea.value).toBe('# Crucial Work That Failed');
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith(expect.stringContaining('Quota Exceeded'), { intent: 'error' });
  });

  it('allows editing after save failure and retries using the latest updated draft', async () => {
    shouldFailSave = true;
    renderWriterTab('mat-1');

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('mock-lexical-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '# Edit Attempt 1' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
    });

    // User adds more edits before clicking Retry
    fireEvent.change(textarea, { target: { value: '# Edit Attempt 1 + Subsequent Edits' } });

    // Storage is recovered
    shouldFailSave = false;

    const retryButton = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    // Persisted content is the latest combined edit
    expect(localStore.get('doc-1')?.content).toBe('# Edit Attempt 1 + Subsequent Edits');
  });

  it('restores baseline content and disables discard when Discard button is clicked', async () => {
    renderWriterTab('mat-1');

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('mock-lexical-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '# Unwanted Changes' } });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();

    const discardBtn = screen.getByRole('button', { name: /Discard/i });
    expect(discardBtn).not.toBeDisabled();

    fireEvent.click(discardBtn);

    await waitFor(() => {
      expect(screen.getByTestId('mock-lexical-textarea')).toHaveValue('# Initial Anatomy Content');
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
      expect(discardBtn).toBeDisabled();
    });
  });

  it('prompts confirmation modal when switching materials while dirty and allows staying', async () => {
    const { rerender } = renderWriterTab('mat-1');

    await waitFor(() => {
      expect(screen.getByText(/Saved to Library/i)).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('mock-lexical-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '# Dirty Unsaved Notes' } });

    await waitFor(() => {
      expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
    });

    // Attempt to switch to material 2
    rerender(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider
          value={{
            repositories: {
              document: hybridDocRepo,
              documentContent: localDocRepo,
              library: {
                getMaterials: async () => [sampleMaterial1, sampleMaterial2],
                getMaterialById: async (id: string) => (id === 'mat-1' ? sampleMaterial1 : id === 'mat-2' ? sampleMaterial2 : null),
                createMaterial: vi.fn(),
                updateMaterial: vi.fn(),
                deleteMaterial: vi.fn(),
              } as any,
            } as any,
            infrastructure: {
              repositories: {
                document: hybridDocRepo,
                documentContent: localDocRepo,
                library: {
                  getMaterials: async () => [sampleMaterial1, sampleMaterial2],
                  getMaterialById: async (id: string) => (id === 'mat-1' ? sampleMaterial1 : id === 'mat-2' ? sampleMaterial2 : null),
                  createMaterial: vi.fn(),
                  updateMaterial: vi.fn(),
                  deleteMaterial: vi.fn(),
                } as any,
              } as any,
            } as any,
            useCases: {
              content: {
                updateDocumentContent: new UpdateDocumentContentUseCase(localDocRepo),
              },
            } as any,
          }}
        >
          <MaterialWriterTab materialId="mat-2" />
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );

    // Modal appears
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stay in Editor/i })).toBeInTheDocument();
    });

    // Click "Stay in Editor"
    const stayBtn = screen.getByRole('button', { name: /Stay in Editor/i });
    fireEvent.click(stayBtn);

    // Modal closes and dirty draft remains intact on mat-1
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Stay in Editor/i })).not.toBeInTheDocument();
    });
    expect(textarea.value).toBe('# Dirty Unsaved Notes');
  });
});
