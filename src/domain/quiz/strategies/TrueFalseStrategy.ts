import type { Question } from '../Question';
import type { TrueFalsePayload } from '../AnswerPayload';
import type { QuestionStrategy, GradeResult } from './QuestionStrategy';

export class TrueFalseStrategy implements QuestionStrategy {
    validate(_question: Question, value: string | string[] | boolean): boolean {
        return typeof value === 'boolean';
    }

    grade(question: Question, value: string | string[] | boolean): GradeResult {
        const payload = question.payload as TrueFalsePayload;
        const isCorrect = value === payload.correctAnswer;
        return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
}
