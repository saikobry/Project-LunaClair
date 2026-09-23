import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialDetailsView } from '../MaterialDetailsView';
import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';

describe('MaterialDetailsView', () => {
  const mockCandidates: ImportCandidate[] = [
    {
      id: 'cand-1',
      filename: 'cell_bio.pdf',
      source: 'pdf',
      file: new File([new ArrayBuffer(2 * 1024 * 1024)], 'cell_bio.pdf', { type: 'application/pdf' }),
      status: 'review',
      title: 'Introduction to Cell Biology',
      markdown: '# Cell Bio today',
      extraction: {
        text: '# Cell Bio today',
        pageCount: 3,
        pages: [],
        stats: {
          wordCount: 4,
          characterCount: 20,
          headingsDetected: 1,
          ocrPages: 0,
          textPages: 3,
        },
      },
    },
    {
      id: 'cand-2',
      filename: 'genetics.pdf',
      source: 'pdf',
      file: new File([''], 'genetics.pdf', { type: 'application/pdf' }),
      status: 'review',
      title: 'Mendelian Genetics',
      markdown: '# Genetics',
    },
  ];

  it('renders title input fields populated with existing candidate titles', () => {
    const onUpdateTitle = vi.fn();

    render(
      <MaterialDetailsView
        candidates={mockCandidates}
        onUpdateTitle={onUpdateTitle}
      />,
    );

    expect(screen.getByText('Material Details')).toBeInTheDocument();
    expect(
      screen.getByText('Review metadata and customize how your materials will appear in your library.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Material Title')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Material Title for cell_bio.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Material Title for genetics.pdf' })).toBeInTheDocument();
    expect(
      screen.getAllByText('Displayed in your library, search, and study sessions'),
    ).toHaveLength(2);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs[0].value).toBe('Introduction to Cell Biology');
    expect(inputs[1].value).toBe('Mendelian Genetics');
  });

  it('invokes onUpdateTitle when title input is edited', () => {
    const onUpdateTitle = vi.fn();

    render(
      <MaterialDetailsView
        candidates={mockCandidates}
        onUpdateTitle={onUpdateTitle}
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Advanced Cell Biology' } });

    expect(onUpdateTitle).toHaveBeenCalledTimes(1);
    expect(onUpdateTitle).toHaveBeenCalledWith('cand-1', 'Advanced Cell Biology');
  });

  it('renders the document summary metadata for each candidate', () => {
    render(<MaterialDetailsView candidates={mockCandidates} onUpdateTitle={vi.fn()} />);

    expect(screen.getByText('2.00 MB')).toBeInTheDocument();
    expect(screen.getByText('4 words')).toBeInTheDocument();
    expect(screen.getByText('3 pages')).toBeInTheDocument();
  });

  it('degrades the metadata row when extraction data is absent', () => {
    render(<MaterialDetailsView candidates={[mockCandidates[1]]} onUpdateTitle={vi.fn()} />);

    // No extraction result => no page claim, and the word count is estimated
    // from the markdown rather than rendering an empty badge.
    expect(screen.queryByText(/pages?$/)).not.toBeInTheDocument();
    expect(screen.getByText('1 word')).toBeInTheDocument();
  });

  it('owns no commit action — the wizard footer owns Save to Library', () => {
    render(<MaterialDetailsView candidates={mockCandidates} onUpdateTitle={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /save to library/i })).not.toBeInTheDocument();
  });
});
