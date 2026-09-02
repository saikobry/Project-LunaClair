import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import type { CreateSessionInput, QuizSessionRepository } from '../../../domain/quiz/repositories/QuizSessionRepository';

export class StartQuizSessionUseCase {
    private readonly sessions: QuizSessionRepository;
    constructor(sessions: QuizSessionRepository) { this.sessions = sessions; }

    execute(input: CreateSessionInput): Promise<QuizSession> {
        return this.sessions.createSession(input);
    }
}
