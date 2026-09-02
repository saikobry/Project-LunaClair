import { describe, it, expect, vi } from 'vitest';
import { GetMaterialAnalyticsUseCase } from '../GetMaterialAnalyticsUseCase';
import type { AnalyticsRepository } from '../../../../domain/analytics/repositories/AnalyticsRepository';
import type { MaterialAnalytics } from '../../../../domain/analytics/models/analytics.types';

describe('GetMaterialAnalyticsUseCase', () => {
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
            reviewCount: 3,
            masteredCount: 4,
            totalCards: 12,
        },
        topics: [],
    };

    it('delegates to AnalyticsRepository.getMaterialAnalytics with materialId', async () => {
        const mockRepo: AnalyticsRepository = {
            getGlobalAnalytics: vi.fn(),
            getSubjectAnalytics: vi.fn(),
            getMaterialAnalytics: vi.fn().mockResolvedValue(mockMaterialAnalytics),
        };

        const useCase = new GetMaterialAnalyticsUseCase(mockRepo);
        const result = await useCase.execute('mat-bio-1');

        expect(mockRepo.getMaterialAnalytics).toHaveBeenCalledWith('mat-bio-1', undefined);
        expect(result).toEqual(mockMaterialAnalytics);
    });

    it('returns null when materialId is empty', async () => {
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
