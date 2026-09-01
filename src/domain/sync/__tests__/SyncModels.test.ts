import { describe, expect, it } from 'vitest';
import { getSyncModelForEntity } from '../SyncModels';

describe('SyncModels', () => {
    it('maps domain entity types to their appropriate synchronization model', () => {
        expect(getSyncModelForEntity('document')).toBe('versioned');
        expect(getSyncModelForEntity('highlight')).toBe('lww');
        expect(getSyncModelForEntity('drawing')).toBe('lww');
        expect(getSyncModelForEntity('flashcardReview')).toBe('lww');
        expect(getSyncModelForEntity('quizSession')).toBe('append');
    });
});
