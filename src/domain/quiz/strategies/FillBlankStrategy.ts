import type { Question } from '../models/Question';
import type { FillBlankPayload } from '../models/AnswerPayload';
import type { QuestionStrategy, GradeResult } from './QuestionStrategy';

export class FillBlankStrategy implements QuestionStrategy {
    validate(_question: Question, value: string | string[] | boolean): boolean {
        if (!Array.isArray(value)) return false;
        const payload = _question.payload as FillBlankPayload;
        const blanks = payload.blanks;
        // "No answers" means nothing can match one, so no submission is a VALID answer to it —
        // without this, an empty submission would pass `every` over nothing and be graded correct,
        // awarding the question's points for submitting nothing.
        //
        // **This clause is deliberately NOT a tolerance for malformed content.** Every ingress to
        // `db.questions` validates, so a row carrying an empty `blanks` array is a real authoring
        // state the question is allowed to be in, not a degraded read. What the clause defends
        // against is narrower and permanent: substituting an empty answer set for ANY reason must
        // never turn a vacuous match into points. That is why it survives the removal of the
        // `Array.isArray` guard that used to sit beside it.
        return (
            blanks.length > 0 &&
            value.length === blanks.length &&
            value.every((v) => v.trim().length > 0)
        );
    }

    grade(question: Question, value: string | string[] | boolean): GradeResult {
        const payload = question.payload as FillBlankPayload;
        const blanks = payload.blanks;
        const submitted = Array.isArray(value) ? value : [];

        // Same clause as `validate`, and for the same reason: with zero answers `every` over the
        // submission is vacuously true, so an empty submission would otherwise score as correct.
        const isCorrect =
            blanks.length > 0 &&
            submitted.length === blanks.length &&
            submitted.every((v, i) => v.trim().toLowerCase() === blanks[i].trim().toLowerCase());

        return { isCorrect, earnedPoints: isCorrect ? question.points : 0 };
    }
}
