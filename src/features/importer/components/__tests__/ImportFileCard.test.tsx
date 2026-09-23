import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportFileCard } from '../ImportFileCard';
import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';

describe('ImportFileCard', () => {
  const samplePdfCandidate: ImportCandidate = {
    id: 'cand-1',
    filename: 'anatomy_lecture.pdf',
    source: 'pdf',
    file: new File([new ArrayBuffer(2 * 1024 * 1024)], 'anatomy_lecture.pdf', {
      type: 'application/pdf',
    }),
    status: 'pending',
  };

  const sampleImageCandidate: ImportCandidate = {
    id: 'cand-2',
    filename: 'whiteboard_notes.jpg',
    source: 'image',
    file: new File([new ArrayBuffer(1024 * 512)], 'whiteboard_notes.jpg', {
      type: 'image/jpeg',
    }),
    status: 'done',
  };

  it('renders candidate file details for PDF', () => {
    const onRemove = vi.fn();
    render(<ImportFileCard candidate={samplePdfCandidate} onRemove={onRemove} />);

    expect(screen.getByText('anatomy_lecture.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.00 MB')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders candidate file details for Image source', () => {
    const onRemove = vi.fn();
    render(<ImportFileCard candidate={sampleImageCandidate} onRemove={onRemove} />);

    expect(screen.getByText('whiteboard_notes.jpg')).toBeInTheDocument();
    expect(screen.getByText('0.50 MB')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('invokes onRemove with candidate ID on remove button click', () => {
    const onRemove = vi.fn();
    render(<ImportFileCard candidate={samplePdfCandidate} onRemove={onRemove} />);

    const removeBtn = screen.getByRole('button');
    fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('cand-1');
  });

  it('renders partial extraction metadata and handles onReview and onRetry callbacks', () => {
    const onRemove = vi.fn();
    const onReview = vi.fn();
    const onRetry = vi.fn();

    const partialCandidate: ImportCandidate = {
      id: 'cand-partial',
      filename: 'slides.pdf',
      source: 'pdf',
      file: new File([''], 'slides.pdf', { type: 'application/pdf' }),
      status: 'review',
      extraction: {
        text: 'Partial text',
        pageCount: 10,
        pages: [
          { pageNumber: 1, text: 'P1', confidence: 1, source: 'pdf-text' },
          { pageNumber: 2, text: 'P2', confidence: 1, source: 'pdf-text' },
        ],
        stats: { wordCount: 2, characterCount: 10, headingsDetected: 0, ocrPages: 0, textPages: 2 },
        isPartial: true,
      },
    };

    render(
      <ImportFileCard
        candidate={partialCandidate}
        onRemove={onRemove}
        onReview={onReview}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('partial')).toBeInTheDocument();
    expect(screen.getByText(/Partial \(2 of 10 pages\)/)).toBeInTheDocument();

    const reviewBtn = screen.getByRole('button', { name: /review partial/i });
    fireEvent.click(reviewBtn);
    expect(onReview).toHaveBeenCalledWith('cand-partial');

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith('cand-partial');
  });

  it('renders Re-extract button for completed review candidate and triggers onRetry', () => {
    const onRemove = vi.fn();
    const onReview = vi.fn();
    const onRetry = vi.fn();

    const reviewCandidate: ImportCandidate = {
      id: 'cand-review',
      filename: 'complete.pdf',
      source: 'pdf',
      file: new File([''], 'complete.pdf', { type: 'application/pdf' }),
      status: 'review',
      extraction: {
        text: 'Full text',
        pageCount: 1,
        pages: [{ pageNumber: 1, text: 'P1', confidence: 1, source: 'pdf-text' }],
        stats: { wordCount: 2, characterCount: 9, headingsDetected: 0, ocrPages: 0, textPages: 1 },
        isPartial: false,
      },
    };

    render(
      <ImportFileCard
        candidate={reviewCandidate}
        onRemove={onRemove}
        onReview={onReview}
        onRetry={onRetry}
      />,
    );

    const reExtractBtn = screen.getByRole('button', { name: /re-extract/i });
    expect(reExtractBtn).toBeInTheDocument();
    fireEvent.click(reExtractBtn);
    expect(onRetry).toHaveBeenCalledWith('cand-review');
  });
});
