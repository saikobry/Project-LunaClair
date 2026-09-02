import type { ReviewState } from '../engines/scheduler';

export interface FlashcardReviewRepository {
    getAllReviews(signal?: AbortSignal): Promise<ReviewState[]>;
    getByKeys(keys: string[]): Promise<ReviewState[]>;
    getByMaterial(materialId: string): Promise<ReviewState[]>;
    save(reviews: ReviewState[]): Promise<void>;
    deleteByKeys(keys: string[]): Promise<void>;
}
