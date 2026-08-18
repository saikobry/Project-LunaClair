import type { QuizContentRepository, QuizContentSnapshot } from '../../domain/quiz/QuizContentRepository';

/**
 * Concrete implementation of `QuizContentRepository` backed by the LunaClair
 * API (`GET /api/quiz`), which returns **assembled** shapes — each quiz already
 * carries its `questionIds` + `items`, so the app can persist them verbatim.
 *
 * Fetched at material-import time so a material brings its question bank and
 * quizzes into the local library together. Cached offline by the service worker.
 */
export class ApiQuizContentRepository implements QuizContentRepository {
    async getQuizContent(signal?: AbortSignal): Promise<QuizContentSnapshot> {
        const response = await fetch('/api/quiz', { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch quiz content (${response.status})`);
        }
        return (await response.json()) as QuizContentSnapshot;
    }
}

/** Singleton instance shared across the application composition root. */
export const apiQuizContentRepository = new ApiQuizContentRepository();
