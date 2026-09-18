import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReaderScreen from '../ReaderScreen';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../app/providers/ToastContext';
import { FocusModeProvider } from '../../../app/providers/FocusModeContext';
import { DocumentNotFoundError } from '../../../domain/reader/errors/DocumentNotFoundError';
import * as useMaterialModule from '../../materials/hooks/queries/useMaterial';
import * as useDocumentModule from '../hooks/useDocument';
import * as useHighlightsModule from '../hooks/useHighlights';
import * as useDrawingsModule from '../hooks/useDrawings';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Document } from '../../../domain/reader/models/Document';

describe('ReaderScreen', () => {
  let queryClient: QueryClient;
  let mockContext: any;
  let mockClearHighlights: ReturnType<typeof vi.fn>;
  let mockClearDrawings: ReturnType<typeof vi.fn>;

  const mockMaterial: StudyMaterial = {
    id: 'mat-101',
    title: 'Cell Biology Notes',
    documentId: 'doc-101',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  };

  const mockDocument: Document = {
    id: 'doc-101',
    title: 'Cell Biology Notes',
    content: '# Cell Biology\n\nMitochondria generate ATP.',
    format: 'markdown',
  };

  beforeEach(() => {
    // Polyfill scrollTo / scrollIntoView in JSDOM
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockClearHighlights = vi.fn();
    mockClearDrawings = vi.fn();

    mockContext = {
      repositories: {
        library: {
          getMaterialById: vi.fn().mockResolvedValue(mockMaterial),
        },
        document: {
          getDocumentByMaterial: vi.fn().mockResolvedValue(mockDocument),
        },
        asset: {
          getByMaterialId: vi.fn().mockResolvedValue([]),
        },
        annotation: {
          getHighlights: vi.fn().mockResolvedValue([]),
          getDrawings: vi.fn().mockResolvedValue([]),
        },
      },
      useCases: {
        reader: {
          saveHighlight: { execute: vi.fn().mockResolvedValue(undefined) },
          saveDrawing: { execute: vi.fn().mockResolvedValue(undefined) },
          clearAnnotations: { execute: vi.fn().mockResolvedValue(undefined) },
        },
      },
    };

    vi.spyOn(useMaterialModule, 'useMaterial').mockReturnValue({
      material: mockMaterial,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.spyOn(useDocumentModule, 'useDocument').mockReturnValue({
      data: mockDocument,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useHighlightsModule, 'useHighlights').mockReturnValue({
      highlights: [],
      containerRef: { current: null },
      addHighlight: vi.fn(),
      deleteHighlight: vi.fn(),
      clearHighlights: mockClearHighlights,
    } as any);

    vi.spyOn(useDrawingsModule, 'useDrawings').mockReturnValue({
      paths: [],
      handlePathsChange: vi.fn(),
      handleUndo: vi.fn(),
      clearDrawings: mockClearDrawings,
    } as any);
  });

  const renderScreen = (props: Partial<React.ComponentProps<typeof ReaderScreen>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContext}>
          <FocusModeProvider isFocusMode={false}>
            <ToastProvider>
              <ReaderScreen materialId="mat-101" {...props} />
            </ToastProvider>
          </FocusModeProvider>
        </ApplicationContext.Provider>
      </QueryClientProvider>,
    );
  };

  it('renders loading state when material or document is loading', () => {
    vi.spyOn(useMaterialModule, 'useMaterial').mockReturnValue({
      material: null,
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    renderScreen();

    expect(screen.getByText('Loading document...')).toBeInTheDocument();
  });

  it('renders ErrorState when material is not found', () => {
    vi.spyOn(useMaterialModule, 'useMaterial').mockReturnValue({
      material: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderScreen();

    expect(screen.getByText('Material could not be found.')).toBeInTheDocument();
  });

  it('renders ErrorState when DocumentNotFoundError is encountered', () => {
    vi.spyOn(useDocumentModule, 'useDocument').mockReturnValue({
      data: null,
      isLoading: false,
      error: new DocumentNotFoundError('doc-101'),
    } as any);

    renderScreen();

    expect(screen.getByText('Document could not be found.')).toBeInTheDocument();
    expect(screen.getByText('This material may have been moved or deleted.')).toBeInTheDocument();
  });

  it('renders generic ErrorState when unexpected error occurs', () => {
    vi.spyOn(useDocumentModule, 'useDocument').mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Unexpected database failure'),
    } as any);

    renderScreen();

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred while loading this document.')).toBeInTheDocument();
  });

  it('renders empty content state when document content is blank', () => {
    vi.spyOn(useDocumentModule, 'useDocument').mockReturnValue({
      data: { id: 'doc-101', title: 'Empty', content: '   ', format: 'markdown' },
      isLoading: false,
      error: null,
    } as any);

    const onNavigateToWrite = vi.fn();
    renderScreen({ onNavigateToWrite });

    expect(screen.getByText('No Content Yet')).toBeInTheDocument();
    const startWritingBtn = screen.getByRole('button', { name: /Start Writing/i });
    expect(startWritingBtn).toBeInTheDocument();

    fireEvent.click(startWritingBtn);
    expect(onNavigateToWrite).toHaveBeenCalledTimes(1);
  });

  it('renders reader viewer with content when document is loaded', () => {
    renderScreen();

    expect(screen.getByText('Mitochondria generate ATP.')).toBeInTheDocument();
  });

  it('handles clearing drawings via confirmation dialog', async () => {
    vi.spyOn(useDrawingsModule, 'useDrawings').mockReturnValue({
      paths: [{ id: 'p1', color: '#ff0000', thickness: 4, points: [] }],
      handlePathsChange: vi.fn(),
      handleUndo: vi.fn(),
      clearDrawings: mockClearDrawings,
    } as any);

    renderScreen();

    // Open toolbar first
    const openToolbarBtn = screen.getByLabelText(/Open Annotations/i);
    fireEvent.click(openToolbarBtn);

    // Look for clear drawings action in toolbar
    const clearDrawingsBtn = screen.getByLabelText(/Clear all drawings/i);
    fireEvent.click(clearDrawingsBtn);

    expect(screen.getByText('Clear Drawings')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to clear all drawings? This cannot be undone.')).toBeInTheDocument();

    // Confirm dialog
    const confirmBtn = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockClearDrawings).toHaveBeenCalledTimes(1);
    });
  });

  it('handles clearing highlights via confirmation dialog', async () => {
    vi.spyOn(useHighlightsModule, 'useHighlights').mockReturnValue({
      highlights: [{ id: 'hl-1', start: 0, end: 5, color: 'yellow', text: 'Hello' }],
      containerRef: { current: null },
      addHighlight: vi.fn(),
      deleteHighlight: vi.fn(),
      clearHighlights: mockClearHighlights,
    } as any);

    renderScreen();

    // Open toolbar first
    const openToolbarBtn = screen.getByLabelText(/Open Annotations/i);
    fireEvent.click(openToolbarBtn);

    const clearHighlightsBtn = screen.getByLabelText(/Clear all highlights/i);
    fireEvent.click(clearHighlightsBtn);

    expect(screen.getByText('Clear Highlights')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to clear all highlights? This cannot be undone.')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockClearHighlights).toHaveBeenCalledTimes(1);
    });
  });
});
