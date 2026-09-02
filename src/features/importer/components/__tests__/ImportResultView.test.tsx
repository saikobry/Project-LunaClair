import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportResultView } from '../ImportResultView';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('ImportResultView', () => {
  const singleMaterial: StudyMaterial[] = [
    {
      id: 'mat-1',
      title: 'Human Anatomy',
      documentId: 'doc-1',
      subjectId: 'sub-med',
      createdAt: '2026-09-02T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
  ];

  const multipleMaterials: StudyMaterial[] = [
    {
      id: 'mat-1',
      title: 'Human Anatomy',
      documentId: 'doc-1',
      subjectId: 'sub-med',
      createdAt: '2026-09-02T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
    {
      id: 'mat-2',
      title: 'Physiology Basics',
      documentId: 'doc-2',
      subjectId: 'sub-med',
      createdAt: '2026-09-02T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
  ];

  it('renders single material result with Open Material and Open in Workspace buttons', () => {
    const onImportAnother = vi.fn();
    const onOpenMaterial = vi.fn();

    render(
      <ImportResultView
        createdMaterials={singleMaterial}
        onImportAnother={onImportAnother}
        onOpenMaterial={onOpenMaterial}
      />,
    );

    expect(screen.getByText('Import Successful')).toBeInTheDocument();
    expect(screen.getByText('1 material added to your library.')).toBeInTheDocument();
    expect(screen.getByText('Human Anatomy')).toBeInTheDocument();

    const openMaterialBtn = screen.getByRole('button', { name: /open material/i });
    fireEvent.click(openMaterialBtn);
    expect(onOpenMaterial).toHaveBeenCalledWith('mat-1', 'sub-med');

    const openInWorkspaceBtn = screen.getByRole('button', { name: /open in workspace/i });
    fireEvent.click(openInWorkspaceBtn);
    expect(onOpenMaterial).toHaveBeenCalledWith('mat-1', 'sub-med');

    const importMoreBtn = screen.getByRole('button', { name: /import more files/i });
    fireEvent.click(importMoreBtn);
    expect(onImportAnother).toHaveBeenCalledTimes(1);
  });

  it('renders multiple materials with pluralized label and individual open actions', () => {
    const onImportAnother = vi.fn();
    const onOpenMaterial = vi.fn();

    render(
      <ImportResultView
        createdMaterials={multipleMaterials}
        onImportAnother={onImportAnother}
        onOpenMaterial={onOpenMaterial}
      />,
    );

    expect(screen.getByText('2 materials added to your library.')).toBeInTheDocument();
    expect(screen.getByText('Human Anatomy')).toBeInTheDocument();
    expect(screen.getByText('Physiology Basics')).toBeInTheDocument();

    const openButtons = screen.getAllByRole('button', { name: /open material/i });
    expect(openButtons).toHaveLength(2);

    fireEvent.click(openButtons[1]);
    expect(onOpenMaterial).toHaveBeenCalledWith('mat-2', 'sub-med');

    // Open in Workspace should not be rendered for multiple materials
    expect(screen.queryByRole('button', { name: /open in workspace/i })).not.toBeInTheDocument();
  });
});
