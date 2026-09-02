import { describe, it, expect } from 'vitest';
import {
    computeTopicMastery,
    computeSubjectMasteries,
    deriveTopicMasteryStatus,
} from '../masteryEngine';
import type { QuizSession } from '../../../quiz/models/QuizSession';
import type { Subject } from '../../../library/models/Subject';
import type { StudyMaterial } from '../../../library/models/StudyMaterial';
import type { Question } from '../../../quiz/models/Question';

describe('masteryEngine', () => {
    const qEasy: Question = {
        id: 'q-easy',
        materialId: 'mat-bio',
        type: 'true_false',
        difficulty: 'easy', // weight 1.0
        points: 10,
        version: 1,
        status: 'published',
        tags: ['respiration'],
        prompt: 'Easy respiration question',
        payload: { type: 'true_false', correctAnswer: true },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const qMedium: Question = {
        id: 'q-medium',
        materialId: 'mat-bio',
        type: 'multiple_choice',
        difficulty: 'medium', // weight 1.5
        points: 15,
        version: 1,
        status: 'published',
        tags: ['respiration'],
        prompt: 'Medium respiration question',
        payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    const qHard: Question = {
        id: 'q-hard',
        materialId: 'mat-bio',
        type: 'identification',
        difficulty: 'hard', // weight 2.0
        points: 20,
        version: 1,
        status: 'published',
        tags: ['respiration'],
        prompt: 'Hard respiration question',
        payload: { type: 'identification', correctAnswer: 'mitochondria' },
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
    };

    describe('deriveTopicMasteryStatus()', () => {
        it('identifies unattempted topics', () => {
            expect(deriveTopicMasteryStatus(0, 0)).toBe('unattempted');
        });

        it('identifies mastered only when weightedScore >= 85 AND attemptCount >= 3', () => {
            expect(deriveTopicMasteryStatus(85, 3)).toBe('mastered');
            expect(deriveTopicMasteryStatus(100, 5)).toBe('mastered');
            // Score is 100%, but only 2 attempts -> proficient, not mastered
            expect(deriveTopicMasteryStatus(100, 2)).toBe('proficient');
            expect(deriveTopicMasteryStatus(84.99, 10)).toBe('proficient');
        });

        it('identifies proficient for 70 <= weightedScore < 85', () => {
            expect(deriveTopicMasteryStatus(70, 3)).toBe('proficient');
            expect(deriveTopicMasteryStatus(80, 4)).toBe('proficient');
        });

        it('identifies needs_practice for score < 70 with attempts', () => {
            expect(deriveTopicMasteryStatus(69.99, 3)).toBe('needs_practice');
            expect(deriveTopicMasteryStatus(20, 1)).toBe('needs_practice');
        });
    });

    describe('computeTopicMastery() with Mixed Difficulty Weighting', () => {
        it('calculates weighted score correctly for mixed difficulty (Easy Correct + Medium Correct + Hard Wrong)', () => {
            // (1.0 + 1.5) / (1.0 + 1.5 + 2.0) = 2.5 / 4.5 = 55.56%
            const session: QuizSession = {
                id: 's1',
                quizId: 'quiz-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: {
                    'q-easy': qEasy,
                    'q-medium': qMedium,
                    'q-hard': qHard,
                },
                answers: [
                    { questionId: 'q-easy', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-medium', value: 'A', isCorrect: true, earnedPoints: 15 },
                    { questionId: 'q-hard', value: 'wrong', isCorrect: false, earnedPoints: 0 },
                ],
                startedAt: '2026-08-20T10:00:00Z',
                completedAt: '2026-08-20T10:05:00Z',
            };

            const topics = computeTopicMastery([session]);
            expect(topics).toHaveLength(1);
            expect(topics[0].tag).toBe('respiration');
            expect(topics[0].attemptCount).toBe(3);
            expect(topics[0].correctCount).toBe(2);
            expect(topics[0].rawAccuracy).toBe(66.67);
            expect(topics[0].weightedScore).toBe(55.56);
            expect(topics[0].status).toBe('needs_practice');
        });

        it('calculates weighted score for (Easy Wrong + Medium Correct + Hard Correct)', () => {
            // (0 + 1.5 + 2.0) / (1.0 + 1.5 + 2.0) = 3.5 / 4.5 = 77.78%
            const session: QuizSession = {
                id: 's1',
                quizId: 'quiz-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: {
                    'q-easy': qEasy,
                    'q-medium': qMedium,
                    'q-hard': qHard,
                },
                answers: [
                    { questionId: 'q-easy', value: false, isCorrect: false, earnedPoints: 0 },
                    { questionId: 'q-medium', value: 'A', isCorrect: true, earnedPoints: 15 },
                    { questionId: 'q-hard', value: 'mitochondria', isCorrect: true, earnedPoints: 20 },
                ],
                startedAt: '2026-08-20T10:00:00Z',
                completedAt: '2026-08-20T10:05:00Z',
            };

            const topics = computeTopicMastery([session]);
            expect(topics).toHaveLength(1);
            expect(topics[0].rawAccuracy).toBe(66.67);
            expect(topics[0].weightedScore).toBe(77.78);
            expect(topics[0].status).toBe('proficient');
        });

        it('counts multiple attempts on the same question across sessions toward attemptCount', () => {
            const session1: QuizSession = {
                id: 's1',
                quizId: 'quiz-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: { 'q-easy': qEasy },
                answers: [{ questionId: 'q-easy', value: true, isCorrect: true, earnedPoints: 10 }],
                startedAt: '2026-08-20T10:00:00Z',
                completedAt: '2026-08-20T10:05:00Z',
            };

            const session2: QuizSession = {
                id: 's2',
                quizId: 'quiz-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: { 'q-easy': qEasy },
                answers: [{ questionId: 'q-easy', value: true, isCorrect: true, earnedPoints: 10 }],
                startedAt: '2026-08-21T10:00:00Z',
                completedAt: '2026-08-21T10:05:00Z',
            };

            const session3: QuizSession = {
                id: 's3',
                quizId: 'quiz-1',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: { 'q-easy': qEasy },
                answers: [{ questionId: 'q-easy', value: true, isCorrect: true, earnedPoints: 10 }],
                startedAt: '2026-08-22T10:00:00Z',
                completedAt: '2026-08-22T10:05:00Z',
            };

            const topics = computeTopicMastery([session1, session2, session3]);
            expect(topics).toHaveLength(1);
            expect(topics[0].attemptCount).toBe(3);
            expect(topics[0].correctCount).toBe(3);
            expect(topics[0].weightedScore).toBe(100);
            expect(topics[0].status).toBe('mastered');
        });
    });

    describe('computeSubjectMasteries() Attribution & Ranking', () => {
        const sampleSubject: Subject = {
            id: 'sub-bio',
            title: 'Cellular Biology',
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
        };

        const sampleMaterial: StudyMaterial = {
            id: 'mat-bio',
            documentId: 'doc-bio',
            title: 'Cell Biology Notes',
            subjectId: 'sub-bio',
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
        };

        it('attributes historical quiz data via immutable snapshots to the correct subject', () => {
            const session: QuizSession = {
                id: 's1',
                quizId: 'virtual:multi-subject',
                mode: 'exam',
                status: 'completed',
                questionSnapshots: {
                    'q-easy': qEasy, // materialId: 'mat-bio' -> subjectId: 'sub-bio'
                },
                answers: [
                    { questionId: 'q-easy', value: true, isCorrect: true, earnedPoints: 10 },
                ],
                startedAt: '2026-08-20T10:00:00Z',
                completedAt: '2026-08-20T10:05:00Z',
            };

            const masteries = computeSubjectMasteries([sampleSubject], [sampleMaterial], [session]);
            expect(masteries).toHaveLength(1);
            expect(masteries[0].subjectId).toBe('sub-bio');
            expect(masteries[0].attemptCount).toBe(1);
            expect(masteries[0].correctCount).toBe(1);
            expect(masteries[0].rawAccuracy).toBe(100);
            expect(masteries[0].totalQuizzes).toBe(1);
            expect(masteries[0].topics).toHaveLength(1);
        });

        it('ranks strengths and weaknesses deterministically requiring attemptCount >= 3', () => {
            const qT1: Question = { ...qEasy, id: 'q-t1', tags: ['topic-a'] };
            const qT2: Question = { ...qEasy, id: 'q-t2', tags: ['topic-b'] };
            const qT3: Question = { ...qEasy, id: 'q-t3', tags: ['topic-c'] };
            const qT4: Question = { ...qEasy, id: 'q-t4', tags: ['topic-d'] }; // Only 1 attempt -> excluded from strengths/weaknesses

            // topic-a: 3 attempts, 3 correct (100%)
            // topic-b: 3 attempts, 2 correct (66.67%)
            // topic-c: 3 attempts, 1 correct (33.33%)
            // topic-d: 1 attempt, 0 correct (0%) -> excluded because attemptCount < 3
            const session: QuizSession = {
                id: 's-rank',
                quizId: 'quiz-rank',
                mode: 'practice',
                status: 'completed',
                questionSnapshots: { 'q-t1': qT1, 'q-t2': qT2, 'q-t3': qT3, 'q-t4': qT4 },
                answers: [
                    { questionId: 'q-t1', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-t1', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-t1', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-t2', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-t2', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-t2', value: false, isCorrect: false, earnedPoints: 0 },
                    { questionId: 'q-t3', value: true, isCorrect: true, earnedPoints: 10 },
                    { questionId: 'q-t3', value: false, isCorrect: false, earnedPoints: 0 },
                    { questionId: 'q-t3', value: false, isCorrect: false, earnedPoints: 0 },
                    { questionId: 'q-t4', value: false, isCorrect: false, earnedPoints: 0 },
                ],
                startedAt: '2026-08-20T10:00:00Z',
                completedAt: '2026-08-20T10:05:00Z',
            };

            const masteries = computeSubjectMasteries([sampleSubject], [sampleMaterial], [session]);
            const bio = masteries[0];

            expect(bio.strengths.map((s) => s.tag)).toEqual(['topic-a', 'topic-b', 'topic-c']);
            expect(bio.weaknesses.map((w) => w.tag)).toEqual(['topic-c', 'topic-b', 'topic-a']);
            // topic-d is excluded because it only has 1 attempt
            expect(bio.weaknesses.some((w) => w.tag === 'topic-d')).toBe(false);
        });

        it('does not mutate input subject, material, or session arrays', () => {
            const subjects = Object.freeze([sampleSubject]);
            const materials = Object.freeze([sampleMaterial]);
            const sessions = Object.freeze([]);
            expect(() => computeSubjectMasteries(subjects, materials, sessions)).not.toThrow();
        });
    });
});
