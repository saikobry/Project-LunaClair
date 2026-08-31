import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../LunaClairDatabase';
import { DexieQuizSessionRepository } from '../DexieQuizSessionRepository';
import { DexieFlashcardReviewRepository } from '../DexieFlashcardReviewRepository';
import type { QuizSession } from '../../../../domain/quiz/QuizSession';
import type { ReviewState } from '../../../../domain/flashcards/scheduler';
import type { Question } from '../../../../domain/quiz/Question';
import type { Quiz } from '../../../../domain/quiz/Quiz';

describe('Phase 7A / Commit 1 — Analytics Data Access Foundations', () => {
    let quizSessionRepo: DexieQuizSessionRepository;
    let flashcardReviewRepo: DexieFlashcardReviewRepository;

    const sampleQuestion1: Question = {
        id: 'q-cell-1',
        materialId: 'mat-biology-1',
        type: 'multiple_choice',
        difficulty: 'medium',
        points: 10,
        version: 1,
        status: 'published',
        tags: ['cellular-biology', 'energy', 'mitochondria'],
        prompt: 'Which organelle is responsible for cellular respiration?',
        payload: {
            type: 'multiple_choice',
            choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
            correctIndex: 1,
        },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuestion2: Question = {
        id: 'q-cell-2',
        materialId: 'mat-biology-1',
        type: 'true_false',
        difficulty: 'easy',
        points: 5,
        version: 1,
        status: 'published',
        tags: ['cellular-biology', 'glycolysis'],
        prompt: 'Glycolysis requires oxygen to proceed.',
        payload: {
            type: 'true_false',
            correctAnswer: false,
        },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuestion3: Question = {
        id: 'q-spanish-1',
        materialId: 'mat-spanish-1',
        type: 'identification',
        difficulty: 'hard',
        points: 15,
        version: 1,
        status: 'published',
        tags: ['grammar', 'verbs', 'conjugation'],
        prompt: 'Conjugate "hablar" for the pronoun "yo" in the present tense.',
        payload: {
            type: 'identification',
            correctAnswer: 'hablo',
            acceptedAlternatives: ['yo hablo'],
        },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuiz1: Quiz = {
        id: 'quiz-bio-1',
        materialId: 'mat-biology-1',
        title: 'Cellular Biology Quiz',
        description: 'Test on respiration and organelles',
        status: 'published',
        passingPercentage: 80,
        questionIds: ['q-cell-1', 'q-cell-2'],
        items: [
            { quizId: 'quiz-bio-1', questionId: 'q-cell-1', questionVersion: 1, points: 10, order: 0 },
            { quizId: 'quiz-bio-1', questionId: 'q-cell-2', questionVersion: 1, points: 5, order: 1 },
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    beforeEach(async () => {
        await db.quizSessions.clear();
        await db.flashcardReviews.clear();
        await db.quizzes.clear();
        await db.questions.clear();

        await db.questions.bulkPut([sampleQuestion1, sampleQuestion2, sampleQuestion3]);
        await db.quizzes.put(sampleQuiz1);

        quizSessionRepo = new DexieQuizSessionRepository();
        flashcardReviewRepo = new DexieFlashcardReviewRepository();
    });

    describe('Empty Database Behavior', () => {
        it('returns empty array when no quiz sessions exist', async () => {
            const sessions = await quizSessionRepo.getAllCompletedSessions();
            expect(sessions).toEqual([]);
        });

        it('returns empty array when no flashcard reviews exist', async () => {
            const reviews = await flashcardReviewRepo.getAllReviews();
            expect(reviews).toEqual([]);
        });
    });

    describe('QuizSessionRepository.getAllCompletedSessions()', () => {
        it('returns ONLY completed sessions, filtering out in_progress, abandoned, and draft sessions', async () => {
            const completedSession1: QuizSession = {
                id: 'sess-completed-1',
                quizId: 'quiz-bio-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: { 'q-cell-1': sampleQuestion1, 'q-cell-2': sampleQuestion2 },
                answers: [
                    { questionId: 'q-cell-1', value: 'Mitochondria', isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-cell-2', value: false, isCorrect: true, earnedPoints: 5 },
                ],
                score: {
                    correctAnswers: 2,
                    incorrectAnswers: 0,
                    earnedPoints: 15,
                    maxPoints: 15,
                    percentage: 100,
                },
                startedAt: '2026-08-20T10:00:00Z',
                completedAt: '2026-08-20T10:05:00Z',
            };

            const completedSession2: QuizSession = {
                id: 'sess-completed-2',
                quizId: 'virtual:multi-quiz',
                mode: 'exam',
                status: 'completed',
                questionSnapshots: { 'q-spanish-1': sampleQuestion3 },
                answers: [
                    { questionId: 'q-spanish-1', value: 'hablo', isCorrect: true, earnedPoints: 15 },
                ],
                score: {
                    correctAnswers: 1,
                    incorrectAnswers: 0,
                    earnedPoints: 15,
                    maxPoints: 15,
                    percentage: 100,
                },
                startedAt: '2026-08-21T14:00:00Z',
                completedAt: '2026-08-21T14:02:00Z',
            };

            const inProgressSession: QuizSession = {
                id: 'sess-in-progress',
                quizId: 'quiz-bio-1',
                mode: 'practice',
                status: 'in_progress',
                questionSnapshots: { 'q-cell-1': sampleQuestion1 },
                answers: [],
                startedAt: '2026-08-22T08:00:00Z',
            };

            const abandonedSession: QuizSession = {
                id: 'sess-abandoned',
                quizId: 'quiz-bio-1',
                mode: 'exam',
                status: 'abandoned',
                questionSnapshots: { 'q-cell-2': sampleQuestion2 },
                answers: [],
                startedAt: '2026-08-19T09:00:00Z',
            };

            const draftSession: QuizSession = {
                id: 'sess-draft',
                quizId: 'quiz-bio-1',
                mode: 'practice',
                status: 'draft',
                questionSnapshots: {},
                answers: [],
                startedAt: '2026-08-18T12:00:00Z',
            };

            await db.quizSessions.bulkPut([
                completedSession1,
                completedSession2,
                inProgressSession,
                abandonedSession,
                draftSession,
            ]);

            const completed = await quizSessionRepo.getAllCompletedSessions();
            expect(completed).toHaveLength(2);
            expect(completed.map((s) => s.id).sort()).toEqual(['sess-completed-1', 'sess-completed-2'].sort());

            // Check that all session properties, snapshots, answers, and scores are preserved verbatim
            const retrievedBio = completed.find((s) => s.id === 'sess-completed-1');
            expect(retrievedBio).toBeDefined();
            expect(retrievedBio?.score?.percentage).toBe(100);
            expect(retrievedBio?.questionSnapshots['q-cell-1'].tags).toEqual(['cellular-biology', 'energy', 'mitochondria']);
            expect(retrievedBio?.answers[0].isCorrect).toBe(true);

            // getSessions(quizId) returns all sessions for that quiz regardless of status
            const bioSessions = await quizSessionRepo.getSessions('quiz-bio-1');
            expect(bioSessions).toHaveLength(4); // sess-completed-1, sess-in-progress, sess-abandoned, sess-draft
        });

        it('throws AbortError when AbortSignal is aborted', async () => {
            const controller = new AbortController();
            controller.abort();
            await expect(quizSessionRepo.getAllCompletedSessions(controller.signal)).rejects.toThrow();
        });
    });

    describe('FlashcardReviewRepository.getAllReviews()', () => {
        it('retrieves all flashcard reviews across multiple materials', async () => {
            const review1: ReviewState = {
                key: 'card-q-cell-1',
                materialId: 'mat-biology-1',
                repetitions: 4,
                easeFactor: 2.6,
                intervalDays: 14,
                dueAt: '2026-09-05T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-22T10:00:00Z',
                reviewCount: 4,
            };

            const review2: ReviewState = {
                key: 'card-q-cell-2',
                materialId: 'mat-biology-1',
                repetitions: 1,
                easeFactor: 2.3,
                intervalDays: 1,
                dueAt: '2026-08-23T00:00:00Z',
                lapses: 1,
                lastReviewedAt: '2026-08-22T10:05:00Z',
                reviewCount: 2,
            };

            const review3: ReviewState = {
                key: 'card-q-spanish-1',
                materialId: 'mat-spanish-1',
                repetitions: 6,
                easeFactor: 2.8,
                intervalDays: 30,
                dueAt: '2026-09-20T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-21T15:00:00Z',
                reviewCount: 6,
            };

            await flashcardReviewRepo.save([review1, review2, review3]);

            const allReviews = await flashcardReviewRepo.getAllReviews();
            expect(allReviews).toHaveLength(3);
            expect(allReviews.map((r) => r.key).sort()).toEqual(['card-q-cell-1', 'card-q-cell-2', 'card-q-spanish-1'].sort());

            // Check getByMaterial filters correctly
            const bioReviews = await flashcardReviewRepo.getByMaterial('mat-biology-1');
            expect(bioReviews).toHaveLength(2);

            const spanishReviews = await flashcardReviewRepo.getByMaterial('mat-spanish-1');
            expect(spanishReviews).toHaveLength(1);
            expect(spanishReviews[0].easeFactor).toBe(2.8);
            expect(spanishReviews[0].repetitions).toBe(6);
        });

        it('throws AbortError when AbortSignal is aborted', async () => {
            const controller = new AbortController();
            controller.abort();
            await expect(flashcardReviewRepo.getAllReviews(controller.signal)).rejects.toThrow();
        });

        it('reflects deletions accurately', async () => {
            const review1: ReviewState = {
                key: 'card-1',
                materialId: 'mat-1',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: '2026-08-30T00:00:00Z',
                lapses: 0,
                reviewCount: 2,
            };
            await flashcardReviewRepo.save([review1]);
            expect(await flashcardReviewRepo.getAllReviews()).toHaveLength(1);

            await flashcardReviewRepo.deleteByKeys(['card-1']);
            expect(await flashcardReviewRepo.getAllReviews()).toEqual([]);
        });
    });
});
