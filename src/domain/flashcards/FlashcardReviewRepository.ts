import type { ReviewState } from './scheduler';

export interface FlashcardReviewRepository {
    getByKeys(keys: string[]): Promise<ReviewState[]>;
    getByMaterial(materialId: string): Promise<ReviewState[]>;
    save(reviews: ReviewState[]): Promise<void>;
    deleteByKeys(keys: string[]): Promise<void>;
}
