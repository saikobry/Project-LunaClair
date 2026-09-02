import { describe, it, expect, vi } from 'vitest';
import { GetGlobalAnalyticsUseCase } from '../GetGlobalAnalyticsUseCase';
import type { AnalyticsRepository } from '../../../../domain/analytics/repositories/AnalyticsRepository';
import type { GlobalAnalytics } from '../../../../domain/analytics/models/analytics.types';

describe('GetGlobalAnalyticsUseCase', () => {
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

    it('delegates to AnalyticsRepository.getGlobalAnalytics and returns calculated snapshot', async () => {
        const mockRepo: AnalyticsRepository = {
            getGlobalAnalytics: vi.fn().mockResolvedValue(mockGlobalAnalytics),
            getSubjectAnalytics: vi.fn(),
            getMaterialAnalytics: vi.fn(),
        };

        const useCase = new GetGlobalAnalyticsUseCase(mockRepo);
        const result = await useCase.execute();

        expect(mockRepo.getGlobalAnalytics).toHaveBeenCalled();
        expect(result).toEqual(mockGlobalAnalytics);
    });
});
