import { useContext } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { QuestionRepository } from '../../../domain/quiz/QuestionRepository';

/** DI hook returning the QuestionRepository from context. */
export function useQuestionRepository(): QuestionRepository {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuestionRepository must be used within a <ApplicationProvider>');
    }
    return context.questionRepository;
}
