import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtractionProgressView } from '../ExtractionProgressView';
import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';

describe('ExtractionProgressView', () => {
  const mockCandidates: ImportCandidate[] = [
    {
      id: 'cand-1',
      filename: 'chapter1.pdf',
      source: 'pdf',
      file: new File([''], 'chapter1.pdf', { type: 'application/pdf' }),
      status: 'extracting',
    },
    {
      id: 'cand-2',
      filename: 'chapter2.pdf',
      source: 'pdf',
      file: new File([''], 'chapter2.pdf', { type: 'application/pdf' }),
      status: 'error',
      error: { code: 'extraction-failed', message: 'Failed to extract', retryable: true },
    },
    {
      id: 'cand-3',
      filename: 'notes.png',
      source: 'image',
      file: new File([''], 'notes.png', { type: 'image/png' }),
      status: 'done',
    },
  ];

  it('renders extraction heading and candidate statuses', () => {
    render(<ExtractionProgressView candidates={mockCandidates} />);

    expect(screen.getByText('Extracting Content...')).toBeInTheDocument();
    expect(screen.getByText('chapter1.pdf')).toBeInTheDocument();
    expect(screen.getByText('chapter2.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.png')).toBeInTheDocument();

    expect(screen.getByText('extracting')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });
});
