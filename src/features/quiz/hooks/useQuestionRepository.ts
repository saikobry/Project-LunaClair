import { useContext } from 'react';
import { RepositoryContext } from '../../../app/providers/RepositoryContext';
import type { QuestionRepository } from '../../../domain/quiz/QuestionRepository';

/** DI hook returning the QuestionRepository from context. */
export function useQuestionRepository(): QuestionRepository {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useQuestionRepository must be used within a <RepositoryProvider>');
    }
    return context.questionRepository;
}
