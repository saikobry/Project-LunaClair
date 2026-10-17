import { describe, expect, it } from 'vitest';
import { foldCard, type ReviewLogFoldItem, type Scheduler } from '../foldCard';
import type { CardState } from '../../models/CardState';

describe('foldCard engine', () => {
  // Deliberately NON-commutative scheduler so wrong evaluation ordering changes the result.
  const nonCommutativeScheduler: Scheduler = {
    next: (prev, rating, at, cardKey) => ({
      cardKey,
      due: at + rating * 1000,
      stability: (prev?.stability ?? 1) * rating + 1,
      difficulty: (prev?.difficulty ?? 5) - rating,
      state: 2,
      lastReview: at,
      reps: (prev?.reps ?? 0) + 1,
    }),
  };

  const makeReview = (
    id: string,
    at: number,
    rating: 1 | 2 | 3 | 4,
    hlc?: string
  ): ReviewLogFoldItem => ({
    id,
    cardKey: 'card-1',
    kind: 'review',
    rating,
    at,
    deviceId: 'dev-alpha',
    _hlc: hlc ?? `0000000000000_${String(at).padStart(4, '0')}_dev-alpha`,
  });

  describe('arrival-order independence', () => {
    it('produces identical state across all permutations of review logs', () => {
      const logs: ReviewLogFoldItem[] = [
        makeReview('rev-1', 1000, 3),
        makeReview('rev-2', 2000, 1),
        makeReview('rev-3', 3000, 4),
        makeReview('rev-4', 2500, 2),
      ];

      const expected = foldCard(logs, nonCommutativeScheduler);
      expect(expected).toBeDefined();

      // Helper to generate all permutations of an array
      const permute = <T>(arr: T[]): T[][] => {
        if (arr.length <= 1) return [arr];
        const result: T[][] = [];
        for (let i = 0; i < arr.length; i++) {
          const current = arr[i];
          const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
          for (const p of permute(remaining)) {
            result.push([current as T, ...p]);
          }
        }
        return result;
      };

      const allPermutations = permute(logs);
      expect(allPermutations).toHaveLength(24);

      for (const permutation of allPermutations) {
        const result = foldCard(permutation, nonCommutativeScheduler);
        expect(result).toEqual(expected);
      }
    });

    it('breaks ties deterministically using _hlc when at timestamps are identical', () => {
      const logA: ReviewLogFoldItem = {
        id: 'rev-tie-1',
        cardKey: 'card-1',
        kind: 'review',
        rating: 1,
        at: 5000,
        deviceId: 'dev-1',
        _hlc: '2026-10-15T10:00:00.000Z_0001_dev-1',
      };
      const logB: ReviewLogFoldItem = {
        id: 'rev-tie-2',
        cardKey: 'card-1',
        kind: 'review',
        rating: 4,
        at: 5000,
        deviceId: 'dev-2',
        _hlc: '2026-10-15T10:00:00.000Z_0002_dev-2',
      };

      // Since logA._hlc < logB._hlc, logA must be applied before logB
      const resultAB = foldCard([logA, logB], nonCommutativeScheduler);
      const resultBA = foldCard([logB, logA], nonCommutativeScheduler);

      expect(resultAB).toEqual(resultBA);
      // In non-commutative scheduler: logA (rating 1) -> 5 - 1 = 4, then logB (rating 4) -> 4 - 4 = 0
      expect(resultAB?.difficulty).toBe(0);
    });

    it('breaks ties deterministically using id when at and _hlc are identical', () => {
      const logA: ReviewLogFoldItem = {
        id: 'rev-id-a',
        cardKey: 'card-1',
        kind: 'review',
        rating: 2,
        at: 5000,
        deviceId: 'dev-1',
        _hlc: '2026-10-15T10:00:00.000Z_0000_dev-1',
      };
      const logB: ReviewLogFoldItem = {
        id: 'rev-id-b',
        cardKey: 'card-1',
        kind: 'review',
        rating: 4,
        at: 5000,
        deviceId: 'dev-1',
        _hlc: '2026-10-15T10:00:00.000Z_0000_dev-1',
      };

      const resultAB = foldCard([logA, logB], nonCommutativeScheduler);
      const resultBA = foldCard([logB, logA], nonCommutativeScheduler);

      expect(resultAB).toEqual(resultBA);
    });
  });

  describe('keyframe absorption', () => {
    const keyframeState: CardState = {
      cardKey: 'card-1',
      due: 150000,
      stability: 7,
      difficulty: 4,
      state: 2,
      lastReview: 100000,
      reps: 12,
    };

    const keyframeLog: ReviewLogFoldItem = {
      id: 'kf:card-1:dev-alpha',
      cardKey: 'card-1',
      kind: 'keyframe',
      at: 100000,
      deviceId: 'dev-alpha',
      state: keyframeState,
      _hlc: '0000000010000_0000_dev-alpha',
    };

    it('supersedes earlier reviews and applies only subsequent reviews', () => {
      const olderReview = makeReview('rev-old', 50000, 1);
      const newerReview = makeReview('rev-new', 120000, 3);

      const stateWithoutOld = foldCard([keyframeLog, newerReview], nonCommutativeScheduler);
      const stateWithOld = foldCard([olderReview, keyframeLog, newerReview], nonCommutativeScheduler);
      const statePermuted = foldCard([newerReview, olderReview, keyframeLog], nonCommutativeScheduler);

      expect(stateWithoutOld).toEqual(stateWithOld);
      expect(stateWithOld).toEqual(statePermuted);
      expect(stateWithoutOld?.reps).toBe(13); // 12 from keyframe + 1 from newerReview
    });

    it('absorbs late-arriving older reviews without altering derived state', () => {
      const review1 = makeReview('rev-after-1', 110000, 2);
      const review2 = makeReview('rev-after-2', 120000, 3);

      const baseResult = foldCard([keyframeLog, review1, review2], nonCommutativeScheduler);

      // Late-arriving reviews from another device with older timestamps
      const lateOld1 = makeReview('rev-late-1', 30000, 4);
      const lateOld2 = makeReview('rev-late-2', 90000, 1);

      const foldedWithLateArrivals = foldCard(
        [lateOld2, review2, keyframeLog, lateOld1, review1],
        nonCommutativeScheduler
      );

      expect(foldedWithLateArrivals).toEqual(baseResult);
    });

    it('uses latest keyframe when multiple keyframes are present', () => {
      const olderKeyframeState: CardState = {
        cardKey: 'card-1',
        due: 50000,
        stability: 2,
        difficulty: 6,
        state: 1,
        lastReview: 40000,
        reps: 3,
      };

      const olderKeyframe: ReviewLogFoldItem = {
        id: 'kf:card-1:dev-beta',
        cardKey: 'card-1',
        kind: 'keyframe',
        at: 40000,
        deviceId: 'dev-beta',
        state: olderKeyframeState,
      };

      const reviewBetween = makeReview('rev-mid', 60000, 1);
      const reviewAfter = makeReview('rev-after', 110000, 4);

      const result = foldCard(
        [reviewBetween, keyframeLog, olderKeyframe, reviewAfter],
        nonCommutativeScheduler
      );

      // Keyframe 2 (at t=100000) supersedes Keyframe 1 (at t=40000) and reviewBetween (at t=60000)
      expect(result?.reps).toBe(13); // 12 (from keyframeLog) + 1 (from reviewAfter)
      expect(result?.lastReview).toBe(110000);
    });
  });

  describe('edge cases and purity', () => {
    it('returns undefined when logs array is empty', () => {
      expect(foldCard([], nonCommutativeScheduler)).toBeUndefined();
    });

    it('returns keyframe state when only a keyframe is present', () => {
      const keyframeState: CardState = {
        cardKey: 'card-1',
        due: 10000,
        stability: 5,
        difficulty: 3,
        state: 2,
        reps: 5,
      };
      const keyframe: ReviewLogFoldItem = {
        id: 'kf:card-1:dev-1',
        cardKey: 'card-1',
        kind: 'keyframe',
        at: 10000,
        deviceId: 'dev-1',
        state: keyframeState,
      };

      const result = foldCard([keyframe], nonCommutativeScheduler);
      expect(result).toEqual(keyframeState);
      // Ensures returned state is a cloned object, not a mutated reference
      expect(result).not.toBe(keyframeState);
    });

    it('handles review logs without keyframes starting from undefined state', () => {
      const log = makeReview('rev-1', 1000, 3);
      const result = foldCard([log], nonCommutativeScheduler);

      expect(result).toBeDefined();
      expect(result?.cardKey).toBe('card-1');
      expect(result?.reps).toBe(1);
    });

    it('ignores non-review entries without state and reviews with missing rating', () => {
      const validReview = makeReview('rev-valid', 2000, 3);
      const missingRating: ReviewLogFoldItem = {
        id: 'rev-no-rating',
        cardKey: 'card-1',
        kind: 'review',
        at: 1000,
        deviceId: 'dev-1',
      };
      const keyframeWithoutState: ReviewLogFoldItem = {
        id: 'kf-no-state',
        cardKey: 'card-1',
        kind: 'keyframe',
        at: 500,
        deviceId: 'dev-1',
      };

      const result = foldCard(
        [keyframeWithoutState, missingRating, validReview],
        nonCommutativeScheduler
      );

      expect(result?.reps).toBe(1);
      expect(result?.lastReview).toBe(2000);
    });

    it('does not mutate the input array', () => {
      const logs: ReviewLogFoldItem[] = [
        makeReview('rev-2', 2000, 1),
        makeReview('rev-1', 1000, 3),
      ];
      const copy = [...logs];

      foldCard(logs, nonCommutativeScheduler);

      expect(logs[0]?.id).toBe(copy[0]?.id);
      expect(logs[1]?.id).toBe(copy[1]?.id);
    });
  });
});
