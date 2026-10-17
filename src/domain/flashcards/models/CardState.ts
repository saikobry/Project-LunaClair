/**
 * Derived FSRS card state representation.
 * Represents derived spaced-repetition parameters for a flashcard.
 */
export interface CardState {
  cardKey: string;
  due: number;
  stability: number;
  difficulty: number;
  state: number;
  lastReview?: number;
  reps: number;
}
