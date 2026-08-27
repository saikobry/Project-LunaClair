export const assessmentQueryKeys = {
    all: ['assessment'] as const,
    questions: (materialId: string) =>
        [...assessmentQueryKeys.all, 'questions', materialId] as const,
    question: (id: string) =>
        [...assessmentQueryKeys.all, 'question', id] as const,
    quizzes: (materialId: string) =>
        [...assessmentQueryKeys.all, 'quizzes', materialId] as const,
    quiz: (id: string) =>
        [...assessmentQueryKeys.all, 'quiz', id] as const,
    sessions: (quizId: string) =>
        [...assessmentQueryKeys.all, 'sessions', quizId] as const,
    session: (id: string) =>
        [...assessmentQueryKeys.all, 'session', id] as const,
};
