import { useContext } from 'react';
import { RepositoryContext } from '../../../app/providers/RepositoryContext';
import type { QuizSessionRepository } from '../../../domain/quiz/QuizSessionRepository';

/** DI hook returning the QuizSessionRepository from context. */
export function useQuizSessionRepository(): QuizSessionRepository {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useQuizSessionRepository must be used within a <RepositoryProvider>');
    }
    return context.quizSessionRepository;
}
