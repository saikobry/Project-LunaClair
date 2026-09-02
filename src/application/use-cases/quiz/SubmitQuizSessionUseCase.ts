import { assessmentService, type QuizResult } from '../../../domain/quiz/services/AssessmentService';
import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import type { QuizSessionRepository } from '../../../domain/quiz/repositories/QuizSessionRepository';

export interface SubmitQuizSessionInput {
    sessionId: string;
    submissions: Array<{ questionId: string; value: string | string[] | boolean }>;
}

export interface SubmitQuizSessionOutput {
    session: QuizSession;
    result: QuizResult;
}

export class SubmitQuizSessionUseCase {
    private readonly sessions: QuizSessionRepository;
    constructor(sessions: QuizSessionRepository) { this.sessions = sessions; }

    async execute(input: SubmitQuizSessionInput): Promise<SubmitQuizSessionOutput> {
        const session = await this.sessions.getSessionById(input.sessionId);
        if (!session) throw new Error(`QuizSession not found: ${input.sessionId}`);
        if (session.status !== 'in_progress') throw new Error('Quiz session is not in progress');

        const result = assessmentService.gradeSubmission(session.questionSnapshots, input.submissions);
        const completed = await this.sessions.completeSession(input.sessionId, result.answers, result.score);
        return { session: completed, result };
    }
}
