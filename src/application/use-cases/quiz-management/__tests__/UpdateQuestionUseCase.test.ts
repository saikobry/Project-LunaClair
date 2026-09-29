import { describe, expect, it, vi } from 'vitest';
import { UpdateQuestionUseCase } from '../UpdateQuestionUseCase';
import { validateQuestionPayload } from '../../../../domain/quiz/validation/questionPayloadValidation';
import type { QuestionRepository, UpdateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

function createRepo(overrides: Partial<QuestionRepository> = {}): QuestionRepository {
    return {
        updateQuestion: vi.fn(),
        getQuestions: vi.fn(),
        getQuestionById: vi.fn(),
        getQuestionsByIds: vi.fn(),
        createQuestion: vi.fn(),
        createQuestionsBatch: vi.fn(),
        deleteQuestion: vi.fn(),
        ...overrides,
    };
}

const questionOf = (overrides: Partial<Question> = {}): Question => ({
    id: 'q100',
    materialId: 'mat-1',
    type: 'true_false',
    prompt: 'Mitochondria are the powerhouse of the cell.',
    payload: { type: 'true_false', correctAnswer: true },
    points: 5,
    difficulty: 'easy',
    version: 1,
    status: 'draft',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
});

describe('UpdateQuestionUseCase', () => {
    const mockQuestion = questionOf();

    it('updates prompt and points fields', async () => {
        const mockRepo = createRepo({
            updateQuestion: vi.fn().mockImplementation((id, input) =>
                Promise.resolve({
                    ...mockQuestion,
                    id,
                    ...input,
                    updatedAt: '2026-09-01T12:00:00.000Z',
                }),
            ),
        });

        const useCase = new UpdateQuestionUseCase(mockRepo);

        const input: UpdateQuestionInput = {
            prompt: 'Updated question prompt',
            points: 10,
        };

        const result = await useCase.execute('q100', input);

        expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q100', input);
        expect(result.success).toBe(true);
        expect(result.success && result.question.prompt).toBe('Updated question prompt');
        expect(result.success && result.question.points).toBe(10);
    });

    /**
     * The gate. `UpdateQuestionInput` is partial, so the load-bearing case is the one that
     * supplies a payload: a save that writes a malformed one must be refused and must reach
     * the repository not at all.
     */
    describe('payload validation gate', () => {
        it('refuses an identification update that empties the correct answer and persists nothing', async () => {
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockResolvedValue(
                    questionOf({
                        type: 'identification',
                        payload: { type: 'identification', correctAnswer: 'Mitochondrion' },
                    }),
                ),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            const result = await useCase.execute('q100', {
                payload: { type: 'identification', correctAnswer: '' },
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.errors).toEqual([
                'identification payload requires a non-empty "correctAnswer" string.',
            ]);
            expect(mockRepo.updateQuestion).not.toHaveBeenCalled();
        });

        it('refuses a fill_in_blank update with no template and persists nothing', async () => {
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockResolvedValue(
                    questionOf({
                        type: 'fill_in_blank',
                        payload: { type: 'fill_in_blank', template: 'The ___ is the powerhouse.', blanks: ['mitochondrion'] },
                    }),
                ),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            const result = await useCase.execute('q100', {
                payload: { type: 'fill_in_blank', template: '', blanks: [] },
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.errors).toEqual([
                'fill_in_blank payload requires a "template" string with at least one "___" placeholder.',
            ]);
            expect(mockRepo.updateQuestion).not.toHaveBeenCalled();
        });

        it('judges the payload against the STORED type, not the payload own type', async () => {
            // The stored row is an identification; a payload claiming another type is malformed
            // regardless of whether it would be valid under the type it names.
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockResolvedValue(
                    questionOf({ type: 'identification', payload: { type: 'identification', correctAnswer: 'x' } }),
                ),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            const result = await useCase.execute('q100', {
                payload: { type: 'true_false', correctAnswer: true },
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.errors).toContain(
                'payload.type "true_false" does not match question type "identification".',
            );
            expect(mockRepo.updateQuestion).not.toHaveBeenCalled();
        });

        /**
         * A partial input carrying NO payload writes no payload content, so it is not gated.
         * This is the prompt-only edit of a question whose payload is untouched — it must still
         * succeed, and must not even read the row to decide that.
         */
        it('does not gate a partial update that supplies no payload', async () => {
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockResolvedValue(questionOf()),
                updateQuestion: vi.fn().mockImplementation((id, input) =>
                    Promise.resolve({ ...mockQuestion, id, ...input }),
                ),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            const result = await useCase.execute('q100', { prompt: 'A reworded prompt.' });

            expect(result.success).toBe(true);
            expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q100', { prompt: 'A reworded prompt.' });
            expect(mockRepo.getQuestionById).not.toHaveBeenCalled();
        });

        it('does not gate a status-only update of a question whose stored payload is malformed', async () => {
            // A row that predates the gate must still be publishable/archivable: this call writes
            // no payload content, so refusing it over content it is not touching would strand it.
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockResolvedValue(questionOf({ status: 'draft' })),
                updateQuestion: vi.fn().mockImplementation((id, input) =>
                    Promise.resolve({ ...mockQuestion, id, ...input }),
                ),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            const result = await useCase.execute('q100', { status: 'published' });

            expect(result.success).toBe(true);
            expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q100', { status: 'published' });
        });

        it('leaves a missing row to the repository own refusal', async () => {
            // The use case must not invent a second "not found" message; `updateQuestion` owns it.
            const notFound = new Error('Question not found: q-missing');
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockResolvedValue(null),
                updateQuestion: vi.fn().mockRejectedValue(notFound),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            await expect(
                useCase.execute('q-missing', {
                    payload: { type: 'identification', correctAnswer: 'x' },
                }),
            ).rejects.toThrow('Question not found: q-missing');
        });
    });

    /**
     * The repair path. A user may already hold a malformed row; opening it and saving now gets a
     * refusal, and correcting the offending field and saving again must persist and leave a
     * payload that passes the same validator. Without this, the gate would make the row
     * unrepairable — permanently uneditable, because the only way to fix it is the save it blocks.
     */
    describe('repair path for a row saved before the gate', () => {
        it('refuses the uncorrected row, then persists the corrected one and it now validates', async () => {
            const malformed: Question = questionOf({
                id: 'q-legacy',
                type: 'fill_in_blank',
                // Exactly the shape the Bank's default payload produced before this gate.
                payload: { type: 'fill_in_blank', template: '', blanks: [] },
            });

            let stored = malformed;
            const mockRepo = createRepo({
                getQuestionById: vi.fn().mockImplementation(() => Promise.resolve(stored)),
                updateQuestion: vi.fn().mockImplementation((_id, input) => {
                    stored = { ...stored, ...input, version: stored.version + 1 };
                    return Promise.resolve(stored);
                }),
            });
            const useCase = new UpdateQuestionUseCase(mockRepo);

            // 1. Saving the row as stored is refused, and nothing is written.
            const refused = await useCase.execute('q-legacy', {
                payload: { type: 'fill_in_blank', template: '', blanks: [] },
            });
            expect(refused.success).toBe(false);
            expect(mockRepo.updateQuestion).not.toHaveBeenCalled();
            expect(stored.payload).toEqual({ type: 'fill_in_blank', template: '', blanks: [] });

            // 2. The author fills in the offending field and saves again.
            const corrected = { type: 'fill_in_blank' as const, template: 'The ___ is the powerhouse.', blanks: ['mitochondrion'] };
            const accepted = await useCase.execute('q-legacy', { payload: corrected });

            expect(accepted.success).toBe(true);
            expect(mockRepo.updateQuestion).toHaveBeenCalledWith('q-legacy', { payload: corrected });
            expect(stored.payload).toEqual(corrected);
            expect(validateQuestionPayload(stored.type, stored.payload)).toEqual([]);
        });
    });
});
