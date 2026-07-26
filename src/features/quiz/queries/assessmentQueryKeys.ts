export const assessmentQueryKeys = {
    root: ['assessment'] as const,
    questions: (materialId: string) =>
        [...assessmentQueryKeys.root, 'questions', materialId] as const,
    question: (id: string) =>
        [...assessmentQueryKeys.root, 'question', id] as const,
    quizzes: (materialId: string) =>
        [...assessmentQueryKeys.root, 'quizzes', materialId] as const,
    quiz: (id: string) =>
        [...assessmentQueryKeys.root, 'quiz', id] as const,
    sessions: (quizId: string) =>
        [...assessmentQueryKeys.root, 'sessions', quizId] as const,
    session: (id: string) =>
        [...assessmentQueryKeys.root, 'session', id] as const,
};
