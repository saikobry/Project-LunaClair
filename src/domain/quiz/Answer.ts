/** A single answer submitted by the user for one question. */
export interface SubmittedAnswer {
    questionId: string;
    /** The user's raw answer value — type depends on the question type. */
    value: string | string[] | boolean;
    isCorrect: boolean;
    earnedPoints: number;
}
