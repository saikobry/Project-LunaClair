import type { QuizMode } from '../../../domain/quiz/models/QuizMode';

/**
 * Serializable discriminated navigation contract for launching quiz sessions.
 * Maintains strict separation between navigation and domain models.
 */
export type QuizLaunchRequest =
    | { type: 'quiz'; quizId?: string; materialId?: string; subjectId?: string; source: 'library' | 'reader'; mode?: QuizMode }
    | { type: 'quizzes'; quizIds: string[]; subjectId?: string; source: 'library' | 'reader'; mode?: QuizMode };

/** State machine states for the quiz player flow. */
export type QuizFlowState = 'loading' | 'empty' | 'ready' | 'completed' | 'error';
