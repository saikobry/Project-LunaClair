import { describe, it, expect, vi } from 'vitest';
import { GetSubjectAnalyticsUseCase } from '../GetSubjectAnalyticsUseCase';
import type { AnalyticsRepository } from '../../../../domain/analytics/AnalyticsRepository';
import type { SubjectMastery } from '../../../../domain/analytics/analytics.types';

describe('GetSubjectAnalyticsUseCase', () => {
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

    it('delegates to AnalyticsRepository.getSubjectAnalytics with subjectId', async () => {
        const mockRepo: AnalyticsRepository = {
            getGlobalAnalytics: vi.fn(),
            getSubjectAnalytics: vi.fn().mockResolvedValue(mockSubjectMastery),
            getMaterialAnalytics: vi.fn(),
        };

        const useCase = new GetSubjectAnalyticsUseCase(mockRepo);
        const result = await useCase.execute('sub-bio');

        expect(mockRepo.getSubjectAnalytics).toHaveBeenCalledWith('sub-bio', undefined);
        expect(result).toEqual(mockSubjectMastery);
    });

    it('returns null when subjectId is empty', async () => {
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
