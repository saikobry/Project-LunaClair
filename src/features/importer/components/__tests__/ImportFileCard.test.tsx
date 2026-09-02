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
});
