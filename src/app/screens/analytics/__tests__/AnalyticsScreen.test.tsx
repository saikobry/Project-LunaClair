import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApplicationContext, type ApplicationContextValue } from '../../../providers/ApplicationContext';
import { AnalyticsScreen } from '../AnalyticsScreen';
import type { GlobalAnalytics } from '../../../../domain/analytics/models/analytics.types';

describe('AnalyticsScreen Component & UI State Tests', () => {
    let queryClient: QueryClient;

    const mockPopulatedAnalytics: GlobalAnalytics = {
        overview: {
            quizzesCompleted: 4,
            totalAnsweredQuestions: 20,
            totalCorrectAnswers: 17,
            globalQuizAccuracy: 85,
            totalCardReviews: 24,
            cardsWithReviewHistory: 8,
            currentStreakDays: 3,
            longestStreakDays: 5,
        },
        maturity: {
            masteredCount: 4,
            reviewCount: 3,
            learningCount: 2,
            newCount: 1,
            totalCards: 10,
        },
        forecast: [
            { date: '2026-08-25', dueCount: 3, cumulativeDue: 3 },
            { date: '2026-08-26', dueCount: 1, cumulativeDue: 4 },
            { date: '2026-08-27', dueCount: 0, cumulativeDue: 4 },
            { date: '2026-08-28', dueCount: 2, cumulativeDue: 6 },
            { date: '2026-08-29', dueCount: 0, cumulativeDue: 6 },
            { date: '2026-08-30', dueCount: 1, cumulativeDue: 7 },
            { date: '2026-08-31', dueCount: 0, cumulativeDue: 7 },
        ],
        subjects: [
            {
                subjectId: 'sub-bio',
                subjectName: 'Biology',
                attemptCount: 15,
                correctCount: 13,
                rawAccuracy: 86.67,
                weightedScore: 88.5,
                totalQuizzes: 3,
                topics: [
                    {
                        tag: 'Genetics',
                        attemptCount: 8,
                        correctCount: 7,
                        rawAccuracy: 87.5,
                        weightedScore: 90,
                        status: 'mastered',
                    },
                    {
                        tag: 'Cell Structure',
                        attemptCount: 7,
                        correctCount: 6,
                        rawAccuracy: 85.71,
                        weightedScore: 86,
                        status: 'mastered',
                    },
                ],
                strengths: [
                    {
                        tag: 'Genetics',
                        attemptCount: 8,
                        correctCount: 7,
                        rawAccuracy: 87.5,
                        weightedScore: 90,
                        status: 'mastered',
                    },
                ],
                weaknesses: [],
            },
        ],
        activity: Array(365).fill(null).map((_, i) => ({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            quizzesCount: i === 0 ? 2 : 0,
            activeCardsCount: i === 0 ? 3 : 0,
            totalActivities: i === 0 ? 5 : 0,
            intensityLevel: (i === 0 ? 3 : 0) as 0 | 1 | 2 | 3 | 4,
        })),
    };

    const mockEmptyAnalytics: GlobalAnalytics = {
        overview: {
            quizzesCompleted: 0,
            totalAnsweredQuestions: 0,
            totalCorrectAnswers: 0,
            globalQuizAccuracy: 0,
            totalCardReviews: 0,
            cardsWithReviewHistory: 0,
            currentStreakDays: 0,
            longestStreakDays: 0,
        },
        maturity: {
            newCount: 0,
            learningCount: 0,
            reviewCount: 0,
            masteredCount: 0,
            totalCards: 0,
        },
        forecast: [],
        subjects: [],
        activity: [],
    };

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
    });

    function renderScreen(getGlobalAnalyticsFn: () => Promise<GlobalAnalytics>) {
        const mockContextValue = {
            useCases: {
                analytics: {
                    getGlobalAnalytics: {
                        execute: vi.fn().mockImplementation(getGlobalAnalyticsFn),
                    },
                },
            },
        } as unknown as ApplicationContextValue;

        return render(
            <QueryClientProvider client={queryClient}>
                <ApplicationContext.Provider value={mockContextValue}>
                    <AnalyticsScreen />
                </ApplicationContext.Provider>
            </QueryClientProvider>,
        );
    }

    it('renders empty state when there are 0 completed quizzes and 0 card reviews', async () => {
        renderScreen(() => Promise.resolve(mockEmptyAnalytics));

        await waitFor(() => {
            expect(screen.getByText('Your learning journey starts here')).toBeInTheDocument();
        });
        expect(
            screen.getByText(/Complete a quiz session or review some flashcards/i),
        ).toBeInTheDocument();
    });

    it('renders full dashboard when learning data exists', async () => {
        renderScreen(() => Promise.resolve(mockPopulatedAnalytics));

        // 1. Overview metrics
        await waitFor(() => {
            expect(screen.getByText('3 days')).toBeInTheDocument();
        });
        expect(screen.getByText('Best: 5 days')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('17 / 20 correct answers')).toBeInTheDocument();
        expect(screen.getByText('Completed sessions')).toBeInTheDocument();
        expect(screen.getByText('24')).toBeInTheDocument();
        expect(screen.getByText('8 cards with history')).toBeInTheDocument();
        expect(screen.getAllByText('4').length).toBeGreaterThan(0);

        // 2. Retention
        expect(screen.getByText('Card Maturity')).toBeInTheDocument();
        expect(screen.getByText('10 total flashcards')).toBeInTheDocument();
        expect(screen.getByText('7-Day Review Forecast')).toBeInTheDocument();
        expect(screen.getByText('7 total reviews due')).toBeInTheDocument();

        // 3. Activity
        expect(screen.getByText('Study Activity')).toBeInTheDocument();

        // 4. Subjects
        expect(screen.getByText('Biology')).toBeInTheDocument();
        expect(screen.getByText('Genetics')).toBeInTheDocument();
        expect(screen.getByText('Top Strengths')).toBeInTheDocument();
    });

    it('renders error state when query rejects', async () => {
        renderScreen(() => Promise.reject(new Error('IndexedDB query failed')));

        await waitFor(() => {
            expect(screen.getByText('IndexedDB query failed')).toBeInTheDocument();
        });
    });
});
