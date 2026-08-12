import type { FlashcardReviewRepository } from '../../../domain/flashcards/FlashcardReviewRepository';
import type { ReviewState } from '../../../domain/flashcards/scheduler';
import { db } from '../LunaClairDatabase';

export class DexieFlashcardReviewRepository implements FlashcardReviewRepository {
    async getByKeys(keys: string[]): Promise<ReviewState[]> {
        if (keys.length === 0) return [];
        return db.flashcardReviews.where('key').anyOf(keys).toArray();
    }

    async getByMaterial(materialId: string): Promise<ReviewState[]> {
        if (!materialId) return [];
        return db.flashcardReviews.where('materialId').equals(materialId).toArray();
    }

    async save(reviews: ReviewState[]): Promise<void> {
        if (reviews.length === 0) return;
        await db.flashcardReviews.bulkPut(reviews);
    }

    async deleteByKeys(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await db.flashcardReviews.bulkDelete(keys);
    }
}

export const dexieFlashcardReviewRepository = new DexieFlashcardReviewRepository();
