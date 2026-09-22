import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { AiFlashcardGeneratorDialog } from '../AiFlashcardGeneratorDialog';
import type { GeneratedFlashcardDraft } from '../../../../../domain/generator/models/generator.types';

describe('AiFlashcardGeneratorDialog', () => {
  const mockCards: GeneratedFlashcardDraft[] = [
    {
      front: 'What is the powerhouse of the cell?',
      back: 'Mitochondria',
      tags: ['cell biology', 'organelles'],
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
          execute: vi.fn().mockResolvedValue({ drafts: mockCards, rejected: [] }),
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

    // The dialog resolves its model through the shared catalog / preferred-model queries, so a query
    // client is required even though neither query is enabled by this mock.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return {
      ...render(
        <QueryClientProvider client={queryClient}>
          <ApplicationContext.Provider value={mockContext}>
            {ui}
          </ApplicationContext.Provider>
        </QueryClientProvider>,
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
      />,
    );

    expect(screen.getByText('Generate Flashcards with AI')).toBeInTheDocument();
    expect(screen.getByText('Cell Biology')).toBeInTheDocument();
    expect(screen.getByText('8 Cards')).toBeInTheDocument();
    expect(screen.getByText('Generate Flashcards')).toBeInTheDocument();
  });

  it('offers every catalog model and states the scope of the choice', () => {
    renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
      />,
    );

    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('MAX')).toBeInTheDocument();
    expect(screen.getByText(/your chat model is unchanged/i)).toBeInTheDocument();
  });

  it('runs the batch on the model chosen here, and keeps it across Back', async () => {
    const { mockUseCases } = renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
      />,
    );

    fireEvent.click(screen.getByText('MAX'));
    fireEvent.click(screen.getByText('Generate Flashcards'));

    await waitFor(() => {
      expect(mockUseCases.generator.generateFlashcards.execute).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'ukisai-swift-max' }),
      );
    });

    // Returning to configuration must not silently revert the choice to the preferred model.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByText('Generate Flashcards'));

    await waitFor(() => {
      expect(mockUseCases.generator.generateFlashcards.execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ model: 'ukisai-swift-max' }),
      );
    });
  });

  it('blocks generation and says why when the assistant is switched off', async () => {
    renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
      />,
      {
        ai: {
          getModelCatalog: {
            execute: vi.fn().mockResolvedValue({
              version: 'test',
              availability: 'disabled',
              defaultModelId: null,
              models: [],
            }),
          },
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText(/AI assistant is unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Generate Flashcards/i })).toBeDisabled();
  });

  it('executes flashcard generation and renders front and back card previews', async () => {
    const { mockUseCases } = renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
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

  it('shows the tags each card will be saved with, and names the ones with none', async () => {
    renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
      />,
    );

    fireEvent.click(screen.getByText('Generate Flashcards'));

    await waitFor(() => {
      expect(screen.getByText('cell biology')).toBeInTheDocument();
      expect(screen.getByText('organelles')).toBeInTheDocument();
      expect(screen.getByText('No tags suggested')).toBeInTheDocument();
    });
  });

  it('reports cards the model produced that were dropped', async () => {
    renderWithContext(
      <AiFlashcardGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-cell-1"
        materialTitle="Cell Biology"
      />,
      {
        generator: {
          generateFlashcards: {
            execute: vi.fn().mockResolvedValue({
              drafts: mockCards,
              rejected: [{ index: 1, error: 'Card requires non-empty front and back text' }],
            }),
          },
          batchCreateFlashcards: {
            execute: vi.fn().mockResolvedValue([]),
          },
        },
      },
    );

    fireEvent.click(screen.getByText('Generate Flashcards'));

    await waitFor(() => {
      expect(screen.getByText(/1 flashcard could not be read and was skipped/i)).toBeInTheDocument();
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
