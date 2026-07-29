import type { Quiz } from './Quiz';
import type { Question } from './Question';

/**
 * Deduplicates questions by ID and orders deterministically:
 * quiz index → question position → createdAt → id.
 */
export function buildUnifiedQuestionSetFromQuizzes(
    quizzes: Quiz[],
    questions: Question[],
): Question[] {
    const seen = new Set<string>();
    const result: Question[] = [];
    const questionMap = new Map<string, Question>();
    for (const q of questions) {
        questionMap.set(q.id, q);
    }

    for (const quiz of quizzes) {
        for (const qId of quiz.questionIds) {
            if (seen.has(qId)) continue;
            seen.add(qId);
            const question = questionMap.get(qId);
            if (question) result.push(question);
        }
    }

    // Stable sort: quiz index → question position → createdAt → id
    result.sort((a, b) => {
        const aQuizIndex = quizzes.findIndex((q) => q.questionIds.includes(a.id));
        const bQuizIndex = quizzes.findIndex((q) => q.questionIds.includes(b.id));
        if (aQuizIndex !== bQuizIndex) return aQuizIndex - bQuizIndex;
        const aPos = quizzes[aQuizIndex]?.questionIds.indexOf(a.id) ?? 0;
        const bPos = quizzes[bQuizIndex]?.questionIds.indexOf(b.id) ?? 0;
        if (aPos !== bPos) return aPos - bPos;
        if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
        return a.id.localeCompare(b.id);
    });

    return result;
}

/**
 * Pure domain factory creating in-memory virtual quizzes with stable IDs
 * (`virtual:quizzes:${sortedIds}`). Does not persist anything.
 */
export function createVirtualQuizFromQuizzes({
    quizIds,
    quizzes,
    questions,
}: {
    quizIds: string[];
    quizzes: Quiz[];
    questions: Question[];
}): Quiz {
    const sortedIds = quizIds.toSorted();
    const id = `virtual:quizzes:${sortedIds.join('|')}`;
    const unified = buildUnifiedQuestionSetFromQuizzes(quizzes, questions);
    const now = new Date().toISOString();

    return {
        id,
        materialId: quizzes[0]?.materialId ?? '',
        title: `Unified Quiz (${quizzes.length} quizzes)`,
        description: `Combined quiz from ${quizzes.length} source quizzes`,
        questionIds: unified.map((q) => q.id),
        items: unified.map((q, i) => ({
            quizId: id,
            questionId: q.id,
            questionVersion: q.version,
            order: i + 1,
            points: q.points,
        })),
        status: 'published',
        createdAt: now,
        updatedAt: now,
    };
}
