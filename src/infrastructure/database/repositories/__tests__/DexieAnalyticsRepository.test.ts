import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../LunaClairDatabase';
import { DexieAnalyticsRepository } from '../DexieAnalyticsRepository';
import type { Subject } from '../../../../domain/library/Subject';
import type { StudyMaterial } from '../../../../domain/library/StudyMaterial';
import type { Question } from '../../../../domain/quiz/Question';
import type { Quiz } from '../../../../domain/quiz/Quiz';
import type { QuizSession } from '../../../../domain/quiz/QuizSession';
import type { ReviewState } from '../../../../domain/flashcards/scheduler';

describe('DexieAnalyticsRepository Integration', () => {
    let repo: DexieAnalyticsRepository;

    const sampleSubjectBio: Subject = {
        id: 'sub-bio',
        title: 'Biology',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleSubjectCS: Subject = {
        id: 'sub-cs',
        title: 'Computer Science',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleMaterialBio: StudyMaterial = {
        id: 'mat-bio-1',
        documentId: 'doc-bio-1',
        title: 'Genetics Notes',
        subjectId: 'sub-bio',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const sampleMaterialCS: StudyMaterial = {
        id: 'mat-cs-1',
        documentId: 'doc-cs-1',
        title: 'Data Structures',
        subjectId: 'sub-cs',
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
        await db.subjects.clear();

        await db.subjects.bulkPut([sampleSubjectBio, sampleSubjectCS]);
        await db.materials.bulkPut([sampleMaterialBio, sampleMaterialCS]);
        await db.questions.bulkPut([sampleQuestionBio1, sampleQuestionBio2, sampleQuestionCS1]);
        await db.quizzes.bulkPut([sampleQuizBio, sampleQuizCS]);

        repo = new DexieAnalyticsRepository();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getGlobalAnalytics()', () => {
        it('aggregates system-wide overview, maturity, forecast, subjects, and activity', async () => {
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

            const reviewBio1: ReviewState = {
                key: 'card-q-bio-1',
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
                key: 'card-q-cs-1',
                materialId: 'mat-cs-1',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 1,
                dueAt: '2026-08-26T00:00:00Z',
                lapses: 0,
                lastReviewedAt: '2026-08-25T11:10:00Z',
                reviewCount: 1,
            };

            await db.flashcardReviews.bulkPut([reviewBio1, reviewCS1]);

            const analytics = await repo.getGlobalAnalytics();

            // Overview checks
            expect(analytics.overview.quizzesCompleted).toBe(2);
            expect(analytics.overview.totalAnsweredQuestions).toBe(3);
            expect(analytics.overview.totalCorrectAnswers).toBe(3);
            expect(analytics.overview.globalQuizAccuracy).toBe(100);
            expect(analytics.overview.totalCardReviews).toBe(5);
            expect(analytics.overview.cardsWithReviewHistory).toBe(2);
            expect(analytics.overview.currentStreakDays).toBe(1);

            // Card maturity checks (3 total published questions, 1 unrecorded)
            expect(analytics.maturity.totalCards).toBe(3);
            expect(analytics.maturity.masteredCount).toBe(1); // bio card (interval 25, lapses 0)
            expect(analytics.maturity.learningCount).toBe(1); // cs card (interval 1)
            expect(analytics.maturity.newCount).toBe(1); // q-bio-2 unrecorded

            // Forecast checks
            expect(analytics.forecast).toHaveLength(7);

            // Subject masteries
            expect(analytics.subjects).toHaveLength(2);
            const bioSub = analytics.subjects.find((s) => s.subjectId === 'sub-bio');
            expect(bioSub?.totalQuizzes).toBe(1);
            expect(bioSub?.attemptCount).toBe(2);
            expect(bioSub?.rawAccuracy).toBe(100);

            // Activity calendar checks
            expect(analytics.activity).toHaveLength(365);
        });

        it('throws when AbortSignal is aborted', async () => {
            const controller = new AbortController();
            controller.abort();
            await expect(repo.getGlobalAnalytics(controller.signal)).rejects.toThrow();
        });
    });

    describe('getSubjectAnalytics()', () => {
        it('returns SubjectMastery for the specified subject', async () => {
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
                    { questionId: 'q-bio-2', value: false, isCorrect: false, earnedPoints: 0 },
                ],
                startedAt: '2026-08-25T10:00:00Z',
                completedAt: '2026-08-25T10:05:00Z',
            };

            await db.quizSessions.put(sessionBio);

            const subjectMastery = await repo.getSubjectAnalytics('sub-bio');
            expect(subjectMastery).not.toBeNull();
            expect(subjectMastery?.subjectId).toBe('sub-bio');
            expect(subjectMastery?.subjectName).toBe('Biology');
            expect(subjectMastery?.attemptCount).toBe(2);
            expect(subjectMastery?.correctCount).toBe(1);
            expect(subjectMastery?.rawAccuracy).toBe(50);
            expect(subjectMastery?.totalQuizzes).toBe(1);
            expect(subjectMastery?.topics.length).toBeGreaterThan(0);
        });

        it('returns null for non-existent subject', async () => {
            const res = await repo.getSubjectAnalytics('non-existent');
            expect(res).toBeNull();
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
                key: 'card-q-bio-1',
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
            expect(matAnalytics?.topics.length).toBeGreaterThan(0);
        });

        it('returns null for non-existent material', async () => {
            const res = await repo.getMaterialAnalytics('non-existent');
            expect(res).toBeNull();
        });
    });
});
