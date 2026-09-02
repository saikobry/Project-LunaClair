import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizCanvas } from '../useQuizCanvas';
import type { QuizDraft } from '../../../../../application/quiz-management/drafts/QuizDraft';
import type { Question } from '../../../../../domain/quiz/models/Question';

describe('useQuizCanvas', () => {
    const initialDraft: QuizDraft = {
        draftId: 'draft-123',
        materialId: 'mat-1',
        title: 'Initial Quiz Title',
        description: 'Initial description',
        passingPercentage: 75,
        items: [
            {
                tempId: 'temp-1',
                type: 'multiple_choice',
                prompt: 'Question 1',
                payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
                points: 1,
                difficulty: 'easy',
            },
            {
                tempId: 'temp-2',
                type: 'true_false',
                prompt: 'Question 2',
                payload: { type: 'true_false', correctAnswer: true },
                points: 2,
                difficulty: 'medium',
            },
        ],
        isDirty: false,
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    it('initializes with null draft and null activeCardId', () => {
        const { result } = renderHook(() => useQuizCanvas());
        expect(result.current.draft).toBeNull();
        expect(result.current.activeCardId).toBeNull();
    });

    it('sets draft and resets activeCardId', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setActiveCardId('some-card');
        });
        expect(result.current.activeCardId).toBe('some-card');

        act(() => {
            result.current.setDraft(initialDraft);
        });

        expect(result.current.draft).toEqual(initialDraft);
        expect(result.current.activeCardId).toBeNull();
    });

    it('patches draft metadata and marks isDirty true', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        act(() => {
            result.current.patchDraft({ title: 'Updated Title', passingPercentage: 80 });
        });

        expect(result.current.draft?.title).toBe('Updated Title');
        expect(result.current.draft?.passingPercentage).toBe(80);
        expect(result.current.draft?.isDirty).toBe(true);
        expect(result.current.draft?.description).toBe('Initial description');
    });

    it('does nothing when patchDraft is called on null draft', () => {
        const { result } = renderHook(() => useQuizCanvas());
        act(() => {
            result.current.patchDraft({ title: 'New' });
        });
        expect(result.current.draft).toBeNull();
    });

    it('updates a specific item and marks isDirty true', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        act(() => {
            result.current.updateItem('temp-1', {
                prompt: 'Updated Prompt 1',
                points: 5,
                explanation: 'A helpful note',
            });
        });

        expect(result.current.draft?.isDirty).toBe(true);
        const item1 = result.current.draft?.items.find((i) => i.tempId === 'temp-1');
        expect(item1?.prompt).toBe('Updated Prompt 1');
        expect(item1?.points).toBe(5);
        expect(item1?.explanation).toBe('A helpful note');

        // Other item unaffected
        const item2 = result.current.draft?.items.find((i) => i.tempId === 'temp-2');
        expect(item2?.prompt).toBe('Question 2');
    });

    it('changes item type and resets payload to type defaults', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        act(() => {
            result.current.changeItemType('temp-1', 'identification');
        });

        const item1 = result.current.draft?.items.find((i) => i.tempId === 'temp-1');
        expect(item1?.type).toBe('identification');
        expect(item1?.payload).toEqual({
            type: 'identification',
            correctAnswer: '',
            acceptedAlternatives: [],
        });
    });

    it('adds a new card at the end when index is omitted and activates it', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        let newTempId = '';
        act(() => {
            newTempId = result.current.addItemAt();
        });

        expect(result.current.draft?.items).toHaveLength(3);
        const added = result.current.draft?.items[2];
        expect(added?.tempId).toBe(newTempId);
        expect(added?.type).toBe('multiple_choice');
        expect(added?.points).toBe(1);
        expect(added?.difficulty).toBe('medium');
        expect(result.current.activeCardId).toBe(newTempId);
        expect(result.current.draft?.isDirty).toBe(true);
    });

    it('adds a new card after the specified index', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        let newTempId = '';
        act(() => {
            newTempId = result.current.addItemAt(0);
        });

        expect(result.current.draft?.items).toHaveLength(3);
        expect(result.current.draft?.items[1].tempId).toBe(newTempId);
        expect(result.current.draft?.items[0].tempId).toBe('temp-1');
        expect(result.current.draft?.items[2].tempId).toBe('temp-2');
    });

    it('adds bank questions as canvas cards with detached tempIds', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        const bankQuestion: Question = {
            id: 'bank-q-99',
            materialId: 'mat-1',
            type: 'identification',
            prompt: 'Identify mitochondria function',
            payload: { type: 'identification', correctAnswer: 'ATP production', acceptedAlternatives: [] },
            difficulty: 'hard',
            points: 3,
            explanation: 'Powerhouse',
            tags: ['biology'],
            status: 'published',
            version: 2,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        act(() => {
            result.current.addBankItems([bankQuestion], 0);
        });

        expect(result.current.draft?.items).toHaveLength(3);
        const imported = result.current.draft?.items[1];
        expect(imported?.questionId).toBe('bank-q-99');
        expect(imported?.prompt).toBe('Identify mitochondria function');
        expect(imported?.points).toBe(3);
        expect(imported?.difficulty).toBe('hard');
        expect(imported?.explanation).toBe('Powerhouse');
        expect(imported?.tags).toEqual(['biology']);
        expect(imported?.tempId).toBeDefined();
        expect(imported?.tempId).not.toBe('bank-q-99');
    });

    it('duplicates a card directly below the source card and detaches from bank', () => {
        const { result } = renderHook(() => useQuizCanvas());

        const draftWithBankQuestion: QuizDraft = {
            ...initialDraft,
            items: [
                {
                    tempId: 'temp-bank-1',
                    questionId: 'bank-orig-1',
                    type: 'multiple_choice',
                    prompt: 'Original Bank Question',
                    payload: { type: 'multiple_choice', choices: ['X', 'Y'], correctIndex: 1 },
                    points: 4,
                    difficulty: 'hard',
                },
            ],
        };

        act(() => {
            result.current.setDraft(draftWithBankQuestion);
        });

        let copyTempId = '';
        act(() => {
            copyTempId = result.current.duplicateItem('temp-bank-1');
        });

        expect(result.current.draft?.items).toHaveLength(2);
        const copy = result.current.draft?.items[1];
        expect(copy?.tempId).toBe(copyTempId);
        expect(copy?.questionId).toBeUndefined(); // Detached from question bank
        expect(copy?.prompt).toBe('Original Bank Question');
        expect(copy?.points).toBe(4);
        expect(copy?.payload).toEqual({ type: 'multiple_choice', choices: ['X', 'Y'], correctIndex: 1 });
    });

    it('ignores duplicateItem when tempId is not found', () => {
        const { result } = renderHook(() => useQuizCanvas());
        act(() => {
            result.current.setDraft(initialDraft);
        });

        act(() => {
            result.current.duplicateItem('non-existent');
        });

        expect(result.current.draft?.items).toHaveLength(2);
    });

    it('deletes an item and clears activeCardId if the deleted item was active', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
            result.current.setActiveCardId('temp-1');
        });

        act(() => {
            result.current.deleteItem('temp-1');
        });

        expect(result.current.draft?.items).toHaveLength(1);
        expect(result.current.draft?.items[0].tempId).toBe('temp-2');
        expect(result.current.activeCardId).toBeNull();
    });

    it('deletes an item and preserves activeCardId if a different item was active', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
            result.current.setActiveCardId('temp-2');
        });

        act(() => {
            result.current.deleteItem('temp-1');
        });

        expect(result.current.draft?.items).toHaveLength(1);
        expect(result.current.activeCardId).toBe('temp-2');
    });

    it('reorders items correctly from source index to target index', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft(initialDraft);
        });

        act(() => {
            result.current.reorderItems(0, 1);
        });

        expect(result.current.draft?.items[0].tempId).toBe('temp-2');
        expect(result.current.draft?.items[1].tempId).toBe('temp-1');
    });

    it('marks session clean and updates quizId upon commitSaved', () => {
        const { result } = renderHook(() => useQuizCanvas());

        act(() => {
            result.current.setDraft({ ...initialDraft, isDirty: true });
        });

        act(() => {
            result.current.commitSaved('saved-quiz-456');
        });

        expect(result.current.draft?.quizId).toBe('saved-quiz-456');
        expect(result.current.draft?.isDirty).toBe(false);
    });
});
