import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../schema/LunaClairDatabase';
import { DexieAnalyticsRepository } from '../DexieAnalyticsRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { QuizSession } from '../../../../domain/quiz/models/QuizSession';
import type { ReviewState } from '../../../../domain/flashcards/engines/scheduler';

describe('DexieAnalyticsRepository Integration', () => {
    let repo: DexieAnalyticsRepository;

    const sampleMaterialBio: StudyMaterial = {
        id: 'mat-bio-1',
        documentId: 'doc-bio-1',
        title: 'Genetics Notes',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleMaterialCS: StudyMaterial = {
        id: 'mat-cs-1',
        documentId: 'doc-cs-1',
        title: 'Data Structures',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuestionBio1: Question = {
        id: 'q-bio-1',
        materialId: 'mat-bio-1',
        type: 'multiple_choice',
        difficulty: 'easy',
        points: 10,
        version: 1,
        status: 'published',
        tags: ['genetics', 'dna'],
        prompt: 'What does DNA stand for?',
        payload: { type: 'multiple_choice', choices: ['DNA', 'RNA'], correctIndex: 0 },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuestionBio2: Question = {
        id: 'q-bio-2',
        materialId: 'mat-bio-1',
        type: 'true_false',
        difficulty: 'medium',
        points: 15,
        version: 1,
        status: 'published',
        tags: ['genetics'],
        prompt: 'Is DNA double stranded?',
        payload: { type: 'true_false', correctAnswer: true },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuestionCS1: Question = {
        id: 'q-cs-1',
        materialId: 'mat-cs-1',
        type: 'identification',
        difficulty: 'hard',
        points: 20,
        version: 1,
        status: 'published',
        tags: ['algorithms'],
        prompt: 'What is the time complexity of binary search?',
        payload: { type: 'identification', correctAnswer: 'O(log n)' },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuizBio: Quiz = {
        id: 'quiz-bio-1',
        materialId: 'mat-bio-1',
        title: 'Genetics Quiz',
        status: 'published',
        passingPercentage: 80,
        questionIds: ['q-bio-1', 'q-bio-2'],
        items: [
            { quizId: 'quiz-bio-1', questionId: 'q-bio-1', questionVersion: 1, points: 10, order: 0 },
            { quizId: 'quiz-bio-1', questionId: 'q-bio-2', questionVersion: 1, points: 15, order: 1 },
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleQuizCS: Quiz = {
        id: 'quiz-cs-1',
        materialId: 'mat-cs-1',
        title: 'Algorithms Quiz',
        status: 'published',
        passingPercentage: 80,
        questionIds: ['q-cs-1'],
        items: [
            { quizId: 'quiz-cs-1', questionId: 'q-cs-1', questionVersion: 1, points: 20, order: 0 },
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));

        await db.quizSessions.clear();
        await db.flashcardReviews.clear();
        await db.questions.clear();
        await db.quizzes.clear();
        await db.materials.clear();

        await db.materials.bulkPut([sampleMaterialBio, sampleMaterialCS]);
        await db.questions.bulkPut([sampleQuestionBio1, sampleQuestionBio2, sampleQuestionCS1]);
        await db.quizzes.bulkPut([sampleQuizBio, sampleQuizCS]);

        repo = new DexieAnalyticsRepository();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getGlobalAnalytics()', () => {
        it('aggregates system-wide overview, maturity, forecast, and activity', async () => {
            const sessionBio: QuizSession = {
                id: 'sess-bio',
                quizId: 'quiz-bio-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: {
                    'q-bio-1': sampleQuestionBio1,
                    'q-bio-2': sampleQuestionBio2,
                },
                answers: [
                    { questionId: 'q-bio-1', value: 'DNA', isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-bio-2', value: true, isCorrect: true, earnedPoints: 15 },
                ],
                startedAt: '2026-08-25T10:00:00Z',
                completedAt: '2026-08-25T10:05:00Z',
            };

            const sessionCS: QuizSession = {
                id: 'sess-cs',
                quizId: 'quiz-cs-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: {
                    'q-cs-1': sampleQuestionCS1,
                },
                answers: [
                    { questionId: 'q-cs-1', value: 'O(log n)', isCorrect: true, earnedPoints: 20 },
                ],
                startedAt: '2026-08-25T11:00:00Z',
                completedAt: '2026-08-25T11:05:00Z',
            };

            const sessionInProgress: QuizSession = {
                id: 'sess-in-progress',
                quizId: 'quiz-bio-1',
                mode: 'practice',
                status: 'in_progress',
                questionSnapshots: {},
                answers: [],
                startedAt: '2026-08-25T12:00:00Z',
            };

            await db.quizSessions.bulkPut([sessionBio, sessionCS, sessionInProgress]);

            // Review keys are the ones `questionToCards` actually projects
            // (`q:<questionId>` for a 1:1 question). A key the pool does not
            // contain is an orphan diagnostic, not a bucket.
            const reviewBio1: ReviewState = {
                key: 'q:q-bio-1',
                materialId: 'mat-bio-1',
                repetitions: 4,
                easeFactor: 2.6,
                intervalDays: 25,
                dueAt: '2026-09-15T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-25T10:10:00Z',
                reviewCount: 4,
            };

            const reviewCS1: ReviewState = {
                key: 'q:q-cs-1',
                materialId: 'mat-cs-1',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 1,
                dueAt: '2026-08-26T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-25T11:10:00Z',
                reviewCount: 1,
            };

            // A schedule for a card nothing projects any more — the question
            // behind it is gone. Reported, never absorbed. Its dueAt is INSIDE
            // the forecast window, so the forecast assertion below is what
            // proves the forecast is pool-scoped.
            const orphanReview: ReviewState = {
                key: 'q:q-deleted-9#0',
                materialId: 'mat-bio-1',
                repetitions: 6,
                easeFactor: 2.7,
                intervalDays: 1,
                dueAt: '2026-08-26T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-25T11:30:00Z',
                reviewCount: 6,
            };

            await db.flashcardReviews.bulkPut([reviewBio1, reviewCS1, orphanReview]);

            const analytics = await repo.getGlobalAnalytics();

            // Overview checks. Historical volume keeps the orphan (11 reviews
            // across all three rows), but the current-workload figure is
            // pool-scoped, so only the two in-pool cards count.
            expect(analytics.overview.quizzesCompleted).toBe(2);
            expect(analytics.overview.totalAnsweredQuestions).toBe(3);
            expect(analytics.overview.totalCorrectAnswers).toBe(3);
            expect(analytics.overview.globalQuizAccuracy).toBe(100);
            expect(analytics.overview.totalCardReviews).toBe(11);
            expect(analytics.overview.cardsWithReviewHistory).toBe(2);
            expect(analytics.overview.currentStreakDays).toBe(1);

            // Card maturity: the pool is 3 projected keys from 3 questions, all
            // 1:1, so the totals coincide — the orphan changes nothing.
            expect(analytics.maturity.totalCards).toBe(3);
            expect(analytics.maturity.masteredCount).toBe(1); // bio card (interval 25, lapses 0)
            expect(analytics.maturity.learningCount).toBe(1); // cs card (interval 1)
            expect(analytics.maturity.newCount).toBe(1); // q-bio-2 unrecorded
            expect(analytics.maturity.orphanReviewCount).toBe(1);
            expect(
                analytics.maturity.newCount +
                    analytics.maturity.learningCount +
                    analytics.maturity.reviewCount +
                    analytics.maturity.masteredCount,
            ).toBe(analytics.maturity.totalCards);

            // Forecast checks — scoped to the pool, so the orphan is not
            // upcoming work even though its dueAt falls on day 1 of the window
            // alongside the cs card. Unscoped, this would be 2.
            expect(analytics.forecast).toHaveLength(7);
            const forecastTotal = analytics.forecast.reduce((sum, day) => sum + day.dueCount, 0);
            expect(forecastTotal).toBe(1);
            expect(analytics.forecast[1].date).toBe('2026-08-26');
            expect(analytics.forecast[1].dueCount).toBe(1);

            // Activity calendar checks — historical, so the orphan IS counted.
            expect(analytics.activity).toHaveLength(365);
            const activeCards = analytics.activity.reduce((sum, day) => sum + day.activeCardsCount, 0);
            expect(activeCards).toBe(3);
        });

        it('counts a multi-blank cloze question as one card per blank, not one question', async () => {
            // 1 non-cloze question (1 card) + 1 three-blank cloze question (3
            // cards) = 4 cards from 2 questions. A question count would say 2.
            await db.questions.clear();
            await db.questions.bulkPut([
                sampleQuestionBio1,
                {
                    id: 'q-bio-cloze',
                    materialId: 'mat-bio-1',
                    type: 'fill_in_blank',
                    difficulty: 'medium',
                    points: 5,
                    version: 1,
                    status: 'published',
                    prompt: 'Fill in the blank:',
                    payload: {
                        type: 'fill_in_blank',
                        template: 'The ___ contains the ___ and the ___.',
                        blanks: ['nucleus', 'chromatin', 'DNA'],
                    },
                    createdAt: '2026-08-01T00:00:00Z',
                    updatedAt: '2026-08-01T00:00:00Z',
                },
            ]);

            const analytics = await repo.getGlobalAnalytics();

            expect(analytics.maturity.totalCards).toBe(4);
            expect(analytics.maturity.newCount).toBe(4);
            expect(analytics.maturity.orphanReviewCount).toBe(0);
        });

        it('excludes an archived question from the pool but still counts its review as an orphan', async () => {
            await db.questions.put({ ...sampleQuestionBio1, status: 'archived' });
            await db.flashcardReviews.put({
                key: 'q:q-bio-1',
                materialId: 'mat-bio-1',
                repetitions: 4,
                easeFactor: 2.6,
                intervalDays: 25,
                dueAt: '2026-09-15T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-25T10:10:00Z',
                reviewCount: 4,
            });

            const analytics = await repo.getGlobalAnalytics();

            // q-bio-1 projects nothing while archived, so the pool is the other
            // two questions' two cards.
            expect(analytics.maturity.totalCards).toBe(2);
            expect(analytics.maturity.orphanReviewCount).toBe(1);
            expect(analytics.maturity.masteredCount).toBe(0);
            // The overview's current-workload figure narrows with the same pool:
            // the archived question's card is no longer a card the learner has,
            // while its review still counts as historical volume.
            expect(analytics.overview.cardsWithReviewHistory).toBe(0);
            expect(analytics.overview.totalCardReviews).toBe(4);
        });

        it('throws when AbortSignal is aborted', async () => {
            const controller = new AbortController();
            controller.abort();
            await expect(repo.getGlobalAnalytics(controller.signal)).rejects.toThrow();
        });
    });

    describe('getMaterialAnalytics()', () => {
        it('returns MaterialAnalytics for the specified material', async () => {
            const sessionBio: QuizSession = {
                id: 'sess-bio',
                quizId: 'quiz-bio-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: {
                    'q-bio-1': sampleQuestionBio1,
                    'q-bio-2': sampleQuestionBio2,
                },
                answers: [
                    { questionId: 'q-bio-1', value: 'DNA', isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-bio-2', value: true, isCorrect: true, earnedPoints: 15 },
                ],
                startedAt: '2026-08-25T10:00:00Z',
                completedAt: '2026-08-25T10:05:00Z',
            };

            await db.quizSessions.put(sessionBio);

            const reviewBio1: ReviewState = {
                key: 'q:q-bio-1',
                materialId: 'mat-bio-1',
                repetitions: 2,
                easeFactor: 2.5,
                intervalDays: 6,
                dueAt: '2026-08-31T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-25T10:10:00Z',
                reviewCount: 2,
            };

            await db.flashcardReviews.put(reviewBio1);

            const matAnalytics = await repo.getMaterialAnalytics('mat-bio-1');
            expect(matAnalytics).not.toBeNull();
            expect(matAnalytics?.materialId).toBe('mat-bio-1');
            expect(matAnalytics?.overview.quizzesCompleted).toBe(1);
            expect(matAnalytics?.overview.totalAnswered).toBe(2);
            expect(matAnalytics?.overview.correctAnswers).toBe(2);
            expect(matAnalytics?.overview.accuracy).toBe(100);
            expect(matAnalytics?.overview.totalCardReviews).toBe(2);
            expect(matAnalytics?.maturity.totalCards).toBe(2);
            expect(matAnalytics?.maturity.learningCount).toBe(1); // reviewBio1 has interval 6
            expect(matAnalytics?.maturity.newCount).toBe(1); // q-bio-2 unreviewed
            expect(matAnalytics?.maturity.orphanReviewCount).toBe(0);
            expect(matAnalytics?.topics.length).toBeGreaterThan(0);
        });

        it('returns null for non-existent material', async () => {
            const res = await repo.getMaterialAnalytics('non-existent');
            expect(res).toBeNull();
        });
    });
});
