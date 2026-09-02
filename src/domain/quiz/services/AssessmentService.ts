import type { Question } from '../models/Question';
import type { SubmittedAnswer } from '../models/Answer';
import type { QuizScore } from '../models/QuizSession';
import { resolveStrategy } from '../strategies/QuestionStrategyResolver';

export interface QuizResult {
    answers: SubmittedAnswer[];
    score: QuizScore;
}

/**
 * Pure domain service for assessment validation, grading, and score calculation.
 * Zero persistence dependencies — operates entirely on in-memory domain objects.
 */
export class AssessmentService {
    /**
     * Validates and grades a set of submitted answers against question snapshots.
     * Returns structured SubmittedAnswer[] and a computed QuizScore.
     */
    gradeSubmission(
        questions: Record<string, Question>,
        submissions: Array<{ questionId: string; value: string | string[] | boolean }>,
    ): QuizResult {
        const answers: SubmittedAnswer[] = [];
        let correctAnswers = 0;
        let earnedPoints = 0;
        let maxPoints = 0;

        for (const submission of submissions) {
            const question = questions[submission.questionId];
            if (!question) continue;

            maxPoints += question.points;
            const strategy = resolveStrategy(question.type);

            if (!strategy.validate(question, submission.value)) {
                answers.push({
                    questionId: submission.questionId,
                    value: submission.value,
                    isCorrect: false,
                    earnedPoints: 0,
                });
                continue;
            }

            const result = strategy.grade(question, submission.value);
            if (result.isCorrect) correctAnswers++;
            earnedPoints += result.earnedPoints;

            answers.push({
                questionId: submission.questionId,
                value: submission.value,
                isCorrect: result.isCorrect,
                earnedPoints: result.earnedPoints,
            });
        }

        const totalQuestions = Object.keys(questions).length;
        const incorrectAnswers = totalQuestions - correctAnswers;
        const percentage = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;

        const score: QuizScore = {
            correctAnswers,
            incorrectAnswers,
            earnedPoints,
            maxPoints,
            percentage,
        };

        return { answers, score };
    }
}

/** Shared singleton instance. */
export const assessmentService = new AssessmentService();
