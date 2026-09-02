import { useCallback, useState } from 'react';
import type { QuizDraft, QuestionDraft } from '../../../../application/quiz-management/drafts/QuizDraft';
import { makeDraftTempId } from '../../../../application/quiz-management/drafts/QuizDraft';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { QuestionType } from '../../../../domain/quiz/models/QuestionType';
import { createDefaultPayload } from '../../editors/QuestionEditorRegistry';

/**
 * Pure canvas state hook for the quiz authoring session.
 *
 * Owns the `QuizDraft` DTO, the single active card, and all draft
 * mutations (add below, duplicate, delete, reorder, type change) keyed
 * by stable `tempId`s. Contains no persistence, validation, or query
 * concerns — those live in the builder and application layers.
 */
export function useQuizCanvas() {
    const [draft, setDraftState] = useState<QuizDraft | null>(null);
    const [activeCardId, setActiveCardId] = useState<string | null>(null);

    /** Seeds or replaces the session draft (initial load / restore). */
    const setDraft = useCallback((next: QuizDraft | null) => {
        setDraftState(next);
        setActiveCardId(null);
    }, []);

    const patchDraft = useCallback((patch: Partial<Pick<QuizDraft, 'title' | 'description' | 'passingPercentage'>>) => {
        setDraftState((prev) =>
            prev
                ? { ...prev, ...patch, updatedAt: new Date().toISOString(), isDirty: true }
                : prev,
        );
    }, []);

    const updateItems = useCallback((updater: (items: QuestionDraft[]) => QuestionDraft[]) => {
        setDraftState((prev) =>
            prev
                ? { ...prev, items: updater(prev.items), updatedAt: new Date().toISOString(), isDirty: true }
                : prev,
        );
    }, []);

    const updateItem = useCallback((tempId: string, patch: Partial<QuestionDraft>) => {
        updateItems((items) => items.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)));
    }, [updateItems]);

    /** Changes a card's type, resetting its payload to the new type's defaults. */
    const changeItemType = useCallback((tempId: string, type: QuestionType) => {
        updateItems((items) =>
            items.map((item) =>
                item.tempId === tempId ? { ...item, type, payload: createDefaultPayload(type) } : item,
            ),
        );
    }, [updateItems]);

    /** Inserts a blank card after `index` (or at the end) and activates it. */
    const addItemAt = useCallback((index?: number): string => {
        const item: QuestionDraft = {
            tempId: makeDraftTempId(),
            type: 'multiple_choice',
            prompt: '',
            payload: createDefaultPayload('multiple_choice'),
            points: 1,
            difficulty: 'medium',
        };
        updateItems((items) => {
            const insertAt = index == null ? items.length : Math.min(index + 1, items.length);
            return [...items.slice(0, insertAt), item, ...items.slice(insertAt)];
        });
        setActiveCardId(item.tempId);
        return item.tempId;
    }, [updateItems]);

    /** Imports bank questions as cards after `index` (or at the end). */
    const addBankItems = useCallback((questions: Question[], index?: number) => {
        const cards: QuestionDraft[] = questions.map((question) => ({
            tempId: makeDraftTempId(),
            questionId: question.id,
            type: question.type,
            prompt: question.prompt,
            payload: question.payload,
            points: question.points,
            difficulty: question.difficulty,
            explanation: question.explanation,
            tags: question.tags,
        }));
        updateItems((items) => {
            const insertAt = index == null ? items.length : Math.min(index + 1, items.length);
            return [...items.slice(0, insertAt), ...cards, ...items.slice(insertAt)];
        });
    }, [updateItems]);

    /**
     * Duplicates a card below its source; the copy detaches from the bank.
     * Returns the copy's `tempId` so callers can scroll it into view — the
     * copy is the visible consequence of the action. The tempId is
     * pre-generated BEFORE the state update (the functional updater runs
     * during render, so a value captured inside it would be stale when
     * returned); if the source is missing (shouldn't happen — callers guard
     * with `activeCardId`), the tempId is simply unused.
     */
    const duplicateItem = useCallback((tempId: string): string => {
        const copyTempId = makeDraftTempId();
        updateItems((items) => {
            const sourceIndex = items.findIndex((item) => item.tempId === tempId);
            if (sourceIndex === -1) return items;
            const source = items[sourceIndex];
            const copy: QuestionDraft = { ...source, tempId: copyTempId, questionId: undefined };
            return [...items.slice(0, sourceIndex + 1), copy, ...items.slice(sourceIndex + 1)];
        });
        return copyTempId;
    }, [updateItems]);

    const deleteItem = useCallback((tempId: string) => {
        updateItems((items) => items.filter((item) => item.tempId !== tempId));
        setActiveCardId((prev) => (prev === tempId ? null : prev));
    }, [updateItems]);

    const reorderItems = useCallback((from: number, to: number) => {
        updateItems((items) => {
            const next = [...items];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
    }, [updateItems]);

    /** Marks the session clean after a successful commit, binding the saved quiz id. */
    const commitSaved = useCallback((quizId: string) => {
        setDraftState((prev) =>
            prev
                ? { ...prev, quizId, isDirty: false, updatedAt: new Date().toISOString() }
                : prev,
        );
    }, []);

    return {
        draft,
        activeCardId,
        setDraft,
        setActiveCardId,
        patchDraft,
        commitSaved,
        updateItem,
        changeItemType,
        addItemAt,
        addBankItems,
        duplicateItem,
        deleteItem,
        reorderItems,
    };
}

export type QuizCanvas = ReturnType<typeof useQuizCanvas>;
