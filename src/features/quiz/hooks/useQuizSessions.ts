import { useQuery } from '@tanstack/react-query';
import { assessmentQueryKeys } from '../queries/assessmentQueryKeys';
import { useQuizSessionRepository } from './useQuizSessionRepository';

/** Fetches all sessions for a given quiz. */
export function useQuizSessions(quizId: string) {
    const repository = useQuizSessionRepository();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: assessmentQueryKeys.sessions(quizId),
        queryFn: ({ signal }) => repository.getSessions(quizId, signal),
        enabled: quizId.length > 0,
    });

    return { sessions: data ?? [], isLoading, isError, error };
}
