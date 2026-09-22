import { useState, useCallback, useContext } from 'react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type {
  GenerateFlashcardsRequest,
  GeneratedFlashcardDraft,
} from '../../../../domain/generator/models/generator.types';
import type { Question } from '../../../../domain/quiz/models/Question';
import {
  resolveAiModelSelection,
  type AiModelDescriptor,
} from '../../../../domain/ai/services/aiModelCatalog';
import { useAiModelSelection } from '../../hooks/useAiModelSelection';

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
  /** How many items the model returned that failed domain validation and were dropped. */
  rejectedCount: number;
  selectedIndices: Set<number>;
  savedCards: Question[];
  errorMessage?: string;
  /** Display name of the model synthesis will run on, or `null` when nothing is selectable. */
  modelName: string | null;
  /** `true` when nothing may be sent: the assistant is switched off, or no model resolves. */
  isAiUnavailable: boolean;
  /** Selectable models, in catalog order, for the per-batch model picker. */
  models: AiModelDescriptor[];
  /** The catalog's default, or `null` when there is nothing to default to. */
  defaultModelId: string | null;
  /** `true` when the deployment has switched the assistant off entirely. */
  isAiDisabled: boolean;
  /** Catalog id this batch will run on, or `null` when nothing resolves. */
  selectedModelId: string | null;
  /** Chooses the model for this batch only. Never persisted, never touches the chat preference. */
  selectModel: (modelId: string) => void;
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
  // Same contract as the question generator: the device's preferred model, resolved through the
  // shared catalog, so a card batch is not silently produced by a different model than chat.
  const model = useAiModelSelection();
  /**
   * The model for *this batch*, chosen in the dialog.
   *
   * Deliberately local and never persisted. The device preference is a long-lived setting, while a
   * generation is one batch — picking MAX for a batch (a shared, rate-limited endpoint) must not
   * silently re-route every later chat message onto it. `null` = no explicit choice, so the
   * preferred model is used.
   */
  const [modelOverrideId, setModelOverrideId] = useState<string | null>(null);
  // Resolved through the catalog exactly as the preference is, so an override the server has since
  // retired degrades to the catalog default instead of being sent and refused.
  const effectiveModel = resolveAiModelSelection(
    model.catalog,
    modelOverrideId ?? model.selectedModel?.id,
  );
  // Hoisted to a plain value: an optional chain in a dependency array is not a stable dep for the
  // React Compiler, which then declines to memoize the callback.
  const selectedModelId = effectiveModel?.id;

  const selectModel = useCallback((modelId: string) => {
    setModelOverrideId(modelId);
  }, []);

  const [status, setStatus] = useState<FlashcardGeneratorStatus>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [drafts, setDrafts] = useState<GeneratedFlashcardDraft[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
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
        const batch = await useCases.generator.generateFlashcards.execute({
          ...request,
          model: request.model ?? selectedModelId,
        });

        setPhaseMessage('Validating flashcard definitions...');
        setDrafts(batch.drafts);
        setRejectedCount(batch.rejected.length);

        // Select all valid drafts by default; the use case already dropped the invalid ones.
        const validIndices = new Set<number>();
        batch.drafts.forEach((draft, idx) => {
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
    [useCases.generator.generateFlashcards, selectedModelId],
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

  // Note: this deliberately does NOT clear the batch's model choice. It sits alongside the dialog's
  // other generation settings (count, focus) rather than being part of a batch, and clearing it on
  // Back or Retry would silently substitute a model the user did not choose.
  const reset = useCallback(() => {
    setStatus('idle');
    setPhaseMessage('');
    setDrafts([]);
    setRejectedCount(0);
    setSelectedIndices(new Set());
    setSavedCards([]);
    setErrorMessage(undefined);
  }, []);

  return {
    status,
    phaseMessage,
    drafts,
    rejectedCount,
    selectedIndices,
    savedCards,
    errorMessage,
    modelName: effectiveModel?.display.name ?? null,
    isAiUnavailable: model.isAiDisabled || effectiveModel === null,
    models: model.catalog.models,
    defaultModelId: model.catalog.defaultModelId,
    isAiDisabled: model.isAiDisabled,
    selectedModelId: selectedModelId ?? null,
    selectModel,
    generate,
    toggleSelect,
    selectAll,
    deselectAll,
    updateDraft,
    saveSelected,
    reset,
  };
}
