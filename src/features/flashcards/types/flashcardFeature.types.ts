export type FlashcardViewStep = 'setup' | 'session' | 'summary';

export interface FlashcardSessionSummary {
    totalReviewed: number;
    againCount: number;
    hardCount: number;
    goodCount: number;
    easyCount: number;
}
