import { useState, useCallback, useContext } from 'react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type {
  GenerateQuestionsRequest,
  GeneratedQuestionDraft,
} from '../../../../domain/generator/models/generator.types';
import type { Question } from '../../../../domain/quiz/models/Question';
import { validateQuestionDraft } from '../../../../domain/generator/validation/questionDraftValidation';

export type QuestionGeneratorStatus =
  | 'idle'
  | 'generating'
  | 'review'
  | 'saving'
  | 'done'
  | 'error';

export interface UseAiQuestionGeneratorReturn {
  status: QuestionGeneratorStatus;
  phaseMessage: string;
  drafts: GeneratedQuestionDraft[];
  selectedIndices: Set<number>;
  savedQuestions: Question[];
  errorMessage?: string;
  generate: (request: GenerateQuestionsRequest) => Promise<void>;
  toggleSelect: (index: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  updateDraft: (index: number, updated: GeneratedQuestionDraft) => void;
  saveSelected: (materialId: string) => Promise<Question[]>;
  reset: () => void;
}

export function useAiQuestionGenerator(): UseAiQuestionGeneratorReturn {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useAiQuestionGenerator must be used within an ApplicationProvider');
  }
  const { useCases } = context;
  const [status, setStatus] = useState<QuestionGeneratorStatus>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [drafts, setDrafts] = useState<GeneratedQuestionDraft[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const generate = useCallback(
    async (request: GenerateQuestionsRequest) => {
      setStatus('generating');
      setErrorMessage(undefined);
      setPhaseMessage('Analyzing study material content...');

      try {
        setPhaseMessage('Synthesizing conceptual assessment questions...');
        const generatedDrafts = await useCases.generator.generateQuestions.execute(request);

        setPhaseMessage('Validating question domain schemas...');
        setDrafts(generatedDrafts);

        // Select all valid drafts by default
        const validIndices = new Set<number>();
        generatedDrafts.forEach((draft, idx) => {
          if (validateQuestionDraft(draft).success) {
            validIndices.add(idx);
          }
        });

        setSelectedIndices(validIndices);
        setStatus('review');
        setPhaseMessage('');
      } catch (err: unknown) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'AI generation failed';
        setErrorMessage(message);
        setPhaseMessage('');
      }
    },
    [useCases.generator.generateQuestions],
  );

  const toggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(drafts.map((_, i) => i)));
  }, [drafts]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const updateDraft = useCallback((index: number, updated: GeneratedQuestionDraft) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const saveSelected = useCallback(
    async (materialId: string): Promise<Question[]> => {
      const selectedDrafts = drafts.filter((_, idx) => selectedIndices.has(idx));
      if (selectedDrafts.length === 0) {
        return [];
      }

      setStatus('saving');
      setPhaseMessage('Saving questions to Question Bank...');

      try {
        const created = await useCases.generator.batchCreateQuestions.execute({
          materialId,
          questions: selectedDrafts,
          status: 'draft', // All AI generated questions are created as drafts
        });

        setSavedQuestions(created);
        setStatus('done');
        setPhaseMessage('');
        return created;
      } catch (err: unknown) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Failed to save questions';
        setErrorMessage(message);
        setPhaseMessage('');
        throw err;
      }
    },
    [drafts, selectedIndices, useCases.generator.batchCreateQuestions],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setPhaseMessage('');
    setDrafts([]);
    setSelectedIndices(new Set());
    setSavedQuestions([]);
    setErrorMessage(undefined);
  }, []);

  return {
    status,
    phaseMessage,
    drafts,
    selectedIndices,
    savedQuestions,
    errorMessage,
    generate,
    toggleSelect,
    selectAll,
    deselectAll,
    updateDraft,
    saveSelected,
    reset,
  };
}
