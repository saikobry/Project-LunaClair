import type { Question } from '../models/Question';
import type { MultipleChoicePayload } from '../models/AnswerPayload';
import type { QuestionStrategy, GradeResult } from './QuestionStrategy';

export class MultipleChoiceStrategy implements QuestionStrategy {
    validate(_question: Question, value: string | string[] | boolean): boolean {
        if (typeof value !== 'string') return false;
        const index = Number(value);
        const payload = _question.payload as MultipleChoicePayload;
        return Number.isInteger(index) && index >= 0 && index < payload.choices.length;
    }

    grade(question: Question, value: string | string[] | boolean): GradeResult {
        const payload = question.payload as MultipleChoicePayload;
        const selectedIndex = Number(value);
        const isCorrect = selectedIndex === payload.correctIndex;
        return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
}
