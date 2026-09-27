import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetFlashcardReviewsUseCase } from '../ResetFlashcardReviewsUseCase';
import type { QuestionRepository } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { FlashcardReviewRepository } from '../../../../domain/flashcards/repositories/FlashcardReviewRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

describe('ResetFlashcardReviewsUseCase', () => {
    let questions: QuestionRepository;
    let reviews: FlashcardReviewRepository;
    let useCase: ResetFlashcardReviewsUseCase;

    const baseQuestion = {
        materialId: 'mat-1',
        points: 5,
        difficulty: 'medium' as const,
        version: 1,
        status: 'draft' as const,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const cloze = (payload: Partial<{ template: string; blanks: string[] }> = {}, overrides: Partial<Question> = {}): Question => ({
        ...baseQuestion,
        id: 'q-cloze-1',
        type: 'fill_in_blank',
        prompt: 'The ___ produces ATP in the ___ of a eukaryotic cell.',
        payload: {
            type: 'fill_in_blank',
            template: 'The ___ produces ATP in the ___ of a eukaryotic cell.',
            blanks: ['Mitochondrion', 'cytoplasm'],
            ...payload,
        },
        ...overrides,
    });

    const identification = (overrides: Partial<Question> = {}): Question => ({
        ...baseQuestion,
        id: 'q-ident-1',
        type: 'identification',
        prompt: 'Conjugate "hablar" for "yo".',
        payload: { type: 'identification', correctAnswer: 'hablo' },
        ...overrides,
    });

    /** Stands in for the Dexie table: a read returns whatever the write left behind. */
    const store = new Map<string, Question>();
    const persist = (question: Question) => store.set(question.id, question);

    beforeEach(() => {
        store.clear();
        questions = {
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(async (ids: string[]) =>
                ids.map((id) => store.get(id)).filter((q): q is Question => Boolean(q)),
            ),
            createQuestion: vi.fn(),
            createQuestionsBatch: vi.fn(),
            updateQuestion: vi.fn(),
            deleteQuestion: vi.fn(),
        };
        reviews = {
            getAllReviews: vi.fn(),
            getByKeys: vi.fn(),
            getByMaterial: vi.fn(),
            save: vi.fn(),
            deleteByKeys: vi.fn(),
        };
        useCase = new ResetFlashcardReviewsUseCase(questions, reviews);
    });

    describe('capture', () => {
        it('keeps only cloze questions — a non-cloze question has no per-blank keys to reset', async () => {
            persist(cloze());
            persist(identification());

            const captured = await useCase.capture(['q-cloze-1', 'q-ident-1']);

            expect(captured).toEqual([cloze()]);
        });

        it('captures nothing for an empty or unknown id list', async () => {
            await expect(useCase.capture([])).resolves.toEqual([]);
            await expect(useCase.capture(['q-missing'])).resolves.toEqual([]);
        });
    });

    describe('execute', () => {
        it('resets every blank key when the card front changes through the template', async () => {
            // A generic prompt contributes nothing to the front, so the template
            // is the front and editing it is editing what the learner reads.
            persist(cloze({}, { prompt: 'Fill in the blank:' }));
            const before = await useCase.capture(['q-cloze-1']);

            persist(
                cloze(
                    { template: 'The ___ generates ATP in the ___ of a eukaryotic cell.' },
                    { prompt: 'Fill in the blank:' }
                )
            );
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual(['q:q-cloze-1#0', 'q:q-cloze-1#1']);
            expect(reviews.deleteByKeys).toHaveBeenCalledTimes(1);
            expect(reviews.deleteByKeys).toHaveBeenCalledWith(['q:q-cloze-1#0', 'q:q-cloze-1#1']);
        });

        it('resets every blank key — including the removed one — when the blank count changes', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({ blanks: ['Mitochondrion', 'cytoplasm', 'matrix'] }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual(['q:q-cloze-1#0', 'q:q-cloze-1#1', 'q:q-cloze-1#2']);
        });

        it('resets every blank key when blanks are reordered', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({ blanks: ['cytoplasm', 'Mitochondrion'] }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual(['q:q-cloze-1#0', 'q:q-cloze-1#1']);
        });

        it('resets only the edited blank when one answer changes in place', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({ blanks: ['Mitochondrion', 'mitochondrial matrix'] }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual(['q:q-cloze-1#1']);
            expect(reviews.deleteByKeys).toHaveBeenCalledTimes(1);
            expect(reviews.deleteByKeys).toHaveBeenCalledWith(['q:q-cloze-1#1']);
        });

        it('resets nothing when a partial update touches no cloze content', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            // `UpdateQuestionInput` is partial: a difficulty-only save supplies no
            // payload, so the persisted row is identical apart from that field.
            persist(cloze({}, { difficulty: 'hard', version: 2 }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).not.toHaveBeenCalled();
        });

        it('resets nothing when version and status change alone — publishing must not wipe study history', async () => {
            persist(cloze({}, { version: 4, status: 'draft' }));
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({}, { version: 5, status: 'published' }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).not.toHaveBeenCalled();
        });

        it('resets nothing when only a cosmetic re-casing or re-spacing of a blank is saved', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({ blanks: ['mitochondrion', ' cytoplasm '] }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).not.toHaveBeenCalled();
        });

        it('resets nothing for a non-cloze question whose own content changed', async () => {
            persist(identification());
            const before = await useCase.capture(['q-ident-1']);
            expect(before).toEqual([]);

            persist(identification({ payload: { type: 'identification', correctAnswer: 'hablé' } }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).not.toHaveBeenCalled();
        });

        it('resets nothing when the write removed the question row', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            store.clear();
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).not.toHaveBeenCalled();
        });

        it('resets every blank key when the write converted the question away from fill_in_blank', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            // Both authoring paths write `payload` without `type`, so a type
            // change reaches the row as a new payload discriminant. The card now
            // projects 1:1, and nothing would ever render the per-blank keys again.
            persist(identification({ id: 'q-cloze-1' }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual(['q:q-cloze-1#0', 'q:q-cloze-1#1']);
            expect(reviews.deleteByKeys).toHaveBeenCalledWith(['q:q-cloze-1#0', 'q:q-cloze-1#1']);
        });

        it('resets nothing when a reworded generic prompt leaves the card front byte-identical', async () => {
            persist(cloze({}, { prompt: 'Fill in the blank:' }));
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({}, { prompt: 'Please fill in the blank below:' }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).not.toHaveBeenCalled();
        });

        it('resets every blank key when a real prompt is reworded, because the prompt is on the front', async () => {
            persist(cloze({}, { prompt: 'Complete the sentence about ATP.' }));
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({}, { prompt: 'Complete the sentence about cellular respiration.' }));
            const result = await useCase.execute({ before });

            expect(result.resetKeys).toEqual(['q:q-cloze-1#0', 'q:q-cloze-1#1']);
        });

        /**
         * Pinned **current** behaviour, not desired behaviour. The bracket is
         * deliberately not durable: `capture` reads the pre-write row, and a
         * retry re-reads a row the write has already replaced, so `before` and
         * `after` come back identical and the invalidation is lost for good.
         * Fixing this needs a durable record of the pending invalidation — a
         * real change to this use case, which must be made deliberately rather
         * than by an assertion quietly flipping.
         */
        it('a retry after a failed deletion is not self-healing — the edit it would have cleared is already persisted', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            // The question write succeeds and the review deletion then fails.
            persist(cloze({ blanks: ['Mitochondrion', 'mitochondrial matrix'] }));
            vi.mocked(reviews.deleteByKeys).mockRejectedValueOnce(
                new Error('IndexedDB transaction aborted')
            );
            await expect(useCase.execute({ before })).rejects.toThrow(
                'IndexedDB transaction aborted'
            );

            // A retry re-captures the already-edited row, so the comparison sees
            // no change and clears nothing.
            const retryBefore = await useCase.capture(['q-cloze-1']);
            const result = await useCase.execute({ before: retryBefore });

            expect(result.resetKeys).toEqual([]);
            expect(reviews.deleteByKeys).toHaveBeenCalledTimes(1);
        });

        it('routes every deletion through deleteByKeys so each one is tombstoned', async () => {
            persist(cloze());
            const before = await useCase.capture(['q-cloze-1']);

            persist(cloze({ blanks: ['Mitochondrion', 'mitochondrial matrix'] }));
            await useCase.execute({ before });

            expect(reviews.save).not.toHaveBeenCalled();
            expect(reviews.deleteByKeys).toHaveBeenCalledTimes(1);
        });
    });
});
