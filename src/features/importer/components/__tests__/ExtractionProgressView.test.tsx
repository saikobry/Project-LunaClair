import { describe, it, expect, vi } from 'vitest';
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

  it('renders cancel button and triggers onCancel callback when clicked', async () => {
    const onCancel = vi.fn();
    render(<ExtractionProgressView candidates={mockCandidates} onCancel={onCancel} />);

    const cancelBtn = screen.getByRole('button', { name: /cancel extraction/i });
    expect(cancelBtn).toBeInTheDocument();

    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders progress bar and page label including cooldown state', () => {
    const progressMap = {
      'cand-1': {
        phase: 'cooldown' as const,
        current: 1,
        total: 3,
        percent: 33,
        pageLabel: 'Waiting for rate limit (cooldown 12s)...',
      },
    };

    render(
      <ExtractionProgressView
        candidates={[mockCandidates[0]]}
        progressMap={progressMap}
      />,
    );

    expect(
      screen.getByText('Waiting for rate limit (cooldown 12s)...'),
    ).toBeInTheDocument();
  });

  it('renders progress bar and page label for ai-vision phase with visual indicator', () => {
    const progressMap = {
      'cand-1': {
        phase: 'ai-vision' as const,
        current: 1,
        total: 2,
        percent: 50,
        pageLabel: 'AI Vision Page 1',
      },
    };

    const { container } = render(
      <ExtractionProgressView
        candidates={[mockCandidates[0]]}
        progressMap={progressMap}
      />,
    );

    expect(screen.getByText('AI Vision Page 1')).toBeInTheDocument();
    const phaseElement = container.querySelector('[data-phase="ai-vision"]');
    expect(phaseElement).toBeInTheDocument();
  });
});
