import { useContext } from 'react';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { QuizRepository } from '../../../../domain/quiz/QuizRepository';

/** DI hook returning the QuizRepository from context. */
export function useQuizRepository(): QuizRepository {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuizRepository must be used within a <ApplicationProvider>');
    }
    return context.infrastructure.repositories.quiz;
}
