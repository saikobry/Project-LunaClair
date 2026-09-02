import type { Question } from '../models/Question';

export interface GradeResult {
    isCorrect: boolean;
    earnedPoints: number;
}

/**
 * Strategy interface for question-type-specific validation and grading.
 * Each implementation handles one QuestionType.
 */
export interface QuestionStrategy {
    /** Validates that a submitted answer value is well-formed for this question type. */
    validate(question: Question, value: string | string[] | boolean): boolean;
    /** Grades a submitted answer against the question's correct payload. */
    grade(question: Question, value: string | string[] | boolean): GradeResult;
}
