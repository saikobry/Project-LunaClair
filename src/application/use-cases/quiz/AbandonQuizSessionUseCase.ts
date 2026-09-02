import type { QuizSessionRepository } from '../../../domain/quiz/repositories/QuizSessionRepository';

export class AbandonQuizSessionUseCase {
    private readonly sessions: QuizSessionRepository;

    constructor(sessions: QuizSessionRepository) {
        this.sessions = sessions;
    }

    async execute(sessionId: string): Promise<void> {
        const session = await this.sessions.getSessionById(sessionId);
        if (session && session.status === 'in_progress') {
            await this.sessions.deleteSession(sessionId);
        }
    }
}
