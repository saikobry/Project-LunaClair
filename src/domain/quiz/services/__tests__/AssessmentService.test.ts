import { describe, expect, it } from 'vitest';
import { AssessmentService } from '../AssessmentService';
import type { Question } from '../../models/Question';

describe('AssessmentService', () => {
    const service = new AssessmentService();

    const qMcq: Question = {
        id: 'q-mcq',
        materialId: 'mat-1',
        type: 'multiple_choice',
        prompt: 'MCQ Prompt',
        payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
        points: 1,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const qMs: Question = {
        id: 'q-ms',
        materialId: 'mat-1',
        type: 'multiple_select',
        prompt: 'MS Prompt',
        payload: { type: 'multiple_select', choices: ['A', 'B', 'C'], correctIndices: [0, 2] },
        points: 3,
        difficulty: 'medium',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const qTf: Question = {
        id: 'q-tf',
        materialId: 'mat-1',
        type: 'true_false',
        prompt: 'TF Prompt',
        payload: { type: 'true_false', correctAnswer: true },
        points: 2,
        difficulty: 'easy',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const qFb: Question = {
        id: 'q-fb',
        materialId: 'mat-1',
        type: 'fill_in_blank',
        prompt: 'FB Prompt',
        payload: { type: 'fill_in_blank', template: 'The ___ and ___.', blanks: ['sun', 'moon'] },
        points: 4,
        difficulty: 'hard',
        version: 1,
        status: 'published',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const questionMap: Record<string, Question> = {
        'q-mcq': qMcq,
        'q-ms': qMs,
        'q-tf': qTf,
        'q-fb': qFb,
    };

    it('grades mixed question types and calculates point-weighted percentage (not question count)', () => {
        const submissions = [
            { questionId: 'q-mcq', value: '0' }, // Correct (1 pt)
            { questionId: 'q-ms', value: ['0', '2'] }, // Correct (3 pts)
            { questionId: 'q-tf', value: false }, // Incorrect (0 pts out of 2)
            { questionId: 'q-fb', value: ['sun', 'moon'] }, // Correct (4 pts)
        ];

        const result = service.gradeSubmission(questionMap, submissions);

        expect(result.score.correctAnswers).toBe(3);
        expect(result.score.incorrectAnswers).toBe(1);
        expect(result.score.earnedPoints).toBe(8);
        expect(result.score.maxPoints).toBe(10);
        // If it was based on question count: (3 / 4) * 100 = 75%.
        // Because it is point-weighted: (8 / 10) * 100 = 80%.
        expect(result.score.percentage).toBe(80);

        expect(result.answers).toHaveLength(4);
        expect(result.answers[0]).toEqual({
            questionId: 'q-mcq',
            value: '0',
            isCorrect: true,
            earnedPoints: 1,
        });
        expect(result.answers[2]).toEqual({
            questionId: 'q-tf',
            value: false,
            isCorrect: false,
            earnedPoints: 0,
        });
    });

    it('enforces Math.round rounding contract for fractional percentages', () => {
        // 1 earned point out of 3 max points = 33.333% -> rounds to 33%
        const result33 = service.gradeSubmission(
            { 'q-1': { ...qMcq, id: 'q-1', points: 1 }, 'q-2': { ...qMcq, id: 'q-2', points: 2 } },
            [
                { questionId: 'q-1', value: '0' }, // 1 pt
                { questionId: 'q-2', value: '1' }, // 0 pt
            ],
        );
        expect(result33.score.percentage).toBe(33);

        // 2 earned points out of 3 max points = 66.666% -> rounds to 67%
        const result67 = service.gradeSubmission(
            { 'q-1': { ...qMcq, id: 'q-1', points: 1 }, 'q-2': { ...qMcq, id: 'q-2', points: 2 } },
            [
                { questionId: 'q-1', value: '1' }, // 0 pt
                { questionId: 'q-2', value: '0' }, // 2 pts
            ],
        );
        expect(result67.score.percentage).toBe(67);
    });

    it('handles invalid submission format by marking as incorrect with 0 points', () => {
        const submissions = [
            { questionId: 'q-mcq', value: 'invalid-non-integer' },
            { questionId: 'q-tf', value: 'not-a-boolean' as unknown as boolean },
        ];

        const result = service.gradeSubmission(
            { 'q-mcq': qMcq, 'q-tf': qTf },
            submissions,
        );

        expect(result.score.correctAnswers).toBe(0);
        expect(result.score.incorrectAnswers).toBe(2);
        expect(result.score.earnedPoints).toBe(0);
        expect(result.score.percentage).toBe(0);
        expect(result.answers[0].isCorrect).toBe(false);
        expect(result.answers[1].isCorrect).toBe(false);
    });

    it('silently ignores submissions for non-existent question IDs', () => {
        const submissions = [
            { questionId: 'q-missing', value: '0' },
            { questionId: 'q-mcq', value: '0' },
        ];

        const result = service.gradeSubmission({ 'q-mcq': qMcq }, submissions);

        expect(result.score.maxPoints).toBe(1);
        expect(result.score.earnedPoints).toBe(1);
        expect(result.score.correctAnswers).toBe(1);
        expect(result.answers).toHaveLength(1);
    });

    it('returns percentage 0 when total maxPoints is 0', () => {
        const q0pt: Question = { ...qMcq, points: 0 };
        const result = service.gradeSubmission({ 'q-0': q0pt }, [{ questionId: 'q-0', value: '0' }]);
        expect(result.score.percentage).toBe(0);
    });
});
