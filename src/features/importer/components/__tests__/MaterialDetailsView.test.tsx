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
      file: new File([''], 'cell_bio.pdf', { type: 'application/pdf' }),
      status: 'review',
      title: 'Introduction to Cell Biology',
      markdown: '# Cell Bio',
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
    const onCommit = vi.fn();

    render(
      <MaterialDetailsView
        candidates={mockCandidates}
        onUpdateTitle={onUpdateTitle}
        onCommit={onCommit}
      />,
    );

    expect(screen.getByText('Material Details')).toBeInTheDocument();
    expect(screen.getByText('Title (cell_bio.pdf)')).toBeInTheDocument();
    expect(screen.getByText('Title (genetics.pdf)')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(inputs[0].value).toBe('Introduction to Cell Biology');
    expect(inputs[1].value).toBe('Mendelian Genetics');
  });

  it('invokes onUpdateTitle when title input is edited', () => {
    const onUpdateTitle = vi.fn();
    const onCommit = vi.fn();

    render(
      <MaterialDetailsView
        candidates={mockCandidates}
        onUpdateTitle={onUpdateTitle}
        onCommit={onCommit}
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Advanced Cell Biology' } });

    expect(onUpdateTitle).toHaveBeenCalledTimes(1);
    expect(onUpdateTitle).toHaveBeenCalledWith('cand-1', 'Advanced Cell Biology');
  });

  it('invokes onCommit when Save to Library button is clicked', () => {
    const onUpdateTitle = vi.fn();
    const onCommit = vi.fn();

    render(
      <MaterialDetailsView
        candidates={mockCandidates}
        onUpdateTitle={onUpdateTitle}
        onCommit={onCommit}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save to library/i });
    fireEvent.click(saveButton);

    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
