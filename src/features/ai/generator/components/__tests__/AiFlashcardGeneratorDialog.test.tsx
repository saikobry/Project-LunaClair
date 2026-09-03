import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { AiFlashcardGeneratorDialog } from '../AiFlashcardGeneratorDialog';
import type { GeneratedFlashcardDraft } from '../../../../../domain/generator/models/generator.types';

describe('AiFlashcardGeneratorDialog', () => {
  const mockCards: GeneratedFlashcardDraft[] = [
    {
      front: 'What is the powerhouse of the cell?',
      back: 'Mitochondria',
      explanation: 'Generates ATP.',
    },
    {
      front: 'What is the genetic material in human cells?',
      back: 'DNA (Deoxyribonucleic Acid)',
      explanation: 'Housed in the nucleus.',
    },
  ];

  function renderWithContext(ui: React.ReactElement, overrides: Partial<any> = {}) {
    const mockUseCases = {
      generator: {
        generateFlashcards: {
          execute: vi.fn().mockResolvedValue(mockCards),
        },
        batchCreateFlashcards: {
          execute: vi.fn().mockResolvedValue([
            { id: 'q-c1', prompt: mockCards[0].front, status: 'draft' },
            { id: 'q-c2', prompt: mockCards[1].front, status: 'draft' },
          ]),
        },
      },
      ...overrides,
    };

    const mockContext: any = {
      useCases: mockUseCases,
    };

    return {
      ...render(
        <ApplicationContext.Provider value={mockContext}>
          {ui}
        </ApplicationContext.Provider>,
      ),
      mockUseCases,
    };
  }

  it('renders flashcard configuration form with count pills', () => {
    renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
        documentMarkdown="# Cell Content"
      />,
    );

    expect(screen.getByText('Generate Flashcards with AI')).toBeInTheDocument();
    expect(screen.getByText('Cell Biology')).toBeInTheDocument();
    expect(screen.getByText('8 Cards')).toBeInTheDocument();
    expect(screen.getByText('Generate Flashcards')).toBeInTheDocument();
  });

  it('executes flashcard generation and renders front and back card previews', async () => {
    const { mockUseCases } = renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
        documentMarkdown="# Cell Content"
      />,
    );

    fireEvent.click(screen.getByText('Generate Flashcards'));

    await waitFor(() => {
      expect(mockUseCases.generator.generateFlashcards.execute).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('What is the powerhouse of the cell?')).toBeInTheDocument();
      expect(screen.getByText('Mitochondria')).toBeInTheDocument();
      expect(screen.getByText('What is the genetic material in human cells?')).toBeInTheDocument();
      expect(screen.getByText('DNA (Deoxyribonucleic Acid)')).toBeInTheDocument();
    });
  });

  it('saves selected flashcards and triggers onSuccess', async () => {
    const onSuccess = vi.fn();
    const { mockUseCases } = renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
        documentMarkdown="# Cell Content"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByText('Generate Flashcards'));

    await waitFor(() => {
      expect(screen.getByText('Add 2 Flashcards to Deck')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add 2 Flashcards to Deck'));

    await waitFor(() => {
      expect(mockUseCases.generator.batchCreateFlashcards.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          materialId: 'mat-cell-1',
          status: 'draft',
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith(2);
      expect(screen.getByText('Flashcards Saved!')).toBeInTheDocument();
    });
  });
});
