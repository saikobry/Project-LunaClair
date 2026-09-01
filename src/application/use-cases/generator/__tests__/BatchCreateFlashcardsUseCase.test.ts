import { describe, expect, it, vi } from 'vitest';
import { BatchCreateFlashcardsUseCase } from '../BatchCreateFlashcardsUseCase';
import type { QuestionRepository } from '../../../../domain/quiz/QuestionRepository';
import type { GeneratedFlashcardDraft } from '../../../../domain/generator/generator.types';
import type { Question } from '../../../../domain/quiz/Question';

describe('BatchCreateFlashcardsUseCase', () => {
    const mockCreatedQuestions: Question[] = [
        {
            id: 'q-flash-1',
            materialId: 'mat-101',
            type: 'identification',
            prompt: 'What is the powerhouse of the cell?',
            payload: { type: 'identification', correctAnswer: 'Mitochondria' },
            points: 1,
            difficulty: 'medium',
            version: 1,
            status: 'draft',
            tags: ['flashcard', 'ai-generated', 'organelles'],
            explanation: 'Mitochondria generate ATP.',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
        },
    ];

    it('creates batch of identification questions mapped from flashcard drafts', async () => {
        const mockRepo: QuestionRepository = {
            createQuestionsBatch: vi.fn().mockResolvedValue(mockCreatedQuestions),
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestion: vi.fn(),
            updateQuestion: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const useCase = new BatchCreateFlashcardsUseCase(mockRepo);

        const drafts: GeneratedFlashcardDraft[] = [
            {
                front: 'What is the powerhouse of the cell?',
                back: 'Mitochondria',
                explanation: 'Mitochondria generate ATP.',
                tags: ['organelles'],
            },
        ];

        const result = await useCase.execute({
            materialId: 'mat-101',
            flashcards: drafts,
        });

        expect(mockRepo.createQuestionsBatch).toHaveBeenCalledWith([
            {
                materialId: 'mat-101',
                type: 'identification',
                prompt: 'What is the powerhouse of the cell?',
                payload: {
                    type: 'identification',
                    correctAnswer: 'Mitochondria',
                },
                difficulty: 'medium',
                points: 1,
                explanation: 'Mitochondria generate ATP.',
                tags: ['flashcard', 'ai-generated', 'organelles'],
                status: 'draft',
            },
        ]);
        expect(result).toEqual(mockCreatedQuestions);
    });

    it('returns empty array early if flashcards array is empty', async () => {
        const mockRepo: QuestionRepository = {
            createQuestionsBatch: vi.fn(),
            getQuestions: vi.fn(),
            getQuestionById: vi.fn(),
            getQuestionsByIds: vi.fn(),
            createQuestion: vi.fn(),
            updateQuestion: vi.fn(),
            deleteQuestion: vi.fn(),
        };

        const useCase = new BatchCreateFlashcardsUseCase(mockRepo);
        const result = await useCase.execute({
            materialId: 'mat-101',
            flashcards: [],
        });

        expect(result).toEqual([]);
        expect(mockRepo.createQuestionsBatch).not.toHaveBeenCalled();
    });
});
