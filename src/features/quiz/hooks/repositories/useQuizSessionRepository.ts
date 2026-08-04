import { useContext } from 'react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { QuizSessionRepository } from '../../../../domain/quiz/QuizSessionRepository';

/** DI hook returning the QuizSessionRepository from context. */
export function useQuizSessionRepository(): QuizSessionRepository {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuizSessionRepository must be used within a <ApplicationProvider>');
    }
    return context.quizSessionRepository;
}
