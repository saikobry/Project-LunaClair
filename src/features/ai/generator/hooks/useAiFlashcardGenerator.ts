import { useState, useCallback, useContext } from 'react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type {
  GenerateFlashcardsRequest,
  GeneratedFlashcardDraft,
} from '../../../../domain/generator/models/generator.types';
import type { Question } from '../../../../domain/quiz/models/Question';

export type FlashcardGeneratorStatus =
  | 'idle'
  | 'generating'
  | 'review'
  | 'saving'
  | 'done'
  | 'error';

export interface UseAiFlashcardGeneratorReturn {
  status: FlashcardGeneratorStatus;
  phaseMessage: string;
  drafts: GeneratedFlashcardDraft[];
  selectedIndices: Set<number>;
  savedCards: Question[];
  errorMessage?: string;
  generate: (request: GenerateFlashcardsRequest) => Promise<void>;
  toggleSelect: (index: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  updateDraft: (index: number, updated: GeneratedFlashcardDraft) => void;
  saveSelected: (materialId: string) => Promise<Question[]>;
  reset: () => void;
}

export function useAiFlashcardGenerator(): UseAiFlashcardGeneratorReturn {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useAiFlashcardGenerator must be used within an ApplicationProvider');
  }
  const { useCases } = context;

  const [status, setStatus] = useState<FlashcardGeneratorStatus>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [drafts, setDrafts] = useState<GeneratedFlashcardDraft[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [savedCards, setSavedCards] = useState<Question[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const generate = useCallback(
    async (request: GenerateFlashcardsRequest) => {
      setStatus('generating');
      setErrorMessage(undefined);
      setPhaseMessage('Extracting key concepts from study material...');

      try {
        setPhaseMessage('Synthesizing atomic spaced-repetition flashcards...');
        const generatedDrafts = await useCases.generator.generateFlashcards.execute(request);

        setPhaseMessage('Validating flashcard definitions...');
        setDrafts(generatedDrafts);

        // Select all valid drafts by default
        const validIndices = new Set<number>();
        generatedDrafts.forEach((draft, idx) => {
          if (draft.front.trim() && draft.back.trim()) {
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
    [useCases.generator.generateFlashcards],
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

  const updateDraft = useCallback((index: number, updated: GeneratedFlashcardDraft) => {
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
      setPhaseMessage('Saving flashcards to review deck...');

      try {
        const created = await useCases.generator.batchCreateFlashcards.execute({
          materialId,
          flashcards: selectedDrafts,
          status: 'draft',
        });

        setSavedCards(created);
        setStatus('done');
        setPhaseMessage('');
        return created;
      } catch (err: unknown) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Failed to save flashcards';
        setErrorMessage(message);
        setPhaseMessage('');
        throw err;
      }
    },
    [drafts, selectedIndices, useCases.generator.batchCreateFlashcards],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setPhaseMessage('');
    setDrafts([]);
    setSelectedIndices(new Set());
    setSavedCards([]);
    setErrorMessage(undefined);
  }, []);

  return {
    status,
    phaseMessage,
    drafts,
    selectedIndices,
    savedCards,
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
