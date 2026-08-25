import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { AiQuestionGeneratorDialog } from '../AiQuestionGeneratorDialog';
import type { GeneratedQuestionDraft } from '../../../../domain/generator/generator.types';

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
          execute: vi.fn().mockResolvedValue(mockDrafts),
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

    return {
      ...render(
        <ApplicationContext.Provider value={mockContext}>
          {ui}
        </ApplicationContext.Provider>,
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
        documentMarkdown="# Cell Biology Content"
      />,
    );

    expect(screen.getByText('Generate Questions with AI')).toBeInTheDocument();
    expect(screen.getByText('Cell Biology')).toBeInTheDocument();
    expect(screen.getByText('Generate Questions')).toBeInTheDocument();
    expect(screen.getByText('5 Questions')).toBeInTheDocument();
  });

  it('executes generation flow and transitions to review screen with generated cards', async () => {
    const { mockUseCases } = renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
        documentMarkdown="# Cell Biology Content"
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

  it('saves selected questions and shows success state', async () => {
    const onSuccess = vi.fn();
    const { mockUseCases } = renderWithContext(
      <AiQuestionGeneratorDialog
        isOpen={true}
        onClose={vi.fn()}
        materialId="mat-1"
        materialTitle="Cell Biology"
        documentMarkdown="# Cell Biology Content"
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
