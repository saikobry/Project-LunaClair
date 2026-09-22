import { useState, useCallback, useContext } from 'react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type {
  GenerateQuestionsRequest,
  GeneratedQuestionDraft,
} from '../../../../domain/generator/models/generator.types';
import type { Question } from '../../../../domain/quiz/models/Question';
import { validateQuestionDraft } from '../../../../domain/generator/validation/questionDraftValidation';
import {
  resolveAiModelSelection,
  type AiModelDescriptor,
} from '../../../../domain/ai/services/aiModelCatalog';
import { useAiModelSelection } from '../../hooks/useAiModelSelection';

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
  /** How many items the model returned that failed domain validation and were dropped. */
  rejectedCount: number;
  selectedIndices: Set<number>;
  savedQuestions: Question[];
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
  // The model is the device's preferred one, resolved through the shared catalog — the same choice the
  // chat drawer uses, so a question batch is not silently produced by a different model.
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
  const [status, setStatus] = useState<QuestionGeneratorStatus>('idle');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [drafts, setDrafts] = useState<GeneratedQuestionDraft[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
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
        const batch = await useCases.generator.generateQuestions.execute({
          ...request,
          model: request.model ?? selectedModelId,
        });

        setPhaseMessage('Validating question domain schemas...');
        setDrafts(batch.drafts);
        setRejectedCount(batch.rejected.length);

        // Select all valid drafts by default. The use case already dropped invalid ones, so this
        // remains the belt-and-braces gate it always was rather than a second filter.
        const validIndices = new Set<number>();
        batch.drafts.forEach((draft, idx) => {
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
    [useCases.generator.generateQuestions, selectedModelId],
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

  // Note: this deliberately does NOT clear the batch's model choice. It sits alongside the dialog's
  // other generation settings (count, difficulty, focus) rather than being part of a batch, and
  // clearing it on Back or Retry would silently substitute a model the user did not choose.
  const reset = useCallback(() => {
    setStatus('idle');
    setPhaseMessage('');
    setDrafts([]);
    setRejectedCount(0);
    setSelectedIndices(new Set());
    setSavedQuestions([]);
    setErrorMessage(undefined);
  }, []);

  return {
    status,
    phaseMessage,
    drafts,
    rejectedCount,
    selectedIndices,
    savedQuestions,
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
