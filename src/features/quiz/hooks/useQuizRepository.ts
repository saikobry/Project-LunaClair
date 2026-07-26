import { useContext } from 'react';
import { RepositoryContext } from '../../../app/providers/RepositoryContext';
import type { QuizRepository } from '../../../domain/quiz/QuizRepository';

/** DI hook returning the QuizRepository from context. */
export function useQuizRepository(): QuizRepository {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useQuizRepository must be used within a <RepositoryProvider>');
    }
    return context.quizRepository;
}
