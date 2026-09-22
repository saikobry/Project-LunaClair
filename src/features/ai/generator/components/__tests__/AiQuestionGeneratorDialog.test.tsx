import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { AiQuestionGeneratorDialog } from '../AiQuestionGeneratorDialog';
import type { GeneratedQuestionDraft } from '../../../../../domain/generator/models/generator.types';

describe('AiQuestionGeneratorDialog', () => {
  const mockDrafts: GeneratedQuestionDraft[] = [
    {
      type: 'multiple_choice',
      prompt: 'Which organelle synthesizes ATP?',
      payload: {
        type: 'multiple_choice',
        choices: ['Mitochondria', 'Ribosome', 'Nucleus'],
        correctIndex: 0,
      },
      difficulty: 'easy',
      points: 1,
      tags: ['cell biology', 'organelles'],
      explanation: 'Mitochondria produce ATP via cellular respiration.',
    },
    {
      type: 'true_false',
      prompt: 'Plant cells lack a cell wall.',
      payload: {
        type: 'true_false',
        correctAnswer: false,
      },
      difficulty: 'easy',
      points: 1,
      explanation: 'Plant cells have a cellulose cell wall.',
    },
  ];

  function renderWithContext(ui: React.ReactElement, overrides: Partial<any> = {}) {
    const mockUseCases = {
      generator: {
        generateQuestions: {
          execute: vi.fn().mockResolvedValue({ drafts: mockDrafts, rejected: [] }),
        },
        batchCreateQuestions: {
          execute: vi.fn().mockResolvedValue([
            { id: 'q-1', prompt: mockDrafts[0].prompt, status: 'draft' },
            { id: 'q-2', prompt: mockDrafts[1].prompt, status: 'draft' },
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

  it('renders configuration form with question options', () => {
    renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
      />,
    );

    expect(screen.getByText('Generate Questions with AI')).toBeInTheDocument();
    expect(screen.getByText('Cell Biology')).toBeInTheDocument();
    expect(screen.getByText('Generate Questions')).toBeInTheDocument();
    expect(screen.getByText('5 Questions')).toBeInTheDocument();
  });

  it('offers every catalog model and states the scope of the choice', () => {
    renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
      />,
    );

    // The bundled catalog mirror supplies both models and its own default, so the picker renders and
    // opens on Standard rather than implying a silent choice.
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('MAX')).toBeInTheDocument();
    // The choice is per batch: the note is the contract the user can see.
    expect(screen.getByText(/your chat model is unchanged/i)).toBeInTheDocument();
  });

  it('runs the batch on the model chosen here, and keeps it across Back', async () => {
    const { mockUseCases } = renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
      />,
    );

    fireEvent.click(screen.getByText('MAX'));
    fireEvent.click(screen.getByText('Generate Questions'));

    await waitFor(() => {
      expect(mockUseCases.generator.generateQuestions.execute).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'ukisai-swift-max' }),
      );
    });

    // Returning to configuration must not silently revert the choice to the preferred model.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByText('Generate Questions'));

    await waitFor(() => {
      expect(mockUseCases.generator.generateQuestions.execute).toHaveBeenLastCalledWith(
        expect.objectContaining({ model: 'ukisai-swift-max' }),
      );
    });
  });

  it('blocks generation and says why when the assistant is switched off', async () => {
    renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
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
    expect(screen.getByRole('button', { name: /Generate Questions/i })).toBeDisabled();
  });

  it('executes generation flow and transitions to review screen with generated cards', async () => {
    const { mockUseCases } = renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
      />,
    );

    fireEvent.click(screen.getByText('Generate Questions'));

    await waitFor(() => {
      expect(mockUseCases.generator.generateQuestions.execute).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Which organelle synthesizes ATP?')).toBeInTheDocument();
      expect(screen.getByText('Plant cells lack a cell wall.')).toBeInTheDocument();
      expect(screen.getByText(/Generated 2 questions/)).toBeInTheDocument();
    });
  });

  it('shows the tags each draft will be saved with, and names the ones with none', async () => {
    renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
      />,
    );

    fireEvent.click(screen.getByText('Generate Questions'));

    await waitFor(() => {
      // Tags are set before the row is persisted, so review is the only chance to see them.
      expect(screen.getByText('cell biology')).toBeInTheDocument();
      expect(screen.getByText('organelles')).toBeInTheDocument();
      // A draft the model gave no tags says so, instead of an empty gap that reads as a bug.
      expect(screen.getByText('No tags suggested')).toBeInTheDocument();
    });
  });

  it('reports drafts the model produced that were dropped', async () => {
    renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
      />,
      {
        generator: {
          generateQuestions: {
            execute: vi
              .fn()
              .mockResolvedValue({
                drafts: mockDrafts,
                rejected: [{ index: 1, error: 'Invalid question type: _false' }],
              }),
          },
          batchCreateQuestions: {
            execute: vi.fn().mockResolvedValue([]),
          },
        },
      },
    );

    fireEvent.click(screen.getByText('Generate Questions'));

    await waitFor(() => {
      // Salvaging is deliberate, but the gap is named rather than left as a silent shortfall.
      expect(screen.getByText(/1 question could not be read and was skipped/i)).toBeInTheDocument();
    });
  });

  it('saves selected questions and shows success state', async () => {
    const onSuccess = vi.fn();
    const { mockUseCases } = renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByText('Generate Questions'));

    await waitFor(() => {
      expect(screen.getByText('Add 2 Questions to Bank')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add 2 Questions to Bank'));

    await waitFor(() => {
      expect(mockUseCases.generator.batchCreateQuestions.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          materialId: 'mat-1',
          status: 'draft',
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith(2);
      expect(screen.getByText('Questions Saved!')).toBeInTheDocument();
    });
  });
});
