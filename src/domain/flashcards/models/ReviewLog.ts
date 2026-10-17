import type { CardState } from './CardState';

export type { CardState };

/**
 * Authoritative, append-only review or keyframe record for spaced-repetition synchronization.
 */
export interface ReviewLog {
  id: string; // e.g. rev_<uuid> or kf:<cardKey>:<deviceId>
  cardKey: string;
  kind: 'review' | 'keyframe';
  rating?: 1 | 2 | 3 | 4;
  at: number; // epoch ms
  state?: CardState; // present on keyframes
  deviceId: string;
}
