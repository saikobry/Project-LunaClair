import { describe, it, expect, vi } from 'vitest';
import { GetGlobalAnalyticsUseCase } from '../GetGlobalAnalyticsUseCase';
import { GetSubjectAnalyticsUseCase } from '../GetSubjectAnalyticsUseCase';
import { GetMaterialAnalyticsUseCase } from '../GetMaterialAnalyticsUseCase';
import type { AnalyticsRepository } from '../../../../domain/analytics/AnalyticsRepository';
import type {
    GlobalAnalytics,
    SubjectMastery,
    MaterialAnalytics,
} from '../../../../domain/analytics/analytics.types';

describe('Analytics Application Use Cases', () => {
    const mockGlobalAnalytics: GlobalAnalytics = {
        overview: {
            quizzesCompleted: 5,
            totalAnsweredQuestions: 20,
            totalCorrectAnswers: 18,
            globalQuizAccuracy: 90,
            totalCardReviews: 40,
            cardsWithReviewHistory: 15,
            currentStreakDays: 3,
            longestStreakDays: 7,
        },
        maturity: {
            newCount: 5,
            learningCount: 5,
            reviewCount: 5,
            masteredCount: 5,
            totalCards: 20,
        },
        forecast: [],
        subjects: [],
        activity: [],
    };

    const mockSubjectMastery: SubjectMastery = {
        subjectId: 'sub-bio',
        subjectName: 'Biology',
        attemptCount: 10,
        correctCount: 9,
        rawAccuracy: 90,
        weightedScore: 92,
        totalQuizzes: 3,
        topics: [],
        strengths: [],
        weaknesses: [],
    };

    const mockMaterialAnalytics: MaterialAnalytics = {
        materialId: 'mat-bio-1',
        overview: {
            quizzesCompleted: 2,
            totalAnswered: 10,
            correctAnswers: 9,
            accuracy: 90,
            totalCardReviews: 12,
        },
        maturity: {
            newCount: 2,
            learningCount: 3,
            reviewCount: 2,
            masteredCount: 3,
            totalCards: 10,
        },
        topics: [],
    };

    describe('GetGlobalAnalyticsUseCase', () => {
        it('delegates to AnalyticsRepository.getGlobalAnalytics()', async () => {
            const mockRepo: AnalyticsRepository = {
                getGlobalAnalytics: vi.fn().mockResolvedValue(mockGlobalAnalytics),
                getSubjectAnalytics: vi.fn(),
                getMaterialAnalytics: vi.fn(),
            };

            const useCase = new GetGlobalAnalyticsUseCase(mockRepo);
            const result = await useCase.execute();

            expect(mockRepo.getGlobalAnalytics).toHaveBeenCalledOnce();
            expect(result).toBe(mockGlobalAnalytics);
        });
    });

    describe('GetSubjectAnalyticsUseCase', () => {
        it('delegates to AnalyticsRepository.getSubjectAnalytics() with subjectId', async () => {
            const mockRepo: AnalyticsRepository = {
                getGlobalAnalytics: vi.fn(),
                getSubjectAnalytics: vi.fn().mockResolvedValue(mockSubjectMastery),
                getMaterialAnalytics: vi.fn(),
            };

            const useCase = new GetSubjectAnalyticsUseCase(mockRepo);
            const result = await useCase.execute('sub-bio');

            expect(mockRepo.getSubjectAnalytics).toHaveBeenCalledWith('sub-bio', undefined);
            expect(result).toBe(mockSubjectMastery);
        });

        it('returns null early if subjectId is empty', async () => {
            const mockRepo: AnalyticsRepository = {
                getGlobalAnalytics: vi.fn(),
                getSubjectAnalytics: vi.fn(),
                getMaterialAnalytics: vi.fn(),
            };

            const useCase = new GetSubjectAnalyticsUseCase(mockRepo);
            const result = await useCase.execute('');

            expect(mockRepo.getSubjectAnalytics).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });

    describe('GetMaterialAnalyticsUseCase', () => {
        it('delegates to AnalyticsRepository.getMaterialAnalytics() with materialId', async () => {
            const mockRepo: AnalyticsRepository = {
                getGlobalAnalytics: vi.fn(),
                getSubjectAnalytics: vi.fn(),
                getMaterialAnalytics: vi.fn().mockResolvedValue(mockMaterialAnalytics),
            };

            const useCase = new GetMaterialAnalyticsUseCase(mockRepo);
            const result = await useCase.execute('mat-bio-1');

            expect(mockRepo.getMaterialAnalytics).toHaveBeenCalledWith('mat-bio-1', undefined);
            expect(result).toBe(mockMaterialAnalytics);
        });

        it('returns null early if materialId is empty', async () => {
            const mockRepo: AnalyticsRepository = {
                getGlobalAnalytics: vi.fn(),
                getSubjectAnalytics: vi.fn(),
                getMaterialAnalytics: vi.fn(),
            };

            const useCase = new GetMaterialAnalyticsUseCase(mockRepo);
            const result = await useCase.execute('');

            expect(mockRepo.getMaterialAnalytics).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });
    });
});
