import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreviewMaterialScreen } from '../PreviewMaterialScreen';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { ToastProvider } from '../../../providers/ToastContext';
import { materialQueryKeys } from '../../../../features/materials/queries/materialQueryKeys';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../../domain/library/models/Subject';
import type { Term } from '../../../../domain/library/models/Term';
import type { Document } from '../../../../domain/reader/models/Document';

describe('PreviewMaterialScreen', () => {
  let queryClient: QueryClient;
  let mockGetMaterial: ReturnType<typeof vi.fn>;
  let mockGetDocumentByMaterial: ReturnType<typeof vi.fn>;
  let mockGetMaterials: ReturnType<typeof vi.fn>;
  let mockImportMaterialExecute: ReturnType<typeof vi.fn>;
  let onBack: any;
  let onOpenMaterial: any;

  const mockMaterial: StudyMaterial = {
    id: 'mat-cell',
    title: 'Cell Structure & Organelles',
    description: 'A deep dive into eukaryotic organelles and membrane transport.',
    documentId: 'doc-cell',
    subjectId: 'sub-bio',
    termId: 'term-prelim',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const mockSubject: Subject = {
    id: 'sub-bio',
    title: 'Cellular Biology',
    order: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const mockTerm: Term = {
    id: 'term-prelim',
    title: 'Prelim Term',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const mockDocument: Document = {
    id: 'doc-cell',
    title: 'Cell Structure & Organelles',
    content: '# Cell Biology\n\nMitochondria are the powerhouses of the cell.',
    format: 'markdown',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    onBack = vi.fn() as any;
    onOpenMaterial = vi.fn() as any;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetMaterial = vi.fn().mockResolvedValue({
      material: mockMaterial,
      subject: mockSubject,
      term: mockTerm,
    });

    mockGetDocumentByMaterial = vi.fn().mockResolvedValue(mockDocument);
    mockGetMaterials = vi.fn().mockResolvedValue([]);
    mockImportMaterialExecute = vi.fn().mockResolvedValue(undefined);
  });

  function createWrapper(contextOverrides?: Partial<ApplicationContextValue>) {
    const mockContextValue = {
      repositories: {
        catalog: {
          getMaterial: mockGetMaterial,
          getCatalog: vi.fn(),
        },
        document: {
          getDocumentByMaterial: mockGetDocumentByMaterial,
          getDocument: vi.fn(),
          saveDocument: vi.fn(),
        },
        library: {
          getMaterials: mockGetMaterials,
          getMaterial: vi.fn(),
          createMaterial: vi.fn(),
          updateMaterial: vi.fn(),
          deleteMaterial: vi.fn(),
          touchMaterial: vi.fn(),
        },
        subject: {
          getSubjects: vi.fn().mockResolvedValue([]),
        },
        term: {
          getTerms: vi.fn().mockResolvedValue([]),
        },
        ...contextOverrides?.repositories,
      },
      useCases: {
        library: {
          importMaterial: {
            execute: mockImportMaterialExecute,
          },
          deleteMaterial: { execute: vi.fn() },
          createMaterial: { execute: vi.fn() },
          updateMaterial: { execute: vi.fn() },
          touchMaterial: { execute: vi.fn() },
          importSubject: { execute: vi.fn() },
          removeImportedMaterial: { execute: vi.fn() },
          syncDefaultTerms: { execute: vi.fn() },
        },
        ...contextOverrides?.useCases,
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            {children}
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  it('renders skeleton loading state while resolving material and document', () => {
    mockGetMaterial.mockReturnValue(new Promise(() => {})); // pending

    render(
      <PreviewMaterialScreen materialId="mat-cell" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders error state when material resolution fails or material is not found', async () => {
    mockGetMaterial.mockResolvedValueOnce(null);

    render(
      <PreviewMaterialScreen materialId="mat-nonexistent" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Material could not be found.')).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: 'Back to Available Materials' });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders full preview metadata and markdown content for a non-imported material', async () => {
    render(
      <PreviewMaterialScreen materialId="mat-cell" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Read-only Preview')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Cell Structure & Organelles' })).toBeInTheDocument();
    expect(screen.getByText('Cellular Biology')).toBeInTheDocument();
    expect(screen.getByText('Prelim Term')).toBeInTheDocument();
    expect(screen.getByText(/Add to library to enable interactive quizzes/i)).toBeInTheDocument();

    // Document markdown content rendered
    expect(screen.getByText('Mitochondria are the powerhouses of the cell.')).toBeInTheDocument();

    // Add to Library CTA is present
    expect(screen.getByRole('button', { name: /Add .* to .*library/i })).toBeInTheDocument();
  });

  it('triggers import mutation and opens material on success when clicking Add to Library', async () => {
    render(
      <PreviewMaterialScreen materialId="mat-cell" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add .* to .*library/i })).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add .* to .*library/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockImportMaterialExecute).toHaveBeenCalledWith('mat-cell');
      expect(onOpenMaterial).toHaveBeenCalledWith('mat-cell', 'sub-bio');
    });
  });

  it('renders Open CTA when material is already present in the local library', async () => {
    mockGetMaterials.mockResolvedValue([mockMaterial]);
    queryClient.setQueryData(materialQueryKeys.materials(), [mockMaterial]);

    render(
      <PreviewMaterialScreen materialId="mat-cell" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Available in your library/i)).toBeInTheDocument();

    const openButton = screen.getByRole('button', { name: /Open/i });
    fireEvent.click(openButton);
    expect(onOpenMaterial).toHaveBeenCalledWith('mat-cell', 'sub-bio');
  });

  it('renders document error state when document content fails to load', async () => {
    mockGetDocumentByMaterial.mockRejectedValueOnce(new Error('Network error'));

    render(
      <PreviewMaterialScreen materialId="mat-cell" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Document could not be loaded.')).toBeInTheDocument();
    });
  });

  it('calls onBack when clicking the breadcrumb', async () => {
    render(
      <PreviewMaterialScreen materialId="mat-cell" onBack={onBack} onOpenMaterial={onOpenMaterial} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Cell Structure & Organelles' })).toBeInTheDocument();
    });

    const breadcrumbBtn = screen.getByRole('button', { name: 'Available Materials' });
    fireEvent.click(breadcrumbBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
