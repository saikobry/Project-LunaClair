import type { QuizMode } from '../../../domain/quiz/QuizMode';

/** Request payload to launch a quiz session from any entry point. */
export interface QuizLaunchRequest {
  materialId: string;
  quizId?: string;
  source: 'library' | 'reader';
  mode?: QuizMode;
  subjectId?: string;
}

/** State machine states for the quiz player flow. */
export type QuizFlowState = 'loading' | 'empty' | 'ready' | 'completed' | 'error';
