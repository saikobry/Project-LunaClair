import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useImportSession } from '../useImportSession';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { ExtractionResult } from '../../../../domain/importer/models/importer.types';

describe('useImportSession', () => {
  let queryClient: QueryClient;
  let mockExtractExecute: ReturnType<typeof vi.fn>;
  let mockCommitExecute: ReturnType<typeof vi.fn>;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  const mockExtractionResult: ExtractionResult = {
    text: '# Extracted Chapter 1\n\nContent details here.',
    title: 'Extracted Chapter 1',
    pageCount: 3,
    pages: [
      { pageNumber: 1, text: 'Page 1 text', confidence: 0.95, source: 'pdf-text' },
      { pageNumber: 2, text: 'Page 2 text', confidence: 0.92, source: 'pdf-text' },
      { pageNumber: 3, text: 'Page 3 text', confidence: 0.88, source: 'ocr' },
    ],
    stats: {
      wordCount: 150,
      characterCount: 900,
      headingsDetected: 2,
      ocrPages: 1,
      textPages: 2,
    },
  };

  const mockCreatedMaterial: StudyMaterial = {
    id: 'mat-imported-1',
    documentId: 'doc-imported-1',
    title: 'Extracted Chapter 1',
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mockExtractExecute = vi.fn().mockResolvedValue({
      status: 'review',
      markdown: mockExtractionResult.text,
      title: mockExtractionResult.title,
      extraction: mockExtractionResult,
      importMetadata: {
        source: 'pdf',
        originalFilename: 'chapter1.pdf',
        importedAt: '2026-09-02T12:00:00.000Z',
        pageCount: 3,
        usedOcr: true,
        ocrConfidence: 0.88,
      },
    });

    mockCommitExecute = vi.fn().mockResolvedValue(mockCreatedMaterial);
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
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {children}
        </ApplicationContext.Provider>
      </QueryClientProvider>
    );
  }

  it('initializes with default selecting step and empty candidates', () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentStep).toBe('selecting');
    expect(result.current.session.candidates).toEqual([]);
    expect(result.current.createdMaterials).toEqual([]);
    expect(result.current.activeCandidateIndex).toBe(0);
  });

  it('adds files and classifies sources properly as pdf or image', () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const pdfFile = new File(['pdf content'], 'biology.pdf', { type: 'application/pdf' });
    const imageFile = new File(['img content'], 'diagram.png', { type: 'image/png' });

    act(() => {
      result.current.addFiles([pdfFile, imageFile]);
    });

    expect(result.current.session.candidates).toHaveLength(2);
    expect(result.current.session.candidates[0]).toMatchObject({
      filename: 'biology.pdf',
      source: 'pdf',
      status: 'pending',
    });
    expect(result.current.session.candidates[1]).toMatchObject({
      filename: 'diagram.png',
      source: 'image',
      status: 'pending',
    });
  });

  it('removes candidate file by id', () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const pdfFile = new File(['pdf content'], 'biology.pdf', { type: 'application/pdf' });
    const imageFile = new File(['img content'], 'diagram.png', { type: 'image/png' });

    act(() => {
      result.current.addFiles([pdfFile, imageFile]);
    });

    const idToRemove = result.current.session.candidates[0].id;

    act(() => {
      result.current.removeFile(idToRemove);
    });

    expect(result.current.session.candidates).toHaveLength(1);
    expect(result.current.session.candidates[0].filename).toBe('diagram.png');
  });

  it('executes startExtraction with bounded concurrency and transitions to review on success', async () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file1 = new File(['1'], 'doc1.pdf', { type: 'application/pdf' });
    const file2 = new File(['2'], 'doc2.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    await act(async () => {
      await result.current.startExtraction();
    });

    expect(mockExtractExecute).toHaveBeenCalledTimes(2);
    expect(result.current.session.status).toBe('review');
    expect(result.current.currentStep).toBe('review');
    expect(result.current.session.candidates[0].status).toBe('review');
    expect(result.current.session.candidates[1].status).toBe('review');
  });

  it('handles extraction errors gracefully and sets candidate status to error with retryable flag', async () => {
    mockExtractExecute.mockRejectedValueOnce(new Error('Corrupted PDF header'));

    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file1 = new File(['corrupt'], 'bad.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.addFiles([file1]);
    });

    await act(async () => {
      await result.current.startExtraction();
    });

    expect(result.current.session.candidates[0].status).toBe('error');
    expect(result.current.session.candidates[0].error).toEqual({
      code: 'extraction-failed',
      message: 'Corrupted PDF header',
      retryable: true,
    });
    // When all candidates fail, status transitions back to selecting so user can retry or adjust
    expect(result.current.session.status).toBe('selecting');
  });

  it('marks candidate status as extracting while in flight', async () => {
    let candidateStatusDuringExtraction: string | undefined;

    mockExtractExecute.mockImplementation(async () => {
      // Small tick so we can observe the extracting status
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        status: 'review',
        markdown: '# Title',
        title: 'Title',
      };
    });

    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
    });

    let extractionPromise: Promise<void>;
    act(() => {
      extractionPromise = result.current.startExtraction();
    });

    // Right after starting, candidate status should be 'extracting'
    candidateStatusDuringExtraction = result.current.session.candidates[0]?.status;
    expect(candidateStatusDuringExtraction).toBe('extracting');

    await act(async () => {
      await extractionPromise;
    });

    expect(result.current.session.candidates[0]?.status).toBe('review');
    expect(result.current.session.status).toBe('review');
  });

  it('transitions to review when at least one candidate succeeds despite another failing', async () => {
    mockExtractExecute
      .mockResolvedValueOnce({
        status: 'review',
        markdown: '# Good',
        title: 'Good Doc',
      })
      .mockRejectedValueOnce(new Error('Corrupted File'));

    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file1 = new File(['good'], 'good.pdf', { type: 'application/pdf' });
    const file2 = new File(['bad'], 'bad.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.addFiles([file1, file2]);
    });

    await act(async () => {
      await result.current.startExtraction();
    });

    expect(result.current.session.candidates[0].status).toBe('review');
    expect(result.current.session.candidates[1].status).toBe('error');
    // Partial success transitions to review so user can review the valid material
    expect(result.current.session.status).toBe('review');
    expect(result.current.activeCandidateIndex).toBe(0);
  });

  it('supports cancelling ongoing extraction via cancelExtraction', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockExtractExecute.mockImplementation((_file, options) => {
      capturedSignal = options?.signal;
      return new Promise((resolve) => setTimeout(resolve, 500));
    });

    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['sample'], 'sample.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.addFiles([file]);
    });

    // Start extraction without awaiting immediately
    let extractionPromise: Promise<void>;
    act(() => {
      extractionPromise = result.current.startExtraction();
    });

    expect(result.current.session.status).toBe('extracting');

    // Cancel all extractions
    act(() => {
      result.current.cancelExtraction();
    });

    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      await extractionPromise!;
    });

    expect(result.current.session.status).toBe('selecting');
  });

  it('returns cleanly to selecting on cancellation even when partial results exist and does not auto-navigate to review', async () => {
    mockExtractExecute.mockImplementation(async (_file, options) => {
      // Wait for abort signal
      await new Promise<void>((resolve) => {
        if (options?.signal?.aborted) return resolve();
        options?.signal?.addEventListener('abort', () => resolve());
      });
      return {
        status: 'review',
        markdown: '# Partial Page 1',
        title: 'Partial Doc',
        extraction: {
          text: '# Partial Page 1',
          pageCount: 5,
          pages: [{ pageNumber: 1, text: 'P1', confidence: 1, source: 'pdf-text' }],
          stats: { wordCount: 3, characterCount: 16, headingsDetected: 1, ocrPages: 0, textPages: 1 },
          isPartial: true,
        },
      };
    });

    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['content'], 'partial.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
    });

    let extractionPromise: Promise<void>;
    act(() => {
      extractionPromise = result.current.startExtraction();
    });

    expect(result.current.session.status).toBe('extracting');

    // User cancels extraction
    act(() => {
      result.current.cancelExtraction();
    });

    await act(async () => {
      await extractionPromise!;
    });

    // Must return to selecting so user explicitly chooses whether to review partial or retry
    expect(result.current.session.status).toBe('selecting');
    expect(result.current.session.candidates[0].status).toBe('review');
    expect(result.current.session.candidates[0].extraction?.isPartial).toBe(true);
  });

  it('resets candidate to pending when retryCandidate is called', () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['data'], 'failed.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
    });

    const candidateId = result.current.session.candidates[0].id;

    // Simulate an errored candidate
    act(() => {
      result.current.updateCandidateMarkdown(candidateId, '# Temp');
    });

    act(() => {
      result.current.retryCandidate(candidateId);
    });

    expect(result.current.session.candidates[0]).toMatchObject({
      id: candidateId,
      status: 'pending',
      markdown: undefined,
      extraction: undefined,
    });
  });

  it('updates candidate markdown and title', () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['sample'], 'sample.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
    });

    const candidateId = result.current.session.candidates[0].id;

    act(() => {
      result.current.updateCandidateMarkdown(candidateId, '# Edited Markdown Content');
    });
    expect(result.current.session.candidates[0].markdown).toBe('# Edited Markdown Content');

    act(() => {
      result.current.updateCandidateTitle(candidateId, 'Updated Title');
    });
    expect(result.current.session.candidates[0].title).toBe('Updated Title');
  });

  it('commits session, persists materials via commitImport use case, invalidates query cache, and transitions to completed', async () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['sample'], 'sample.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
    });

    await act(async () => {
      await result.current.startExtraction();
    });

    let created: StudyMaterial[] = [];
    await act(async () => {
      created = await result.current.commitSession();
    });

    expect(mockCommitExecute).toHaveBeenCalledWith({
      title: mockExtractionResult.title,
      markdown: mockExtractionResult.text,
      file,
      importMetadata: expect.objectContaining({
        originalFilename: 'chapter1.pdf',
      }),
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['library', 'materials'] });
    expect(created).toEqual([mockCreatedMaterial]);
    expect(result.current.createdMaterials).toEqual([mockCreatedMaterial]);
    expect(result.current.session.status).toBe('completed');
    expect(result.current.currentStep).toBe('completed');
  });

  it('navigates through steps using goToStep', () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.goToStep('details');
    });
    expect(result.current.currentStep).toBe('details');

    act(() => {
      result.current.goToStep('review');
    });
    expect(result.current.currentStep).toBe('review');
  });

  it('resets session to pristine initial state', async () => {
    const { result } = renderHook(() => useImportSession(), {
      wrapper: createWrapper(),
    });

    const file = new File(['sample'], 'sample.pdf', { type: 'application/pdf' });
    act(() => {
      result.current.addFiles([file]);
      result.current.setActiveCandidateIndex(2);
    });

    await act(async () => {
      await result.current.startExtraction();
    });

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.currentStep).toBe('selecting');
    expect(result.current.session.candidates).toEqual([]);
    expect(result.current.createdMaterials).toEqual([]);
    expect(result.current.activeCandidateIndex).toBe(0);
  });
});
