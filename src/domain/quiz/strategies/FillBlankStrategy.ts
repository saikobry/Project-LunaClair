import type { Question } from '../Question';
import type { FillBlankPayload } from '../AnswerPayload';
import type { QuestionStrategy, GradeResult } from './QuestionStrategy';

export class FillBlankStrategy implements QuestionStrategy {
    validate(_question: Question, value: string | string[] | boolean): boolean {
        if (!Array.isArray(value)) return false;
        const payload = _question.payload as FillBlankPayload;
        return value.length === payload.blanks.length && value.every((v) => v.trim().length > 0);
    }

    grade(question: Question, value: string | string[] | boolean): GradeResult {
        const payload = question.payload as FillBlankPayload;
        const submitted = Array.isArray(value) ? value : [];

        const isCorrect =
            submitted.length === payload.blanks.length &&
            submitted.every(
                (v, i) => v.trim().toLowerCase() === payload.blanks[i].trim().toLowerCase(),
            );

        return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
}
