import { useCallback } from 'react';
import type { Question } from '../../../domain/quiz/Question';
import type { QuizResult } from '../../../domain/quiz/AssessmentService';
import { assessmentService } from '../../../domain/quiz/AssessmentService';
import type { AnswerValue } from '../components/QuestionRenderer';

/**
 * Invokes AssessmentService.gradeSubmission() to evaluate all answers.
 * Pure computation — no persistence side effects.
 */
export function useQuizSubmission() {
    const evaluate = useCallback(
        (questions: Question[], answers: Map<string, AnswerValue>): QuizResult => {
            const questionMap: Record<string, Question> = {};
            for (const q of questions) {
                questionMap[q.id] = q;
            }

            const submissions = questions.map((q) => ({
                questionId: q.id,
                value: answers.get(q.id) ?? '',
            }));

            return assessmentService.gradeSubmission(questionMap, submissions);
        },
        [],
    );

    return { evaluate };
}
