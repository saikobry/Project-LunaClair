import { describe, expect, it, vi } from 'vitest';
import { CreateQuestionUseCase } from '../CreateQuestionUseCase';
import type { QuestionRepository, CreateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';

function createRepo(overrides: Partial<QuestionRepository> = {}): QuestionRepository {
    return {
        createQuestion: vi.fn(),
        getQuestions: vi.fn(),
        getQuestionById: vi.fn(),
        getQuestionsByIds: vi.fn(),
        createQuestionsBatch: vi.fn(),
        updateQuestion: vi.fn(),
        deleteQuestion: vi.fn(),
        ...overrides,
    };
}

describe('CreateQuestionUseCase', () => {
    const mockQuestion: Question = {
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
    };

    it('creates question defaulting status to draft', async () => {
        const mockRepo = createRepo({
            createQuestion: vi.fn().mockImplementation((input) =>
                Promise.resolve({
                    ...mockQuestion,
                    ...input,
                    id: 'q-new',
                }),
            ),
        });

        const useCase = new CreateQuestionUseCase(mockRepo);

        const input: CreateQuestionInput = {
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'Mitochondria are the powerhouse of the cell.',
            payload: { type: 'true_false', correctAnswer: true },
            points: 5,
            difficulty: 'easy',
        };

        const result = await useCase.execute(input);

        expect(mockRepo.createQuestion).toHaveBeenCalledWith({
            ...input,
            status: 'draft',
        });
        expect(result.success).toBe(true);
        expect(result.success && result.question.status).toBe('draft');
    });

    /**
     * The gate. Until this call existed the Bank was the one authoring surface with no payload
     * validator anywhere in its chain, and the editor's own default payload for this type is
     * malformed — reachable by typing a prompt and nothing else. Each case asserts BOTH halves of
     * the contract: the specific offending field is named, and nothing reached the repository.
     */
    describe('payload validation gate', () => {
        it('refuses an identification with an empty correctAnswer and persists nothing', async () => {
            const mockRepo = createRepo();
            const useCase = new CreateQuestionUseCase(mockRepo);

            const result = await useCase.execute({
                materialId: 'mat-1',
                type: 'identification',
                prompt: 'Which organelle produces ATP?',
                payload: { type: 'identification', correctAnswer: '' },
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.errors).toEqual([
                'identification payload requires a non-empty "correctAnswer" string.',
            ]);
            expect(mockRepo.createQuestion).not.toHaveBeenCalled();
        });

        it('refuses a fill_in_blank with no template and persists nothing', async () => {
            const mockRepo = createRepo();
            const useCase = new CreateQuestionUseCase(mockRepo);

            const result = await useCase.execute({
                materialId: 'mat-1',
                type: 'fill_in_blank',
                prompt: 'Fill in the blank.',
                // The editor's default payload for this type, verbatim.
                payload: { type: 'fill_in_blank', template: '', blanks: [] },
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.errors).toEqual([
                'fill_in_blank payload requires a "template" string with at least one "___" placeholder.',
            ]);
            expect(mockRepo.createQuestion).not.toHaveBeenCalled();
        });

        it('refuses a multiple_select with no correct answer and persists nothing', async () => {
            const mockRepo = createRepo();
            const useCase = new CreateQuestionUseCase(mockRepo);

            const result = await useCase.execute({
                materialId: 'mat-1',
                type: 'multiple_select',
                prompt: 'Select every organelle.',
                payload: { type: 'multiple_select', choices: ['Nucleus', 'Ribosome'], correctIndices: [] },
            });

            expect(result.success).toBe(false);
            expect(result.success === false && result.errors).toEqual([
                'multiple_select payload requires a non-empty "correctIndices" array of integers within the choices range.',
            ]);
            expect(mockRepo.createQuestion).not.toHaveBeenCalled();
        });

        it('accepts a well-formed payload of every type', async () => {
            const wellFormed: CreateQuestionInput[] = [
                {
                    materialId: 'mat-1',
                    type: 'multiple_choice',
                    prompt: 'Pick one.',
                    payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 1 },
                },
                {
                    materialId: 'mat-1',
                    type: 'multiple_select',
                    prompt: 'Pick several.',
                    payload: { type: 'multiple_select', choices: ['A', 'B'], correctIndices: [0, 1] },
                },
                {
                    materialId: 'mat-1',
                    type: 'true_false',
                    prompt: 'Is it true?',
                    payload: { type: 'true_false', correctAnswer: false },
                },
                {
                    materialId: 'mat-1',
                    type: 'identification',
                    prompt: 'Name it.',
                    payload: { type: 'identification', correctAnswer: 'Mitochondrion' },
                },
                {
                    materialId: 'mat-1',
                    type: 'fill_in_blank',
                    prompt: 'Fill in the blank.',
                    payload: { type: 'fill_in_blank', template: 'The ___ is the powerhouse.', blanks: ['mitochondrion'] },
                },
            ];

            for (const input of wellFormed) {
                const mockRepo = createRepo();
                const useCase = new CreateQuestionUseCase(mockRepo);

                const result = await useCase.execute(input);

                expect(result.success, input.type).toBe(true);
                expect(mockRepo.createQuestion, input.type).toHaveBeenCalledWith({
                    ...input,
                    status: 'draft',
                });
            }
        });
    });
});
