import type { Question } from '../models/Question';
import type { IdentificationPayload } from '../models/AnswerPayload';
import type { QuestionStrategy, GradeResult } from './QuestionStrategy';

export class IdentificationStrategy implements QuestionStrategy {
    validate(_question: Question, value: string | string[] | boolean): boolean {
        return typeof value === 'string' && value.trim().length > 0;
    }

    grade(question: Question, value: string | string[] | boolean): GradeResult {
        const payload = question.payload as IdentificationPayload;
        const submitted = typeof value === 'string' ? value.trim().toLowerCase() : '';
        const correct = payload.correctAnswer.trim().toLowerCase();

        const alternatives = (payload.acceptedAlternatives ?? []).map((a) =>
            a.trim().toLowerCase(),
        );

        const isCorrect = submitted === correct || alternatives.includes(submitted);
        return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
}
