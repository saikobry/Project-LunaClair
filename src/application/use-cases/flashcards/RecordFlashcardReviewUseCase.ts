import type { FlashcardReviewRepository } from '../../../domain/flashcards/FlashcardReviewRepository';
import { review, type Rating, type ReviewState } from '../../../domain/flashcards/scheduler';

export interface RecordFlashcardReviewInput {
    key: string;
    materialId: string;
    rating: Rating;
    existingState?: ReviewState;
    now?: Date;
}

export class RecordFlashcardReviewUseCase {
    private readonly flashcardReviews: FlashcardReviewRepository;

    constructor(flashcardReviews: FlashcardReviewRepository) {
        this.flashcardReviews = flashcardReviews;
    }

    async execute(input: RecordFlashcardReviewInput): Promise<ReviewState> {
        const newState = review(input.existingState, input.rating, input.now ?? new Date());
        newState.key = input.key;
        newState.materialId = input.materialId;

        await this.flashcardReviews.save([newState]);
        return newState;
    }
}
