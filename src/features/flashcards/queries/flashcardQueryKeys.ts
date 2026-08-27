export const flashcardQueryKeys = {
    all: ['flashcards'] as const,
    reviews: (materialId: string) => ['flashcards', 'reviews', materialId] as const,
};
