import type { Question } from '../Question';
import type { MultipleSelectPayload } from '../AnswerPayload';
import type { QuestionStrategy, GradeResult } from './QuestionStrategy';

export class MultipleSelectStrategy implements QuestionStrategy {
    validate(_question: Question, value: string | string[] | boolean): boolean {
        if (!Array.isArray(value)) return false;
        const payload = _question.payload as MultipleSelectPayload;
        return value.every((v) => {
            const index = Number(v);
            return Number.isInteger(index) && index >= 0 && index < payload.choices.length;
        });
    }

    grade(question: Question, value: string | string[] | boolean): GradeResult {
        const payload = question.payload as MultipleSelectPayload;
        const selected = Array.isArray(value)
            ? value.map(Number).sort((a, b) => a - b)
            : [];
        const correct = payload.correctIndices.toSorted((a, b) => a - b);

        const isCorrect =
            selected.length === correct.length &&
            selected.every((v, i) => v === correct[i]);

        return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
}
