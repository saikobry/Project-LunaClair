import type { Question } from './Question';
import type { Quiz } from './Quiz';

/**
 * Remote quiz snapshot delivered by `GET /api/quiz` (assembled shapes —
 * each quiz carries its `questionIds` + `items`).
 *
 * Fetched at import time so a material brings its question bank and quizzes
 * into the local library together.
 */
export interface QuizContentSnapshot {
  questions: Question[];
  quizzes: Quiz[];
}

export interface QuizContentRepository {
  getQuizContent(signal?: AbortSignal): Promise<QuizContentSnapshot>;
}
